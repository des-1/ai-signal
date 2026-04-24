import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function GET() {
  const db = supabaseAdmin();

  // Get most recent digest for each active industry
  const { data: industries } = await db
    .from("industries")
    .select("slug, name")
    .eq("active", true);

  if (!industries || industries.length < 2) {
    return NextResponse.json({ error: "Need at least 2 industries for a pulse" }, { status: 400 });
  }

  // Fetch latest digest per industry
  const summaries: string[] = [];
  for (const industry of industries) {
    const { data: digest } = await db
      .from("digests")
      .select("tldr, highlight, stories")
      .eq("industry_slug", industry.slug)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (digest) {
      summaries.push(`${industry.name}: ${digest.highlight || digest.tldr}`);
    }
  }

  if (summaries.length < 2) {
    return NextResponse.json({
      content: "Generate digests for at least two industries to see the cross-industry pulse.",
    });
  }

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 150,
      messages: [
        {
          role: "user",
          content: `You are a sharp industry analyst. Based on these AI news highlights from different industries, write one concise observation (max 2 sentences) spotting a theme, pattern or tension that cuts across them. Be specific and insightful — not generic.

${summaries.join("\n")}

Return only the observation text, no preamble.`,
        },
      ],
    });

    const content =
      response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text || "";

    // Save to Supabase
    await db.from("pulses").insert({ content });

    return NextResponse.json({ content });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
