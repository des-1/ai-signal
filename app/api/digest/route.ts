import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are an AI media intelligence analyst for RepresentAI, a UK organisation focused on AI literacy in the creative industries. Your job is to find and curate the most important AI news stories from the past 7 days that are directly relevant to media, advertising, marketing, and creative professionals.

Search for recent news across these angles:
- AI advertising products from Google, Meta, TikTok, Amazon
- Generative AI tools for creative production (video, image, copy)
- AI's impact on SEO and search marketing
- Agency and brand AI adoption stories
- UK/EU AI regulation affecting media companies
- AI in social media platforms

Return exactly 5 stories as a valid JSON array. No preamble, no markdown, no backticks. Format:
[{"headline":"...","source":"...","tag":"...","summary":"...","url":"..."}]

Rules:
- headline: max 12 words, sharp and editorial
- source: the actual publication name
- tag: one of exactly: Advertising, Content, Search, Social, Generative AI, Tools, Regulation, Strategy
- summary: 2 sentences — what happened and why it matters for practitioners
- url: the actual article URL if found, otherwise ""`;

const USER_PROMPT = `Search the web and find the 5 most important and genuinely interesting AI news stories from the past 7 days relevant to media, advertising, marketing, and creative industries. Use multiple searches to find the best stories. Return only the JSON array.`;

export async function GET() {
  try {
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: USER_PROMPT },
    ];

    // Agentic loop — Claude may do several web searches before answering
    let response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM,
      tools: [{ type: "web_search_20250305" as "web_search_20250305", name: "web_search" }],
      messages,
    });

    // Handle tool use loop
    while (response.stop_reason === "tool_use") {
      const assistantContent = response.content;
      messages.push({ role: "assistant", content: assistantContent });

      const toolResults: Anthropic.ToolResultBlockParam[] = assistantContent
        .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
        .map((toolUse) => ({
          type: "tool_result" as const,
          tool_use_id: toolUse.id,
          content: JSON.stringify({ status: "search_executed", query: (toolUse.input as { query: string }).query }),
        }));

      messages.push({ role: "user", content: toolResults });

      response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: SYSTEM,
        tools: [{ type: "web_search_20250305" as "web_search_20250305", name: "web_search" }],
        messages,
      });
    }

    // Extract the JSON from the final text response
    const rawText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const match = rawText.replace(/```[a-z]*/g, "").trim().match(/\[[\s\S]*\]/);
    if (!match) {
      return NextResponse.json({ error: "Could not parse digest", raw: rawText }, { status: 500 });
    }

    const stories = JSON.parse(match[0]);
    return NextResponse.json({ stories, generatedAt: new Date().toISOString() });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
