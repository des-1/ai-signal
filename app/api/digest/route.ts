import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are an AI media intelligence analyst for RepresentAI, a UK organisation focused on AI literacy in the creative industries. Find and curate the most important AI news stories from the past 7 days relevant to media, advertising, marketing, and creative professionals.

Return a JSON object (not an array) with this exact structure:
{
  "tldr": "2-3 sentence overview of the biggest theme or pattern across today's stories",
  "highlight": "the single most important headline this week in one sentence",
  "stories": [
    {"headline":"...","source":"...","tag":"...","summary":"...","url":"..."}
  ]
}

Story rules:
- headline: max 12 words, sharp and editorial
- source: the actual publication name
- tag: one of exactly: Advertising, Content, Search, Social, Generative AI, Tools, Regulation, Strategy
- summary: 2-3 sentences — what happened and why it matters for practitioners. Include enough context that a non-technical reader understands the significance.
- url: the actual article URL. This is required — always include it.

Cover a mix of tags. No preamble, no markdown, no backticks. Return only the JSON object.`;

const USER_PROMPT = `Search the web and find the 5 most important and genuinely interesting AI news stories from the past 7 days relevant to media, advertising, marketing, and creative industries. Use multiple searches to find the best stories. Return only the JSON array.`;

export async function GET() {
  try {
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: USER_PROMPT },
    ];

    // Agentic loop — Claude may do several web searches before answering
    let response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM,
      tools: [{ type: "web_search_20250305", name: "web_search" } as any],
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
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: SYSTEM,
        tools: [{ type: "web_search_20250305", name: "web_search" }] as any,
        messages,
      });
    }

    // Extract the JSON from the final text response
    const rawText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const match = rawText.replace(/```[a-z]*/g, "").trim().match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (!match) {
      return NextResponse.json({ error: "Could not parse digest", raw: rawText }, { status: 500 });
    }

    const parsed = JSON.parse(match[0]);
const stories = Array.isArray(parsed) ? parsed : parsed.stories;
const tldr = parsed.tldr || "";
const highlight = parsed.highlight || "";
return NextResponse.json({ stories, tldr, highlight, generatedAt: new Date().toISOString() });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
