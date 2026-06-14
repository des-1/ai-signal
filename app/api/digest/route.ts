import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const WEB_SEARCH_TOOL = { type: "web_search_20250305", name: "web_search" } as any;
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildSystemPrompt(industryName: string, focus: string, usedUrls: Set<string>, usedHeadlines: string[]) {
  const exclusionBlock = (usedUrls.size > 0 || usedHeadlines.length > 0)
    ? `PREVIOUSLY COVERED STORIES FOR THIS INDUSTRY — skip these even if you find them on a different source:

Headlines already covered:
${usedHeadlines.join("\n")}

URLs already used:
${Array.from(usedUrls).join("\n")}

If a story covers the same event as any headline above, skip it and find a genuinely different story instead.

`
    : "";

  return `You are an AI industry intelligence analyst for RepresentAI, a UK organisation focused on AI literacy across professional sectors. Your job is to find and curate the most important AI news stories from the past 7 days directly relevant to the ${industryName} industry.

GEOGRAPHIC PRIORITY:
Actively seek out UK and European AI news alongside US stories. A good digest should include at least 2-3 stories from UK or European sources or about UK/EU companies, regulation, or organisations.

UK sources to prioritise: BBC, The Guardian, Financial Times (free articles), City A.M., Computing.co.uk, The Register, Sifted, UKTN, Gov.uk, TechMonitor.
EU/European sources: Euractiv, POLITICO Europe, EU AI Office announcements, European Parliament news.

UK/EU topics to actively search for alongside US news: UK AI regulation and government policy, EU AI Act implementation, UK fintech and legaltech, European AI startup funding, FTSE 100 AI adoption.

Search focus areas:
${focus}

${exclusionBlock}Return a JSON object with this exact structure — no preamble, no markdown, no backticks:
{
  "tldr": "2-3 sentence overview of the biggest theme or pattern across this week's stories",
  "highlight": "the single most important story this week in one sentence",
  "stories": [
    {"headline":"...","source":"...","tag":"...","summary":"...","url":"..."}
  ]
}

Story rules:
- headline: max 12 words, sharp and editorial
- source: the actual publication name
- tag: one of exactly: Advertising, Content, Search, Social, Generative AI, Tools, Regulation, Strategy, Legal, Finance, Risk
- summary: 2-3 sentences — what happened and why it matters for practitioners. Include enough context that a non-technical reader understands the significance.
- url: the actual article URL — always include it

Source rules — critical:
- Prioritise freely accessible sources: TechCrunch, Reuters, BBC, Forbes, The Guardian, Bloomberg (free articles), Wired, The Verge, Ars Technica, Fast Company, MIT Technology Review, VentureBeat, Business Insider, AP News, Financial Times (free), Gov.uk, official company blogs and press releases
- Also use reputable industry-specific publications where freely accessible
- Actively avoid paywalled sources: Wall Street Journal, New York Times, The Economist, and any source requiring a subscription or login to read the full article
- If a story is only covered by paywalled sources, find a freely accessible source covering the same story instead
- Never use low-quality sources: PR Newswire, Business Wire, GlobeNewswire, or pure press release wires unless no editorial coverage exists
- Prefer original reporting over aggregators

Return exactly 5 stories. Cover a mix of tags.`;
}

function formatDigestAsHtml(stories: any[], tldr: string, highlight: string): string {
  const storiesHtml = stories
    .map(
      (s) => `<div style="margin-bottom:24px;">
<h3><a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.headline}</a></h3>
<p><strong>${s.source}</strong> &middot; <em>${s.tag}</em></p>
<p>${s.summary}</p>
</div>`
    )
    .join("\n");

  return `<p><strong>${tldr}</strong></p>
<p><em>Top story: ${highlight}</em></p>
<hr />
${storiesHtml}`;
}

