import { createClient } from "@supabase/supabase-js";

export type Industry = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  focus: string;
  active: boolean;
  created_at: string;
};

export type Story = {
  headline: string;
  source: string;
  tag: string;
  summary: string;
  url: string;
};

export type DigestRecord = {
  id: string;
  industry_slug: string;
  stories: Story[];
  tldr: string;
  highlight: string;
  created_at: string;
};

export type Pulse = {
  id: string;
  content: string;
  created_at: string;
};

// Client-side Supabase client (uses anon key)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Server-side Supabase client (uses service role key — only use in API routes)
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export const TAG_ICONS: Record<string, string> = {
  Advertising: "📢",
  Content: "✍️",
  Search: "🔍",
  Social: "📱",
  "Generative AI": "🤖",
  Tools: "🛠️",
  Regulation: "⚖️",
  Strategy: "📊",
};
