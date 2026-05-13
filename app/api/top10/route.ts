import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const WEB_SEARCH_TOOL = { type: "web_search_20250305", name: "web_search" } as any;
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DEFAULT_PROMPT =
  "Find the 10 most important AI stories from the past 24 hours that are directly relevant to business professionals and decision-makers across industries including law, finance, healthcare, media, marketing, energy, construction, logistics, education, defense, engineering, manufacturing and retail. Focus on AI adoption by businesses and organisations, regulatory changes affecting industries, AI tools changing professional workflows, and major funding or partnerships. Avoid academic research, developer tools, and generic AI model benchmarks unless they have clear business implications.";

const SYSTEM_PROMPT = `You are an AI news analyst for RepresentAI, a UK organisation focused on AI literacy across professional sectors. Your job is to find and curate exactly 10 of the most important AI news stories from the past 24 hours that are directly relevant to business professionals.

Return a JSON array with exactly 10 items — no preamble, no markdown, no backticks:
[
  {"headline":"...","source":"...","tag":"...","summary":"...","url":"..."}
]

Story rules:
- headline: max 12 words, sharp and editorial
- source: the actual publication name
- tag: one of exactly: Advertising, Content, Search, Social, Generative AI, Tools, Regulation, Strategy, Legal, Finance, Risk
- summary: 2-3 sentences — what happened and why it matters for business professionals. Include enough context that a non-technical reader understands the significance.
- url: the actual article URL — always include it

Source rules — critical:
- Prioritise freely accessible sources: TechCrunch, Reuters, BBC, Forbes, The Guardian, Bloomberg (free articles), Wired, The Verge, Ars Technica, Fast Company, MIT Technology Review, VentureBeat, Business Insider, AP News, Financial Times (free), Gov.uk, official company blogs and press releases
- Avoid paywalled sources: Wall Street Journal, New York Times, The Economist, and any source requiring a subscription or login
- Never use PR Newswire, Business Wire, GlobeNewswire
- Prefer original reporting over aggregators

Return exactly 10 stories. Order by importance — most impactful first.`;

export async function GET() {
  const db = supabaseAdmin();

  const { data: config } = await db
    .from("top10_config")
    .select("prompt")
    .eq("id", 1)
    .maybeSingle();

  const userPrompt = config?.prompt || DEFAULT_PROMPT;

  try {
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: userPrompt },
    ];

    let response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
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
        system: SYSTEM_PROMPT,
        tools: [WEB_SEARCH_TOOL],
        messages,
      });
    }

    const rawText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const match = rawText.replace(/```[a-z]*/g, "").trim().match(/\[[\s\S]*\]/);
    if (!match) {
      return NextResponse.json({ error: "Could not parse stories", raw: rawText }, { status: 500 });
    }

    const stories = JSON.parse(match[0]);

    const { data: saved } = await db
      .from("top10")
      .insert({ stories })
      .select()
      .single();

    return NextResponse.json({
      id: saved?.id,
      stories,
      storyCount: stories.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