async function publishToWordPress(digest: {
  stories: any[];
  tldr: string;
  highlight: string;
}): Promise<{ published: boolean; wpPostId?: number; wpError?: string }> {
  const username = process.env.WORDPRESS_USERNAME;
  const password = process.env.WORDPRESS_APP_PASSWORD;

  if (!username || !password) {
    console.warn("[digest:wp] WORDPRESS_USERNAME or WORDPRESS_APP_PASSWORD not set — skipping publish");
    return { published: false, wpError: "WordPress credentials not configured" };
  }

  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = today.toLocaleString("en-GB", { month: "long" });
  const year = today.getFullYear();
  const dateLabel = `${day} ${month} ${year}`;

  const title = `AI in Media & Marketing: Today's Top Stories — ${dateLabel}`;
  const content = formatDigestAsHtml(digest.stories, digest.tldr, digest.highlight);
  const credentials = Buffer.from(`${username}:${password}`).toString("base64");

  try {
    const res = await fetch("https://representai.co.uk/wp-json/wp/v2/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({
        title,
        content,
        status: "publish",
        categories: [481],
        author: 9,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[digest:wp] Publish failed (${res.status}): ${text}`);
      return { published: false, wpError: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }

    const data = await res.json();
    console.log(`[digest:wp] Published post ID ${data.id}`);
    return { published: true, wpPostId: data.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[digest:wp] Publish error: ${message}`);
    return { published: false, wpError: message };
  }
}

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug") || "media-marketing";
  const db = supabaseAdmin();

  // Fetch the industry config
  const { data: industry, error: industryError } = await db
    .from("industries")
    .select("*")
    .eq("slug", slug)
    .single();

  if (industryError || !industry) {
    return NextResponse.json({ error: `Industry '${slug}' not found` }, { status: 404 });
  }

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const { data: pastDigests } = await db
    .from("digests")
    .select("stories")
    .eq("industry_slug", slug)
    .gte("created_at", threeDaysAgo.toISOString());

  const usedUrls = new Set<string>();
  const usedHeadlines: string[] = [];
  for (const row of pastDigests ?? []) {
    if (Array.isArray(row.stories)) {
      for (const story of row.stories) {
        if (story?.url) usedUrls.add(story.url);
        if (story?.headline) usedHeadlines.push(story.headline);
      }
    }
  }
  console.log(`[digest:${slug}] Exclusions: ${usedUrls.size} URLs, ${usedHeadlines.length} headlines (3d)`);

  const systemPrompt = buildSystemPrompt(industry.name, industry.focus, usedUrls, usedHeadlines);

  try {
    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: `Search the web and find the 5 most important and genuinely interesting AI news stories from the past 7 days relevant to the ${industry.name} industry. Be efficient — perform one targeted search per story needed, then return your results immediately. Do not perform more than 5 searches total. Return only the JSON object.`,
      },
    ];

    let response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: systemPrompt,
      tools: [WEB_SEARCH_TOOL],
      messages,
    });

    // Agentic search loop (capped at 5 iterations)
    let iterations = 0;
    while (response.stop_reason === "tool_use" && iterations++ < 5) {
      const assistantContent = response.content;
      messages.push({ role: "assistant", content: assistantContent });

      const toolResults: Anthropic.ToolResultBlockParam[] = assistantContent
        .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
        .map((toolUse) => ({
          type: "tool_result" as const,
          tool_use_id: toolUse.id,
          content: JSON.stringify({
            status: "search_executed",
            query: (toolUse.input as { query: string }).query,
          }),
        }));

      messages.push({ role: "user", content: toolResults });

      response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: systemPrompt,
        tools: [WEB_SEARCH_TOOL],
        messages,
      });
    }

    const rawText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const match = rawText.replace(/```[a-z]*/g, "").trim().match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ error: "Could not parse digest", raw: rawText }, { status: 500 });
    }

    const parsed = JSON.parse(match[0]);
    let { stories, tldr, highlight } = parsed;

    const beforeDedup = stories?.length ?? 0;
    stories = (stories ?? []).filter((s: any) => !usedUrls.has(s?.url));
    if (stories.length < beforeDedup) {
      console.warn(`[digest:${slug}] Dedup: filtered ${beforeDedup - stories.length} duplicate URL(s)`);
    }

    // Save to Supabase
    const { data: saved } = await db
      .from("digests")
      .insert({ industry_slug: slug, stories, tldr, highlight })
      .select()
      .single();

    // Publish to WordPress for media-marketing digest
    let wpResult: { published: boolean; wpPostId?: number; wpError?: string } = { published: false };
    if (slug === "media-marketing") {
      wpResult = await publishToWordPress({ stories, tldr, highlight });
    }

    return NextResponse.json({
      id: saved?.id,
      stories,
      tldr,
      highlight,
      generatedAt: new Date().toISOString(),
      wordpress: wpResult,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
