// Single place to choose the Claude model for every API route.
// Override without a code change by setting CLAUDE_MODEL in the environment.
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

// Sonnet 5.5 thinks by default, and thinking tokens count against max_tokens.
// Our routes use small max_tokens budgets, so keep thinking off like before.
// (Cast: the installed SDK version predates the "between_tools" type.)
export const CLAUDE_THINKING = { type: "between_tools" } as any;
