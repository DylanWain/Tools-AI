# Tools AI - Setup Instructions

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create `.env.local` file** (copy from `.env.example`):
   ```bash
   cp .env.example .env.local
   ```

3. **Add your keys to `.env.local`:**
   ```
   # Required - Supabase
   NEXT_PUBLIC_SUPABASE_URL=your-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_KEY=your-service-key
   
   # Required - Security
   JWT_SECRET=any-random-32-char-string
   
   # Required - FREE unlimited AI
   FREE_GROQ_API_KEY=gsk_your_groq_key
   ```

4. **Run development server:**
   ```bash
   npm run dev
   ```

5. **Open:** http://localhost:3000

## What Changed

- **Homepage is now the chat interface** (no landing page)
- **FREE unlimited AI** via Groq (Llama 3.1 70B)
- **No message limits** - users can chat forever
- **Optional BYOK** - users can add their own GPT-4/Claude/Gemini keys

## Architecture

| Route | What |
|---|---|
| `/` | Chat interface (main) |
| `/blog/*` | 461 SEO articles |
| `/dashboard` | Extension sync dashboard |
| `/download` | Chrome extension |
| `/login` | Auth page |

## Free Tier

- Uses Groq's free API (Llama 3.1 70B)
- Unlimited messages
- No account required
- All conversations saved to Supabase

## Get Groq API Key

1. Go to https://console.groq.com/keys
2. Create free account
3. Generate API key
4. Add to `.env.local` as `FREE_GROQ_API_KEY`

## Deploy to Vercel

1. Push to GitHub
2. Import to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy
