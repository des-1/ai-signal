import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const WEB_SEARCH_TOOL = { type: "web_search_20250305", name: "web_search" } as any;
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildSystemPrompt(industryName: string, focus: string) {
  return `You are an AI industry intelligence analyst for RepresentAI, a UK organisation focused on AI literacy across professional sectors. Your job is to find and curate the most important AI news stories from the past 7 days directly relevant to the ${industryName} industry.

Search focus areas:
${focus}

Return a JSON object with this exact structure — no preamble, no markdown, no backticks:
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
- summary: 2-3 sentences — what happened and why it matters for practitioners
- url: the actual article URL

Source rules:
- Prioritise freely accessible sources: TechCrunch, Reuters, BBC, Forbes, The Guardian, Wired, The Verge, VentureBeat, MIT Technology Review, Fast Company, AP News, Gov.uk, official company blogs
- Avoid paywalled sources (WSJ, NYT, The Economist)
- Never use PR Newswire, Business Wire, GlobeNewswire
- Prefer original reporting over aggregators

Return exactly 5 stories. Order by recency — most recent first.`;
}

async function fetchIndustryStories(industry: {
  name: string;
  slug: string;
  icon: string;
  focus: string;
}) {
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Search the web and find the 5 most important AI news stories from the past 7 days relevant to the ${industry.name} industry. Prioritise stories from today and yesterday. Use multiple searches. Return only the JSON object.`,
    },
  ];

  let response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: buildSystemPrompt(industry.name, industry.focus),
    tools: [WEB_SEARCH_TOOL],
    messages,
  });

  let iterations = 0;
  while (response.stop_reason === "tool_use" && iterations++ < 10) {
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
      max_tokens: 4096,
      system: buildSystemPrompt(industry.name, industry.focus),
      tools: [WEB_SEARCH_TOOL],
      messages,
    });
  }

  const rawText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const match = rawText.replace(/```[a-z]*/g, "").trim().match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Could not parse response for ${industry.name}`);

  const { stories, tldr, highlight } = JSON.parse(match[0]);
  return { slug: industry.slug, name: industry.name, icon: industry.icon, stories, tldr, highlight };
}

export async function GET() {
  const db = supabaseAdmin();

  const { data: industries, error } = await db
    .from("industries")
    .select("name, slug, icon, focus")
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (error || !industries || industries.length === 0) {
    return NextResponse.json({ error: "No active industries found" }, { status: 400 });
  }

  try {
    // Parallel API calls — one focused prompt per industry
    const industryResults = await Promise.all(industries.map(fetchIndustryStories));

    // Server-side deduplication by URL across all industries
    const seenUrls = new Set<string>();
    for (const ind of industryResults) {
      ind.stories = ind.stories.filter((s: any) => {
        if (!s.url || seenUrls.has(s.url)) return false;
        seenUrls.add(s.url);
        return true;
      });
    }

    // Parallel digest inserts
    await Promise.all(
      industryResults
        .filter((ind) => ind.stories.length > 0)
        .map((ind) =>
          db.from("digests").insert({
            industry_slug: ind.slug,
            stories: ind.stories,
            tldr: ind.tldr || "",
            highlight: ind.highlight || "",
          })
        )
    );

    // Build flat highlights stories with industry metadata
    const highlightStories = industryResults.flatMap((ind) =>
      ind.stories.map((s: any) => ({
        ...s,
        industry_name: ind.name,
        industry_slug: ind.slug,
        industry_icon: ind.icon || "globe",
      }))
    );

    const { data: saved } = await db
      .from("highlights")
      .insert({ stories: highlightStories })
      .select()
      .single();

    return NextResponse.json({
      id: saved?.id,
      stories: highlightStories,
      industryCount: industryResults.length,
      storyCount: highlightStories.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
