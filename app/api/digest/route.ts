import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

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

  try {
    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: `Search the web and find the 5 most important and genuinely interesting AI news stories from the past 7 days relevant to the ${industry.name} industry. Use multiple searches to cover different angles. Return only the JSON object.`,
      },
    ];

    let response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: buildSystemPrompt(industry.name, industry.focus),
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
    if (!match) {
      return NextResponse.json({ error: "Could not parse digest", raw: rawText }, { status: 500 });
    }

    const parsed = JSON.parse(match[0]);
    const { stories, tldr, highlight } = parsed;

    // Save to Supabase
    const { data: saved } = await db
      .from("digests")
      .insert({ industry_slug: slug, stories, tldr, highlight })
      .select()
      .single();

    return NextResponse.json({
      id: saved?.id,
      stories,
      tldr,
      highlight,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
