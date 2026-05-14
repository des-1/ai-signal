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

MANDATORY INDUSTRY COVERAGE - this is non-negotiable:
You MUST include at least one story specifically about each of these industries:
1. Finance & Banking — must be about banks, fintech, trading, wealth management or financial services AI. A drug discovery funding story does NOT count.
2. Law & Legal — AI in law firms, courts, legal tools
3. Healthcare & Pharmaceutical — AI in hospitals, clinical trials, medical devices, patient care
4. Media & Marketing — AI in advertising, content creation, social platforms
5. Defense & Security — AI in military, cybersecurity, national security

These 5 mandatory slots must be filled first before selecting any other stories. If you cannot find a story from one of these industries in the past 24 hours, use the most recent story from that industry even if it is a few days old.

If you have filled all 5 mandatory slots and still have 5 remaining stories, fill those with the best stories from any other industries such as energy, construction, logistics, education, engineering, manufacturing, retail, or technology.

Do not tag a story with an industry label that does not match its actual content.

Variety rules — CRITICAL:
- Maximum 2 stories from any single industry or topic area across all 10 stories
- No two stories may cover the same event or announcement from different angles — if Reuters and TechCrunch both cover the same OpenAI announcement, pick one
- Actively seek variety: if you already have 2 finance stories, skip the next finance story in favour of a different industry
- Prioritise breadth over depth — the goal is to cover as many different industries and topics as possible
- Do not cluster stories around a single theme (e.g. do not pick 3 stories all about AI regulation, or 3 stories all about foundation models)

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
      console.error("[top10] Could not parse JSON array from response. Raw text:", rawText.slice(0, 500));
      return NextResponse.json({ error: "Could not parse stories", raw: rawText }, { status: 500 });
    }

    const stories = JSON.parse(match[0]);
    console.log("[top10] Parsed", stories.length, "stories:", stories.map((s: any) => s.headline));

    const { data: saved, error: insertError } = await db
      .from("top10")
      .insert({ stories })
      .select()
      .single();

    if (insertError) {
      console.error("[top10] Supabase insert error:", insertError);
      return NextResponse.json({ error: `DB insert failed: ${insertError.message}` }, { status: 500 });
    }

    console.log("[top10] Saved to DB with id:", saved?.id);

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
