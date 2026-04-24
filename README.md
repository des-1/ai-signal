# AI Signal v2 — Multi-Industry Intelligence

AI news digests across industries for RepresentAI. Powered by Claude with live web search, backed by Supabase.

## What's new in v2
- Multi-industry support (Media & Marketing, Law, Finance — add more in Admin)
- Digest archive — browse previous weeks without regenerating
- Cross-industry pulse — spots themes across industries (near-zero tokens)
- Tag frequency chart — see what topics are dominating over time
- Admin panel — add/remove industries with custom search focus, no code changes needed
- Shareable links — each industry digest has its own URL
- Fresh/Stale indicator — know when a digest needs regenerating

## Setup

### 1. Supabase
Create a new project at supabase.com (or use your existing one).

Run `supabase/schema.sql` in the Supabase SQL editor. This creates the tables and seeds the three default industries.

Get your keys from: Project Settings → API:
- `NEXT_PUBLIC_SUPABASE_URL` = Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` = service_role key (keep this secret)

### 2. Local development
```bash
cp .env.local.example .env.local
# Fill in all four keys
npm install
npm run dev
```

### 3. Deploy to Vercel
Push to GitHub, connect at vercel.com/new.

Add all four environment variables in Vercel:
Project → Settings → Environment Variables

### 4. Done
- Homepage: `/`
- Industry digest: `/digest/media-marketing`, `/digest/law`, `/digest/finance`
- Admin: `/admin`

## Adding a new industry
Go to `/admin` → fill in name, icon, and focus areas → Add industry.
The new tab appears on the homepage immediately. No redeployment needed.

## Architecture
- `app/page.tsx` — dashboard homepage
- `app/digest/[slug]/page.tsx` — dynamic industry page
- `app/admin/page.tsx` — admin panel
- `app/api/digest/route.ts` — generates digest, saves to Supabase
- `app/api/pulse/route.ts` — cross-industry pulse (cheap: ~100 tokens)
- `app/api/industries/route.ts` — list + create industries
- `app/api/industries/[slug]/route.ts` — update + delete
- `lib/supabase.ts` — shared types and clients
- `supabase/schema.sql` — DB setup and seed
