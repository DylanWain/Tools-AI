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
NEXT_PUBLIC_SUPABASE_URL = https://synpjcammfjebwsmtfpz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bnBqY2FtbWZqZWJ3c210ZnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0OTU3NDcsImV4cCI6MjA4NTA3MTc0N30.iHXwtPV10JGPL5OKgkpd6WxerTQoI4YE4-ld9g38eRQ
SUPABASE_SERVICE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bnBqY2FtbWZqZWJ3c210ZnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQ5NTc0NywiZXhwIjoyMDg1MDcxNzQ3fQ.wdpCbyxMtncn4wpBQuOhpdkKuKESFjLLar6Sjww0_RM
JWT_SECRET = K9x2mP7qR4vL8nW3jF6hC1bY5tA0sD9e
```

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
