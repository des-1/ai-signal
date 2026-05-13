import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const WEB_SEARCH_TOOL = { type: "web_search_20250305", name: "web_search" } as any;
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildSystemPrompt(industries: { name: string; slug: string; focus: string }[]) {
  const industryList = industries
    .map((ind, i) => `${i + 1}. ${ind.name}: ${ind.focus}`)
    .join("\n");

  return `You are an AI industry intelligence analyst for RepresentAI, a UK organisation focused on AI literacy across professional sectors.

Your task is to find the 5 most important AI news stories from the past 7 days for EACH of the following industries. Use each industry's focus areas to guide your searches.

Industries:
${industryList}

CRITICAL RULES:
- Prioritise stories from today and yesterday above all others
- Every story URL must be unique across the ENTIRE response — no story can appear under more than one industry
- If the same story is relevant to multiple industries, assign it to the most relevant one only
- Only use freely accessible sources: TechCrunch, Reuters, BBC, Forbes, The Guardian, Wired, The Verge, VentureBeat, MIT Technology Review, Fast Company, AP News, Gov.uk, official press releases and company blogs
- Never use paywalled sources (WSJ, NYT, The Economist) or press release wires (PR Newswire, Business Wire, GlobeNewswire)
- Prefer original reporting over aggregators

Return a JSON object with this exact structure — no preamble, no markdown, no backticks:
{
  "industries": [
    {
      "slug": "industry-slug",
      "name": "Industry Name",
      "stories": [
        {
          "headline": "max 12 words, sharp and editorial",
          "source": "Publication Name",
          "tag": "one of: Advertising, Content, Search, Social, Generative AI, Tools, Regulation, Strategy, Legal, Finance, Risk",
          "summary": "2-3 sentences — what happened and why it matters for practitioners",
          "url": "actual article URL"
        }
      ],
      "tldr": "2-3 sentence overview of this industry's week",
      "highlight": "single most important story in one sentence"
    }
  ]
}

Return exactly 5 stories per industry. Order stories by recency — most recent first.`;
}

export async function GET() {
  const db = supabaseAdmin();

  // Fetch all active industries
  const { data: industries, error } = await db
    .from("industries")
    .select("name, slug, icon, focus")
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (error || !industries || industries.length === 0) {
    return NextResponse.json({ error: "No active industries found" }, { status: 400 });
  }

  try {
    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: `Search the web and find the 5 most important AI news stories from the past 7 days for each of the ${industries.length} industries listed. Prioritise stories from today and yesterday. Ensure no story URL is duplicated across industries. Use multiple targeted searches per industry. Return only the JSON object.`,
      },
    ];

    let response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      system: buildSystemPrompt(industries),
      tools: [WEB_SEARCH_TOOL],
      messages,
    });

    // Agentic search loop
    while (response.stop_reason === "tool_use") {
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
        max_tokens: 8000,
        system: buildSystemPrompt(industries),
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
      return NextResponse.json({ error: "Could not parse response", raw: rawText }, { status: 500 });
    }

    const parsed = JSON.parse(match[0]);
    const industryResults = parsed.industries as {
      slug: string;
      name: string;
      stories: any[];
      tldr: string;
      highlight: string;
    }[];

    // Server-side deduplication by URL across all industries
    const seenUrls = new Set<string>();
    for (const ind of industryResults) {
      ind.stories = ind.stories.filter((s) => {
        if (!s.url || seenUrls.has(s.url)) return false;
        seenUrls.add(s.url);
        return true;
      });
    }

    // Save each industry as a standard digest
    for (const ind of industryResults) {
      if (ind.stories.length === 0) continue;
      await db.from("digests").insert({
        industry_slug: ind.slug,
        stories: ind.stories,
        tldr: ind.tldr || "",
        highlight: ind.highlight || "",
      });
    }

    // Build highlights stories — all stories with industry metadata attached
    const highlightStories = industryResults.flatMap((ind) => {
      const industry = industries.find((i) => i.slug === ind.slug);
      return ind.stories.map((s) => ({
        ...s,
        industry_name: ind.name,
        industry_slug: ind.slug,
        industry_icon: industry?.icon || "globe",
      }));
    });

    // Save to highlights table
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
