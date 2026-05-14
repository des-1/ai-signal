import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const WEB_SEARCH_TOOL = { type: "web_search_20250305", name: "web_search" } as any;
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DEFAULT_PROMPT =
  "Search for AI news stories published in the past 24-48 hours. Work through each mandatory industry one by one. For each one, run a targeted search before moving to the next.";

type IndustryRow = { name: string; slug: string; focus: string };

const MANDATORY_DEFS = [
  {
    label: "Finance & Banking",
    match: (n: string) => /finance|bank/i.test(n),
    qualifies:
      "banks, fintech companies, trading platforms, wealth management, insurance, payment providers, financial regulators, investment banks",
    doesNotQualify:
      "a story about another industry that happens to mention funding or investment",
  },
  {
    label: "Law & Legal",
    match: (n: string) => /law|legal/i.test(n),
    qualifies:
      "law firms, courts, legal technology, regulation affecting the legal profession, bar associations, in-house legal teams",
  },
  {
    label: "Healthcare & Pharmaceutical",
    match: (n: string) => /health|pharma|medical/i.test(n),
    qualifies:
      "hospitals, clinical trials, medical devices, patient care, pharmaceutical companies, health insurers, medical regulators like FDA or MHRA",
  },
  {
    label: "Media & Marketing",
    match: (n: string) => /media|market|advertis/i.test(n),
    qualifies:
      "advertising platforms, agencies, brands, content creation, social media platforms in an advertising context, publishers",
  },
  {
    label: "Defense & Security",
    match: (n: string) => /defense|defence|security|military/i.test(n),
    qualifies:
      "military, defence contractors, national security agencies, cybersecurity companies, intelligence services",
  },
];

function extractJsonArray(text: string): string | null {
  const start = text.indexOf("[");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "[" || ch === "{") depth++;
    else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function buildSystemPrompt(industries: IndustryRow[]): string {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().split("T")[0];

  const mandatoryLines = MANDATORY_DEFS.map((def, i) => {
    const match = industries.find((ind) => def.match(ind.name));
    const focusLine = match?.focus
      ? `   Focus areas from RepresentAI: ${match.focus}`
      : "";
    const dontLine = def.doesNotQualify
      ? `   Does NOT qualify: ${def.doesNotQualify}`
      : "";
    return [
      `${i + 1}. ${def.label}`,
      `   Qualifies: ${def.qualifies}.`,
      focusLine,
      dontLine,
    ]
      .filter(Boolean)
      .join("\n");
  });

  const mandatorySlugs = new Set(
    MANDATORY_DEFS.map((def) => industries.find((ind) => def.match(ind.name))?.slug).filter(Boolean)
  );

  const remainingIndustries = industries.filter((ind) => !mandatorySlugs.has(ind.slug));

  const remainingLines = remainingIndustries
    .map((ind) => `- ${ind.name}: ${ind.focus}`)
    .join("\n");

  return `You are a strict AI news curator for RepresentAI, a UK organisation focused on AI literacy for business professionals. Your job is to find and return exactly 10 AI news stories.

TODAY'S DATE: ${today}
ACCEPTABLE PUBLICATION DATES: ${yesterday} or ${today} only.
Before including any story, check its publication date. If it was published before ${yesterday}, do not include it — keep searching until you find a more recent story. The only exception is mandatory industries (Step 1) where nothing recent exists; in that case you may go back up to 7 days, but you must add "(this week)" to the end of the headline.

STEP 1 — MANDATORY INDUSTRIES (fill these first, in order):
You MUST find exactly one story for each of the 5 industries below before doing anything else. Search specifically for each one. Do not move to the next until you have found a qualifying story published on ${today} or ${yesterday}.

${mandatoryLines.join("\n\n")}

STEP 2 — REMAINING 5 STORIES:
Fill the remaining 5 slots with the best AI stories from the industries listed below. Each story must come from a DIFFERENT industry. Do not repeat any industry already used in Step 1.

Available industries and focus areas:
${remainingLines || "Energy, Construction, Logistics, Education, Engineering, Manufacturing, Retail, Technology — pick the best 5 stories from distinct industries."}

STEP 3 — SELF-CHECK (mandatory before responding):
Before returning your answer, verify each item:
□ Exactly 5 mandatory industries covered, one story each
□ Exactly 5 additional stories from 5 different industries
□ No industry appears more than once across all 10 stories
□ No two stories cover the same event or announcement
□ Every story URL is freely accessible (no paywalls)
□ Every story was published on ${today} or ${yesterday} — any older story must be excluded unless it is a mandatory industry fallback, in which case the headline ends with "(this week)"
□ Total stories = exactly 10

If any check fails, fix it before responding. Do not return the JSON until all checks pass.

SOURCE RULES:
- Only freely accessible sources: TechCrunch, Reuters, BBC, Forbes, The Guardian, Wired, The Verge, VentureBeat, MIT Technology Review, Fast Company, AP News, Gov.uk, official company blogs and press releases
- Never use: Wall Street Journal, New York Times, The Economist, or any source requiring login or subscription
- Never use: PR Newswire, Business Wire, GlobeNewswire
- Prefer original reporting over aggregators

OUTPUT FORMAT:
Return only a valid JSON array. No preamble, no markdown, no backticks, no ellipsis placeholders (do not use ... anywhere in the JSON).
[
  {
    "headline": "max 12 words, sharp and editorial",
    "source": "Publication Name",
    "tag": "exact industry name matching one of the industries listed above",
    "summary": "2-3 sentences — what happened and why it matters for business professionals. Include enough context for a non-technical reader.",
    "url": "actual article URL"
  }
]`;
}

export async function GET() {
  const db = supabaseAdmin();

  const [{ data: config }, { data: industries }] = await Promise.all([
    db.from("top10_config").select("prompt").eq("id", 1).maybeSingle(),
    db.from("industries").select("name, slug, focus").eq("active", true).order("created_at", { ascending: true }),
  ]);

  const userPrompt = config?.prompt || DEFAULT_PROMPT;
  const systemPrompt = buildSystemPrompt((industries as IndustryRow[]) || []);

  console.log("[top10] Building prompt with", industries?.length ?? 0, "industries");

  try {
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: userPrompt },
    ];

    let response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      tools: [WEB_SEARCH_TOOL],
      messages,
    });

    let iterations = 0;
    while (response.stop_reason === "tool_use" && iterations++ < 15) {
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
        system: systemPrompt,
        tools: [WEB_SEARCH_TOOL],
        messages,
      });
    }

    const rawText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const cleaned = rawText.replace(/```[a-z]*\n?/g, "").replace(/```/g, "").trim();
    const jsonStr = extractJsonArray(cleaned);
    if (!jsonStr) {
      console.error("[top10] Could not find JSON array. Raw text:", rawText);
      return NextResponse.json({ error: "Could not parse stories", raw: rawText }, { status: 500 });
    }

    // Strip ellipsis placeholders Claude sometimes inserts (e.g. [..., ..., {real}] or field: "...")
    const sanitised = jsonStr
      .replace(/,\s*\.\.\.\s*(?=[,\]])/g, "")  // trailing ellipsis entries: , ...
      .replace(/\[\s*\.\.\.\s*,\s*/g, "[");      // leading ellipsis entries: [... ,

    let stories: any[];
    try {
      stories = JSON.parse(sanitised);
    } catch (parseErr) {
      console.error("[top10] JSON.parse failed. Extracted:", sanitised.slice(0, 800));
      return NextResponse.json({ error: `JSON parse error: ${(parseErr as Error).message}`, raw: rawText }, { status: 500 });
    }
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
