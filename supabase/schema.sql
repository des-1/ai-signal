-- Run this in your Supabase SQL editor

-- Industries table
create table if not exists industries (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text not null unique,
  icon text not null default '📰',
  focus text not null,
  active boolean not null default true,
  created_at timestamptz default now()
);

-- Digests table
create table if not exists digests (
  id uuid default gen_random_uuid() primary key,
  industry_slug text not null references industries(slug) on delete cascade,
  stories jsonb not null,
  tldr text not null default '',
  highlight text not null default '',
  created_at timestamptz default now()
);

-- Pulse table (cross-industry observations)
create table if not exists pulses (
  id uuid default gen_random_uuid() primary key,
  content text not null,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists digests_industry_slug_idx on digests(industry_slug);
create index if not exists digests_created_at_idx on digests(created_at desc);

-- Disable RLS for internal tool (enable and configure if you need access control)
alter table industries disable row level security;
alter table digests disable row level security;
alter table pulses disable row level security;

-- Seed default industries
insert into industries (name, slug, icon, focus) values
(
  'Media & Marketing',
  'media-marketing',
  '📣',
  'AI advertising products from Google, Meta, TikTok and Amazon. Generative AI tools for creative production including video, image and copywriting. AI impact on SEO and search marketing. Agency and brand AI adoption stories. AI in social media platforms. Creative industry AI tools and workflows.'
),
(
  'Law & Legal',
  'law',
  '⚖️',
  'AI tools for legal research and document review. AI adoption at law firms and in-house legal teams. AI in courts and judicial systems. Contract analysis and drafting AI. Legal AI regulation and ethics. E-discovery AI. AI impact on paralegal and associate roles. LegalTech startup funding and launches.'
),
(
  'Finance',
  'finance',
  '📈',
  'AI in trading and investment management. AI fraud detection and risk management. Banking and financial services AI adoption. Fintech AI product launches. AI in wealth management and robo-advisory. Regulatory AI in financial services. AI impact on analyst and trader roles. FinTech startup funding and launches.'
)
on conflict (slug) do nothing;
