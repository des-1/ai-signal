# AI Signal — Media & Marketing Digest

A weekly AI news digest tool for RepresentAI, pulling live stories relevant to media, advertising, and marketing professionals.

## Stack
- Next.js 14 (App Router)
- Anthropic API with web search
- Vercel deployment

## Deploy to Vercel in 3 steps

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "initial commit"
gh repo create ai-signal --public --push
```

### 2. Deploy to Vercel
```bash
npx vercel
```
Or connect the GitHub repo at vercel.com/new.

### 3. Add environment variable in Vercel dashboard
```
ANTHROPIC_API_KEY = your_key_here
```
Go to: Project → Settings → Environment Variables

That's it. Your digest lives at `https://your-project.vercel.app`.

## Local development
```bash
cp .env.local.example .env.local
# Add your ANTHROPIC_API_KEY to .env.local
npm install
npm run dev
```

## How it works
- `/` — the digest UI
- `/api/digest` — GET endpoint that calls Claude with live web search

Claude runs an agentic search loop: it performs multiple web searches, then synthesises the 5 most relevant AI stories for media & marketing, returned as structured JSON.

## Optional: Scheduled digest via Vercel Cron
Add to `vercel.json` (already included if you want it):
```json
{
  "crons": [{ "path": "/api/digest", "schedule": "0 8 * * 1" }]
}
```
This pings the digest every Monday at 8am UTC. You'd need to extend the route to store results (e.g. in Vercel KV or a simple JSON file) rather than return them live. Ask Claude to help with that if needed.
