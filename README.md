# Regret Forecaster

Regret Forecaster is a production-ready Next.js 14 app that predicts likely regret risk before a person makes a decision. It streams a structured behavioral analysis, detects cognitive biases, and projects likely future regret.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + Framer Motion
- Supabase Postgres + Supabase Auth (magic link)
- Multi-provider LLM backend:
  - Anthropic Claude (original)
  - OpenAI-compatible providers (for example OpenRouter/Groq-compatible APIs)
  - Local Ollama (no per-call API cost)
- Vercel deployment support (`vercel.json`)

## Features

- Decision input screen with quick-fill examples and minimum-character validation
- Progressive streaming analysis sections:
  - Regret risk score ring
  - Cognitive bias detector
  - Risk breakdown meters
  - Future-self voice quote
  - Hidden reframe question
  - Concrete mitigation steps
- Saved analysis history (authenticated users)
- Side-by-side comparison for two decisions
- Public shareable read-only links
- Dynamic OG image per shared analysis

## 1) Prerequisites

- Node.js 18+
- npm 9+
- A Supabase project
- One AI provider option:
  - local Ollama (no API billing), or
  - an OpenAI-compatible API key, or
  - Anthropic API key

## 2) Environment Setup

Copy `.env.example` to `.env.local` and fill values.

```bash
cp .env.example .env.local
```

Current default is local Ollama:

```env
AI_PROVIDER=ollama
AI_MODEL=llama3.2:latest
OLLAMA_BASE_URL=http://127.0.0.1:11434
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Supabase values are still required:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Optional provider-specific variables:

```env
# Anthropic
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# OpenAI-compatible
AI_PROVIDER=openai-compatible
AI_BASE_URL=
AI_API_KEY=
AI_MODEL=meta-llama/llama-3.1-8b-instruct:free
```

## 3) Supabase Schema + RLS

Run SQL from [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL editor.

This creates:

- `public.analyses` table
- indexes for `user_id`, `created_at`, `share_token`
- RLS policies for own-data access and share-token read access

## 4) Install and Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 5) Auth Flow (Magic Link)

- Visit `/history`
- Enter email and request magic link
- Use link from inbox to return authenticated

## 6) AI Streaming Behavior

`POST /api/analyze`:

- Streams model output with provider-specific streaming protocol
- Parses top-level JSON progressively as tokens arrive
- Emits NDJSON events to UI (`partial`, `retry`, `complete`, `error`)
- Retries once automatically if model JSON is invalid
- Persists completed analyses to Supabase

## 7) Share and OG

- Share link format: `/share/<share_token>`
- Public API endpoint: `GET /api/share/[id]`
- Dynamic OG image: `/share/[id]/opengraph-image`

## 8) Deploy to Vercel

1. Push repository to your Git provider.
2. Import project into Vercel.
3. Add all required environment variables in Vercel settings.
4. Deploy.

`vercel.json` is already configured for Next.js and no-store API cache headers.

## 9) Local No-Cost Setup (Recommended)

If you do not want Anthropic billing:

1. Install and run Ollama.
2. Pull a model, for example:

```bash
ollama pull llama3.2:latest
```

3. Keep `.env.local` as:

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2:latest
```

## Project Structure

```text
.
├── app/
│   ├── api/
│   │   ├── analyze/route.ts
│   │   └── share/[id]/route.ts
│   ├── analyze/page.tsx
│   ├── history/page.tsx
│   ├── share/[id]/page.tsx
│   ├── share/[id]/opengraph-image.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
├── lib/
├── supabase/schema.sql
├── .env.example
├── .env.local
├── tailwind.config.ts
├── vercel.json
└── README.md
```

## Important Notes

- The system prompt in `lib/claude.ts` remains exactly aligned with the requested behavioral analysis contract.
- UI is mobile-first and supports 375px width and above.
- Shared analysis views are read-only and do not require auth.
