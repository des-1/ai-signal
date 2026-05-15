import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const WEB_SEARCH_TOOL = { type: "web_search_20250305", name: "web_search" } as any;
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type IndustryRow = { name: string; slug: string; focus: string };

const MANDATORY_INDUSTRIES = [
  {
    label: "Finance & Banking",
    match: (n: string) => /finance|bank/i.test(n),
    scope: "banks, fintech, trading platforms, wealth management, insurance, payment providers — not just any story mentioning funding",
  },
  {
    label: "Law & Legal",
    match: (n: string) => /law|legal/i.test(n),
    scope: "law firms, courts, legal technology, regulation affecting the legal profession, bar associations",
  },
  {
    label: "Healthcare & Pharmaceutical",
    match: (n: string) => /health|pharma|medical/i.test(n),
    scope: "hospitals, clinical trials, medical devices, patient care, pharmaceutical companies, health insurers, FDA/MHRA",
  },
  {
    label: "Media & Marketing",
    match: (n: string) => /media|market|advertis/i.test(n),
    scope: "advertising platforms, agencies, brands, content creation, social media in an advertising context, publishers",
  },
  {
    label: "Defense & Security",
    match: (n: string) => /defense|defence|security|military/i.test(n),
    scope: "military, defence contractors, national security agencies, cybersecurity companies, intelligence services",
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

function buildSystemPrompt(today: string, yesterday: string, usedUrls: Set<string>, usedHeadlines: string[]): string {
  const exclusions = (usedUrls.size > 0 || usedHeadlines.length > 0)
    ? `Previously covered stories — skip any event matching these, even from a different source:
Headlines: ${usedHeadlines.join(" | ")}
URLs:
${Array.from(usedUrls).join("\n")}

`
    : "";

  return `You are an AI news curator for RepresentAI, finding recent AI news for UK business professionals.

Prioritise stories from ${today} and ${yesterday}. If nothing recent exists for an industry, use the most recent story available from the past 7 days.
Sources: TechCrunch, Reuters, BBC, Forbes, The Guardian, Wired, The Verge, VentureBeat, MIT Technology Review, Fast Company, AP News, company blogs. No paywalls. Never use PR Newswire, Business Wire, or GlobeNewswire.

${exclusions}Return ONLY a valid JSON array — no markdown, no preamble, no backticks:
[{"headline":"max 12 words","source":"Publication Name","tag":"industry name","summary":"2-3 sentences for a non-technical reader","url":"article URL"}]`;
}

async function runSearchLoop(systemPrompt: string, userPrompt: string): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userPrompt }];

  let response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
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
      max_tokens: 4000,
      system: systemPrompt,
      tools: [WEB_SEARCH_TOOL],
      messages,
    });
  }

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function parseStories(rawText: string, label: string): any[] | null {
  const cleaned = rawText.replace(/```[a-z]*\n?/g, "").replace(/```/g, "").trim();
  const jsonStr = extractJsonArray(cleaned);
  if (!jsonStr) {
    console.error(`[top10] ${label}: no JSON array found. Raw:`, rawText.slice(0, 500));
    return null;
  }
  const sanitised = jsonStr
    .replace(/,\s*\.\.\.\s*(?=[,\]])/g, "")
    .replace(/\[\s*\.\.\.\s*,\s*/g, "[");
  try {
    return JSON.parse(sanitised);
  } catch (e) {
    console.error(`[top10] ${label}: JSON.parse failed:`, sanitised.slice(0, 500));
    return null;
  }
}

