import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { publishToWordPress, formatTop10AsHtml, todayLabel, TOP10_WP_CATEGORY } from "@/lib/wordpress";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const WEB_SEARCH_TOOL = { type: "web_search_20250305", name: "web_search" } as any;
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type IndustryRow = { name: string; slug: string; focus: string };
type PastStory = { url: string; headline: string; tag: string };

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
  {
    label: "Technology & AI",
    match: (n: string) => /tech|ai$|artificial/i.test(n),
    scope: "major AI company announcements from Anthropic, OpenAI, Google DeepMind, and Meta AI — new model releases, product launches, pricing changes, API updates, safety policy moves, or partnerships with clear business impact. Do NOT cover abstract research papers or benchmarks unless they announce a product or pricing change.",
  },
];

// ── JSON extraction helpers ──────────────────────────────────────────────────

function extractBalanced(text: string, open: string, close: string): string | null {
  const start = text.indexOf(open);
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
    if (ch === open || ch === "{" || ch === "[") depth++;
    else if (ch === close || ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function extractJsonArray(text: string): string | null {
  return extractBalanced(text, "[", "]");
}

function extractJsonObject(text: string): string | null {
  return extractBalanced(text, "{", "}");
}

function cleanRaw(text: string): string {
  return text.replace(/```[a-z]*\n?/g, "").replace(/```/g, "").trim();
}

function parseSingleStory(rawText: string, label: string): any | null {
  const cleaned = cleanRaw(rawText);
  // Try bare object first, then array[0]
  const objStr = extractJsonObject(cleaned);
  if (objStr) {
    try { return JSON.parse(objStr); } catch {}
  }
  const arrStr = extractJsonArray(cleaned);
  if (arrStr) {
    try {
      const arr = JSON.parse(arrStr);
      if (Array.isArray(arr) && arr.length > 0) return arr[0];
    } catch {}
  }
  console.error(`[top10] ${label}: no JSON found. Raw:`, rawText.slice(0, 400));
  return null;
}

function parseStories(rawText: string, label: string): any[] | null {
  const cleaned = cleanRaw(rawText);
  const jsonStr = extractJsonArray(cleaned);
  if (!jsonStr) {
    console.error(`[top10] ${label}: no JSON array found. Raw:`, rawText.slice(0, 400));
    return null;
  }
  const sanitised = jsonStr
    .replace(/,\s*\.\.\.\s*(?=[,\]])/g, "")
    .replace(/\[\s*\.\.\.\s*,\s*/g, "[");
  try {
    return JSON.parse(sanitised);
  } catch (e) {
    console.error(`[top10] ${label}: JSON.parse failed:`, sanitised.slice(0, 400));
    return null;
  }
}

// ── Agentic search loop ──────────────────────────────────────────────────────

async function runSearchLoop(systemPrompt: string, userPrompt: string, maxTokens: number, maxIterations = 5): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userPrompt }];

  let response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    system: systemPrompt,
    tools: [WEB_SEARCH_TOOL],
    messages,
  });

  let iterations = 0;
  while (response.stop_reason === "tool_use" && iterations++ < maxIterations) {
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
      max_tokens: maxTokens,
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

// ── Per-industry mandatory fetch ─────────────────────────────────────────────

function mandatorySystemPrompt(industry: typeof MANDATORY_INDUSTRIES[0], today: string, yesterday: string, industryPast: PastStory[]): string {
  const exclusionBlock = industryPast.length > 0
    ? `Do NOT cover these previously covered stories:\n${industryPast.map(s => `- ${s.headline} (${s.url})`).join("\n")}\n\n`
    : "";

  return `You are an AI news researcher. Find ONE important AI news story from the past 48 hours relevant to ${industry.label}.

Today is ${today}. Yesterday was ${yesterday}.

GEOGRAPHIC PRIORITY:
Actively seek out UK and European AI news alongside US stories. A good digest should include at least 2-3 stories from UK or European sources or about UK/EU companies, regulation, or organisations.

UK sources to prioritise: BBC, The Guardian, Financial Times (free articles), City A.M., Computing.co.uk, The Register, Sifted, UKTN, Gov.uk, TechMonitor.
EU/European sources: Euractiv, POLITICO Europe, EU AI Office announcements, European Parliament news.

UK/EU topics to actively search for alongside US news: UK AI regulation and government policy, EU AI Act implementation, UK fintech and legaltech, European AI startup funding, FTSE 100 AI adoption.

Focus: ${industry.scope}

${exclusionBlock}Return only a single valid JSON object, no array, no preamble, no markdown:
{"headline":"max 12 words","source":"Publication Name","tag":"${industry.label}","summary":"2-3 sentences for a non-technical reader","url":"article URL"}`;
}

async function fetchMandatoryStory(
  industry: typeof MANDATORY_INDUSTRIES[0],
  today: string,
  yesterday: string,
  recentStories: PastStory[],
): Promise<any> {
  const industryPast = recentStories
    .filter(s => industry.match(s.tag))
    .slice(-10);

  const userPrompt = `Search for a recent AI news story about ${industry.label}. Focus on ${today} or ${yesterday}. Be efficient — perform one targeted search, then return your result immediately. Do not perform more than 3 searches total.`;

  console.log(`[top10] [${industry.label}] Starting search`);
  const raw = await runSearchLoop(mandatorySystemPrompt(industry, today, yesterday, industryPast), userPrompt, 400, 3);
  const story = parseSingleStory(raw, `[${industry.label}]`);

  if (story?.headline && story?.url) {
    console.log(`[top10] [${industry.label}] Found: ${story.headline}`);
    return story;
  }

  // Retry without exclusions
  console.log(`[top10] [${industry.label}] Failed, retrying without exclusions`);
  const rawFallback = await runSearchLoop(mandatorySystemPrompt(industry, today, yesterday, []), userPrompt, 400, 3);
  const fallback = parseSingleStory(rawFallback, `[${industry.label}] fallback`);

  if (fallback?.headline && fallback?.url) {
    console.log(`[top10] [${industry.label}] Found: ${fallback.headline}`);
    return fallback;
  }

  console.warn(`[top10] [${industry.label}] Both attempts failed, using placeholder`);
  return { headline: `No ${industry.label} story found today`, source: "", tag: industry.label, summary: "", url: "" };
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  const db = supabaseAdmin();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const [{ data: industries }, { data: pastRuns }] = await Promise.all([
    db.from("industries").select("name, slug, focus").eq("active", true).order("created_at", { ascending: true }),
    db.from("top10").select("stories, created_at").gte("created_at", sevenDaysAgo.toISOString()).order("created_at", { ascending: true }),
  ]);

  const allUsedUrls = new Set<string>(); // 7-day, server-side dedup
  const recentStories: PastStory[] = [];  // 3-day, per-industry prompt exclusions

  for (const row of pastRuns ?? []) {
    const rowDate = new Date((row as any).created_at);
    if (Array.isArray(row.stories)) {
      for (const story of row.stories) {
        if (story?.url) {
          allUsedUrls.add(story.url);
          if (rowDate >= threeDaysAgo) {
            recentStories.push({ url: story.url, headline: story.headline || "", tag: story.tag || "" });
          }
        }
      }
    }
  }
  console.log("[top10] Exclusions:", recentStories.length, "recent stories (3d),", allUsedUrls.size, "URLs (7d)");

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

  try {
    // Step 1: 5 parallel mandatory industry calls
    console.log("[top10] Starting 5 parallel mandatory calls");
    const mandatoryResults = await Promise.all(
      MANDATORY_INDUSTRIES.map(ind => fetchMandatoryStory(ind, today, yesterday, recentStories))
    );
    const mandatoryReal = mandatoryResults.filter(s => s.url);
    console.log(`[top10] Mandatory complete: ${mandatoryReal.length}/5 stories found`);

    // Step 2: Remaining 5
    console.log("[top10] Starting remaining 5 call");
    const coveredTags = mandatoryReal.map((s: any) => s.tag).filter(Boolean).join(", ");
    const mandatoryHeadlines = mandatoryReal.map((s: any) => s.headline).join("\n");
    const top20RecentUrls = recentStories.slice(-20).map(s => s.url).join("\n");
    const industryList = remainingIndustries.length > 0
      ? remainingIndustries.map(ind => `- ${ind.name}${ind.focus ? `: ${ind.focus}` : ""}`).join("\n")
      : "- Energy\n- Construction\n- Logistics\n- Education\n- Engineering\n- Manufacturing\n- Retail\n- Technology";

    const remainingSystemPrompt = `You are an AI news researcher. Find 5 important AI news stories from the past 48 hours, each from a DIFFERENT industry from this list:
${industryList}

EXCEPTION — Major AI company announcements: Even if not listed above, always include a story from Anthropic, OpenAI, Google DeepMind, or Meta AI if they made a major announcement in the past 48 hours (new model, product launch, pricing change, significant policy move) with clear business or industry impact. This takes priority over filling a slot from the industry list.

Today is ${today}. Yesterday was ${yesterday}.

GEOGRAPHIC PRIORITY:
Actively seek out UK and European AI news alongside US stories. A good digest should include at least 2-3 stories from UK or European sources or about UK/EU companies, regulation, or organisations.

UK sources to prioritise: BBC, The Guardian, Financial Times (free articles), City A.M., Computing.co.uk, The Register, Sifted, UKTN, Gov.uk, TechMonitor.
EU/European sources: Euractiv, POLITICO Europe, EU AI Office announcements, European Parliament news.

UK/EU topics to actively search for alongside US news: UK AI regulation and government policy, EU AI Act implementation, UK fintech and legaltech, European AI startup funding, FTSE 100 AI adoption.

Stories already found (do not duplicate these topics):
${mandatoryHeadlines}

Previously covered URLs to avoid:
${top20RecentUrls}

Return a valid JSON array of exactly 5 stories:
[{"headline":"max 12 words","source":"Publication Name","tag":"industry name","summary":"2-3 sentences for a non-technical reader","url":"article URL"}]`;

    const remainingUserPrompt = `Find 5 AI news stories from 5 different industries. Do not use these already-covered industries: ${coveredTags}. Be efficient — perform one targeted search per industry, then return your results immediately. Do not perform more than 5 searches total.`;
    const raw2 = await runSearchLoop(remainingSystemPrompt, remainingUserPrompt, 2000);
    const remaining = parseStories(raw2, "remaining 5");
    if (!remaining) {
      console.warn("[top10] Remaining 5 call failed, saving mandatory stories only");
    }

    // Step 3: Merge and dedup by URL
    const allStories = [...mandatoryResults, ...(remaining ?? [])];
    const beforeDedup = allStories.length;
    let stories = allStories.filter((s: any) => s.url && !allUsedUrls.has(s.url));
    if (stories.length < beforeDedup) {
      console.warn(`[top10] Dedup: filtered ${beforeDedup - stories.length} story/stories`);
    }
    console.log(`[top10] Final count: ${stories.length} stories`);

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

    // Publish to WordPress
    const wpResult = await publishToWordPress({
      title: `Top 10 AI Stories Today — ${todayLabel()}`,
      content: formatTop10AsHtml(stories),
      categoryId: TOP10_WP_CATEGORY,
    });

    return NextResponse.json({
      id: saved?.id,
      stories,
      storyCount: stories.length,
      generatedAt: new Date().toISOString(),
      wordpress: wpResult,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
