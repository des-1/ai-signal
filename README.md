# AI Signal — Multi-Industry Intelligence

AI news digests across industries for RepresentAI. Powered by Claude with live web search, backed by Supabase.

## Features

### Industry Digests (`/digest/[slug]`)
- Per-industry digest of the 5 most important AI stories from the past 7 days
- TL;DR summary and a single highlight story per digest
- Archive of previous digests — browse without regenerating
- Cross-industry pulse — spots themes across all industries (near-zero tokens)
- Tag frequency chart — see which topics are dominating over time
- Fresh/Stale indicator — know when a digest needs regenerating
- Shareable URLs — each industry has its own page

### Top 10 Daily News (`/top10`)
- Daily cross-industry Top 10 sourced from the past 48 hours
- 5 mandatory industry slots (Finance & Banking, Law & Legal, Healthcare & Pharmaceutical, Media & Marketing, Defense & Security) fetched in parallel — each sector always represented
- 5 additional stories from the remaining configured industries
- 7-day URL deduplication — the same story never appears twice across runs
- Select stories and copy a formatted WhatsApp roundup to the clipboard
- Fresh/Stale indicator (12-hour window)

### Geographic bias
Both digest and top10 prompts actively prioritise UK and European stories alongside US news, targeting at least 2–3 stories per run from UK/EU sources (BBC, The Guardian, FT, The Register, Sifted, Euractiv, POLITICO Europe, EU AI Office, etc.) and topics (UK AI regulation, EU AI Act, UK fintech/legaltech, European AI startup funding, FTSE 100 AI adoption).

### Admin (`/admin`)
- Add/remove industries with custom name, icon, and search focus
- No redeployment needed — changes take effect immediately

## Setup

### 1. Supabase
Create a new project at supabase.com (or use your existing one).

Run `supabase/schema.sql` in the Supabase SQL editor. This creates the `industries`, `digests`, `pulse`, and `top10` tables and seeds the default industries.

Get your keys from: Project Settings → API:
- `NEXT_PUBLIC_SUPABASE_URL` = Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` = service_role key (keep this secret)

### 2. Anthropic
Get an API key from console.anthropic.com:
- `ANTHROPIC_API_KEY` = your API key

### 3. Local development
```bash
cp .env.local.example .env.local
# Fill in all four keys
npm install
npm run dev
```

### 4. Deploy to Vercel
Push to GitHub, connect at vercel.com/new.

Add all four environment variables in Vercel:
Project → Settings → Environment Variables

### 5. Done
- Homepage: `/`
- Daily Top 10: `/top10`
- Industry digest: `/digest/media-marketing`, `/digest/law`, `/digest/finance`
- Admin: `/admin`

## Adding a new industry
Go to `/admin` → fill in name, icon, and focus areas → Add industry.
The new tab appears on the homepage immediately. No redeployment needed.

## Architecture

```
app/
  page.tsx                        — dashboard homepage
  top10/page.tsx                  — Top 10 daily news page (client, WhatsApp export)
  digest/[slug]/page.tsx          — industry digest page
  admin/page.tsx                  — admin panel
  api/
    top10/route.ts                — generates daily Top 10; 5 parallel mandatory calls + 5 remaining
    digest/route.ts               — generates per-industry digest, saves to Supabase
    pulse/route.ts                — cross-industry pulse (~100 tokens)
    industries/route.ts           — list + create industries
    industries/[slug]/route.ts    — update + delete industry
lib/
  supabase.ts                     — shared Supabase types and clients
supabase/
  schema.sql                      — DB setup and seed data
```

## How top10 generation works

1. **5 parallel mandatory calls** — one Claude call per mandatory industry (Finance, Law, Healthcare, Media & Marketing, Defense), each with a targeted web search. Retries once without exclusions if the first attempt fails.
2. **1 remaining call** — finds 5 more stories across the remaining configured industries in a single call.
3. **Dedup** — any URL seen in the past 7 days is filtered out server-side before saving.
4. **Saved to `top10` table** — the UI reads the latest row on page load.

Per-industry prompt exclusions look back 3 days; the server-side URL dedup looks back 7 days.
