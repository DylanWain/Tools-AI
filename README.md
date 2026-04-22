# Tools AI - Unlimited Memory Chat

A ChatGPT-style interface with persistent memory stored in Supabase.

## Features

- 🔐 User authentication (register/login)
- 💬 Chat with OpenAI models
- 📚 Unlimited conversation history
- 🔍 Search across all conversations
- 💾 Everything persists in Supabase

## Quick Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/tools-ai-test.git
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New..." → "Project"
3. Import your GitHub repo
4. **IMPORTANT:** Name it something like `tools-ai-test` (NOT your production project!)

### 3. Set Environment Variables in Vercel

In Vercel dashboard → Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL = <your project URL — e.g. https://YOUR_PROJECT.supabase.co>
NEXT_PUBLIC_SUPABASE_ANON_KEY = <your anon key from Supabase → Settings → API>
SUPABASE_SERVICE_KEY = <your service_role key from Supabase → Settings → API>
JWT_SECRET = <generate with: openssl rand -hex 32>
```

> ⚠️ Never paste real values into this README. Keep secrets in your
> Vercel dashboard only. The previously-committed example values were
> rotated after a leak was discovered on 2026-04-22.

### 4. Deploy!

Click Deploy. Your app will be live at `https://tools-ai-test.vercel.app` (or similar).

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## How It Works

1. **Register/Login** - Creates user in Supabase `users` table
2. **Create Chat** - Saves to `conversations` table
3. **Send Message** - User enters their OpenAI API key in settings, messages saved to `messages` table
4. **Search** - Full-text search across all your messages

## Database

Your Supabase "ForeverGPT" project already has all tables:
- `users` - User accounts
- `conversations` - Chat sessions
- `messages` - Individual messages
- `embeddings` - For vector search (future)
- `summaries` - For hierarchical memory (future)

## User API Keys

Users add their own OpenAI API key in the Settings modal. The key is stored locally in the browser and sent with each request - it's never saved on the server.