export async function GET() {
  const db = supabaseAdmin();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const [{ data: industries }, { data: pastRuns }] = await Promise.all([
    db.from("industries").select("name, slug, focus").eq("active", true).order("created_at", { ascending: true }),
    db.from("top10").select("stories, created_at").gte("created_at", sevenDaysAgo.toISOString()),
  ]);

  // 7-day set for server-side dedup; 3-day sets for prompt exclusions
  const usedUrls = new Set<string>();
  const usedUrlsForPrompt = new Set<string>();
  const usedHeadlines: string[] = [];
  for (const row of pastRuns ?? []) {
    const rowDate = new Date((row as any).created_at);
    if (Array.isArray(row.stories)) {
      for (const story of row.stories) {
        if (story?.url) {
          usedUrls.add(story.url);
          if (rowDate >= threeDaysAgo) usedUrlsForPrompt.add(story.url);
        }
        if (story?.headline && rowDate >= threeDaysAgo) usedHeadlines.push(story.headline);
      }
    }
  }
  console.log("[top10] Exclusions — prompt:", usedUrlsForPrompt.size, "URLs,", usedHeadlines.length, "headlines (3d); dedup:", usedUrls.size, "URLs (7d)");

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().split("T")[0];

  const allIndustries = (industries as IndustryRow[]) || [];
  const mandatorySlugs = new Set(
    MANDATORY_INDUSTRIES.map(def => allIndustries.find(ind => def.match(ind.name))?.slug).filter(Boolean)
  );
  const remainingIndustries = allIndustries.filter(ind => !mandatorySlugs.has(ind.slug));

  const systemPrompt = buildSystemPrompt(today, yesterday, usedUrlsForPrompt, usedHeadlines);

  try {
    // Call 1: Mandatory 5 industries
    const mandatoryList = MANDATORY_INDUSTRIES
      .map(ind => `- ${ind.label}: ${ind.scope}`)
      .join("\n");
    const call1Prompt = `Find one AI news story for each of these 5 industries. Run a separate web search for each before moving to the next. Return a JSON array of exactly 5 stories.\n\n${mandatoryList}`;

    console.log("[top10] Call 1: mandatory 5");
    const raw1 = await runSearchLoop(systemPrompt, call1Prompt);
    console.log("[top10] Call 1 raw response:", raw1.slice(0, 1000));
    let mandatory = parseStories(raw1, "Call 1");
    if (!mandatory) {
      return NextResponse.json({ error: "Could not parse mandatory stories", raw: raw1 }, { status: 500 });
    }
    console.log("[top10] Call 1:", mandatory.length, "stories:", mandatory.map((s: any) => s.headline));

    if (mandatory.length < 5) {
      const returnedTags = mandatory.map((s: any) => s.tag).filter(Boolean);
      const missingIndustries = MANDATORY_INDUSTRIES
        .filter(ind => !returnedTags.some((t: string) => ind.match(t)))
        .map(ind => ind.label);
      console.warn(`[top10] Call 1 only returned ${mandatory.length}/5. Tags: [${returnedTags.join(", ")}]. Missing: [${missingIndustries.join(", ")}]`);
      console.log("[top10] Call 1 fallback: retrying without exclusion list");
      const fallbackPrompt = buildSystemPrompt(today, yesterday, new Set(), []);
      const rawFallback = await runSearchLoop(fallbackPrompt, call1Prompt);
      console.log("[top10] Call 1 fallback raw:", rawFallback.slice(0, 1000));
      const fallbackStories = parseStories(rawFallback, "Call 1 fallback");
      if (fallbackStories && fallbackStories.length > mandatory.length) {
        console.log("[top10] Call 1 fallback improved result:", fallbackStories.length, "stories");
        mandatory = fallbackStories;
      }
    }

    // Call 2: Remaining 5 from other industries
    const coveredTags = mandatory.map((s: any) => s.tag).filter(Boolean).join(", ");
    const industryList = remainingIndustries.length > 0
      ? remainingIndustries.map(ind => `- ${ind.name}${ind.focus ? `: ${ind.focus}` : ""}`).join("\n")
      : "- Energy\n- Construction\n- Logistics\n- Education\n- Engineering\n- Manufacturing\n- Retail\n- Technology";
    const call2Prompt = `These 5 stories have already been found:\n${JSON.stringify(mandatory.map((s: any) => ({ headline: s.headline, tag: s.tag })))}\n\nFind 5 more AI news stories, one each from 5 DIFFERENT industries in the list below. Do not repeat the already-covered industries (${coveredTags}). Return a JSON array of exactly 5 stories.\n\n${industryList}`;

    console.log("[top10] Call 2: remaining 5, excluding:", coveredTags);
    const raw2 = await runSearchLoop(systemPrompt, call2Prompt);
    const remaining = parseStories(raw2, "Call 2");
    if (!remaining) {
      return NextResponse.json({ error: "Could not parse remaining stories", raw: raw2 }, { status: 500 });
    }
    console.log("[top10] Call 2:", remaining.length, "stories:", remaining.map((s: any) => s.headline));

    // Merge and dedup by URL
    let stories = [...mandatory, ...remaining];
    const beforeDedup = stories.length;
    stories = stories.filter((s: any) => !usedUrls.has(s?.url));
    if (stories.length < beforeDedup) {
      console.warn(`[top10] Dedup: filtered ${beforeDedup - stories.length} duplicate URL(s)`);
    }
    console.log("[top10] Final:", stories.length, "stories");

    const { data: saved, error: insertError } = await db
      .from("top10")
      .insert({ stories })
      .select()
      .single();

    if (insertError) {
      console.error("[top10] Supabase insert error:", insertError);
      return NextResponse.json({ error: `DB insert failed: ${insertError.message}` }, { status: 500 });
    }

    console.log("[top10] Saved id:", saved?.id);
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
