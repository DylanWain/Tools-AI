# Veronum Shared Chat — Integration Guide

This integrates the new multi-user shared chat layer into Veronum's
desktop app, **without touching any of the existing `dwc-*` features**
(meetings, undo/redo, agents, history, connectors, share — all keep working).

---

## What you're integrating

A single new injection module: `dwc-shared-chat.js`. It registers a Veronum
install with the API on first run, opens a floating "V" trigger button in
the top-right of claude.ai, and on click opens an overlay with the team's
shared chat thread + live presence sidebar. Other teammates' Veronum
instances see your prompts and AI responses in real time via Supabase
Realtime.

Existing files (`dwc-meetings.js`, `dwc-toolbar.js`, `dwc-agents-ui.js`,
`dwc-subscription.js`, `dwc-modal.js`, `dwc-connectors.js`, `dwc-history.js`,
`dwc-rebrand.js`) are **not changed**. The new module coexists.

---

## Prerequisites

1. **Supabase project** (free tier is fine for testing)
2. **OpenAI API key** (for the existing meeting transcripts to work again)
3. **Anthropic API key** (for the existing meeting analysis + new shared chat AI replies)
4. **Vercel project** for `thetoolswebsite.com` deployment (already exists)
5. **The Veronum desktop app source code** — you'll need to drop the new file in and rebuild the DMG

---

## Step 1: Set up Supabase (~10 min)

1. Go to https://supabase.com → **New project**
2. Choose a name (e.g. `veronum-prod`), set a strong password, pick the closest region
3. Wait ~2 minutes for provisioning
4. **SQL Editor** → paste the contents of `supabase/migrations/001_shared_chat.sql` from this repo → **Run**
   - Confirms with "Success. No rows returned." — this is correct
5. **Settings → API** → copy the three values:
   - `Project URL` (e.g. `https://abc123xyz.supabase.co`)
   - `anon` public key (a long JWT string starting with `eyJ...`)
   - `service_role` secret key (also `eyJ...`, **never expose this client-side**)

---

## Step 2: Set up Vercel env vars (~5 min)

In your Vercel project for `thetoolswebsite.com`:

**Settings → Environment Variables → Add the following (Production + Preview + Development):**

| Variable | Value | Source |
|---|---|---|
| `OPENAI_API_KEY` | `sk-proj-...` | platform.openai.com |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | console.anthropic.com |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-5` | (optional, defaults if omitted) |
| `NEXT_PUBLIC_SUPABASE_URL` | from Step 1 | Supabase Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Step 1 | Supabase Settings → API |
| `SUPABASE_SERVICE_KEY` | from Step 1 | Supabase Settings → API |

Then redeploy: **Deployments → ⋯ on the latest → Redeploy**.

**Verify it worked:**

```bash
curl https://thetoolswebsite.com/api/v1/health
```

Expected:
```json
{
  "ok": true,
  "service": "veronum-api",
  "version": "v1",
  "config": {
    "openai_key": true,
    "anthropic_key": true,
    "supabase": true
  }
}
```

If any field is `false` or shows an error string, check the corresponding env var.

---

## Step 3: Drop `dwc-shared-chat.js` into Veronum (~5 min)

1. Open Veronum's desktop source repo
2. Copy `veronum-injection/dwc-shared-chat.js` from this repo into the same
   directory as `dwc-meetings.js`, `dwc-toolbar.js`, etc.
3. Open `bootstrap.js` (Veronum's main process Electron entry that injects the
   `dwc-*` scripts into the claude.ai webContents)
4. Add the injection. Find where the existing scripts are required + injected:
   ```js
   const TOOLBAR_INJECT_TEMPLATE = require("./dwc-toolbar");
   const AGENTS_UI_TEMPLATE = require("./dwc-agents-ui");
   // ... etc
   ```
   Add:
   ```js
   const SHARED_CHAT_TEMPLATE = require("./dwc-shared-chat");
   ```
5. Find the chunk that calls `webContents.executeJavaScript()` for each script
   when the page loads. Add the shared-chat injection alongside the others,
   replacing the placeholder env tokens with real values:
   ```js
   contents.executeJavaScript(
     SHARED_CHAT_TEMPLATE
       .replace(/__DWC_PORT__/g, port)
       .replace(/__DWC_API__/g, "https://thetoolswebsite.com/api/v1")
       .replace(/__DWC_SBURL__/g, "https://YOUR_PROJECT.supabase.co")
       .replace(/__DWC_SBANON__/g, "eyJ...your_anon_key")
       .replace(/__DWC_TOKEN__/g, "tai-aadbe6df1780d20814e1271c7273e117")
   );
   ```
   The `__DWC_TOKEN__` value is the same shared bearer token your existing
   `dwc-meetings-bridge.js` uses (`SHIPPED_DMG_TOKEN` in `lib/auth.ts`).
   This keeps backwards compatibility — your existing meetings keep working.

6. Rebuild the DMG with your normal build command (likely `npm run build` or
   `electron-builder`), and produce a new `Veronum-1.0.x-arm64.dmg`.

---

## Step 4: Test multi-user (~5 min)

1. Install the new DMG on **Machine A**
2. Open Claude (the Veronum-wrapped one) — you should see a small **V** button
   in the top-right corner of claude.ai
3. Click it → overlay opens, says "No active project" → click **Create project**
4. Type a name (e.g. "Test team")
5. The overlay reloads showing the empty thread + composer
6. Type a message → Enter → it appears in the thread
7. Type `@claude what is 2+2?` → Enter → Claude responds in the same thread
8. Open Veronum's settings or the local bridge endpoint to grab the project ID
   (or generate an invite token via the API):
   ```bash
   curl -X POST https://thetoolswebsite.com/api/v1/projects/<project-id>/invite \
     -H "Authorization: Bearer tai-aadbe6df1780d20814e1271c7273e117" \
     -H "x-veronum-user-id: <your-user-id>" \
     -d '{"role":"participant"}'
   ```
9. On **Machine B**, install the same DMG. After registration, set the active
   project to the same one (eventually via clicking the invite link — for now,
   manually `localStorage.setItem("veronum_active_project", "<project-id>")` in
   claude.ai's devtools)
10. Click the **V** button on Machine B — should see the same thread including
    your test message and Claude's response

If both machines see the same thread updating live as either one types, the
multi-user shared chat is working.

---

## Step 5: Verify existing features still work

After the new DMG is installed, confirm none of the existing features regressed:

- [ ] **Meeting transcripts**: open the meeting modal (the mic icon in claude.ai's
      sidebar that `dwc-meetings.js` injects), record a 10-second clip, transcribe.
      It should work now (since `/api/v1/transcribe` is no longer 404). Live polling
      transcribe also works.
- [ ] **Undo/Redo/History pill**: the version-control pill from `dwc-toolbar.js`
      still appears near the dictation pill. Buttons still trigger `dwc-history.js`.
- [ ] **10 agents popover**: the `@agents` chip from `dwc-agents-ui.js` still
      opens the 10-slot popover. Send still works.
- [ ] **Connections modal**: still opens from the Connections sidebar entry
      (`dwc-connectors.js` injection). Stripe / Supabase / Slack tabs render.
- [ ] **Subscription banner**: top-right "X days left in trial" pill still shows.
- [ ] **Share / project link**: now backed by the new API — clicking generates a
      real link via `/api/v1/projects/{id}/invite`.

---

## What's still TODO (post-MVP)

- The overlay UI in `dwc-shared-chat.js` is a minimal shell that calls the API
  but doesn't yet port the rich React UI from `/overlay-preview`. The full UI
  (presence sidebar with code snippets, mention pills, History/Connectors/Share
  tabs in the header) needs to be ported from `components/overlay/VeronumOverlay.tsx`
  into vanilla DOM in the injection module — about 400 more lines.
- True per-user JWT auth (currently all installs share the bridge bearer token).
  Add Supabase Auth + per-user JWT for the web flow when we ship a web app.
- WebSocket-based live transcripts (currently 5-second polling via the existing
  `dwc-meetings.js` LIVE_TX_EVERY_MS loop — works but not "live live").

---

## Files added in this integration

```
Veronum-site/
├── lib/
│   ├── auth.ts                                ← bearer token + helpers
│   ├── rateLimit.ts                           ← per-IP throttle
│   └── supabase.ts                            ← server-side Supabase client
├── supabase/migrations/
│   └── 001_shared_chat.sql                    ← run once in Supabase SQL editor
├── app/api/v1/
│   ├── health/route.ts
│   ├── transcribe/route.ts                    ← FIXES broken meetings
│   ├── chat/route.ts                          ← FIXES broken meeting analysis
│   ├── users/register/route.ts
│   ├── projects/route.ts                      ← list + create
│   ├── projects/[id]/messages/route.ts        ← post + get history
│   ├── projects/[id]/invite/route.ts          ← generate share link
│   ├── projects/[id]/presence/route.ts        ← live presence heartbeat
│   └── projects/join/[token]/route.ts         ← accept invite
└── veronum-injection/
    ├── dwc-shared-chat.js                     ← drop into Veronum.app/Contents/Resources/app.asar
    └── INTEGRATION.md                         ← this file
```

---

## Rollback plan

If something breaks:

1. **API routes**: revert the deployment in Vercel → previous version restores
2. **Supabase**: the migration only adds tables/policies/types — no destructive
   changes to existing data. To roll back, drop the new tables:
   ```sql
   drop table if exists public.presence cascade;
   drop table if exists public.messages cascade;
   drop table if exists public.project_invites cascade;
   drop table if exists public.project_members cascade;
   drop table if exists public.projects cascade;
   drop table if exists public.users cascade;
   drop type if exists public.message_kind;
   drop type if exists public.project_role;
   ```
3. **Veronum DMG**: ship a build that omits the `SHARED_CHAT_TEMPLATE` injection
   line. Existing `dwc-*` features continue working unchanged.

The old DMG (without shared chat) continues to work fine — its `dwc-meetings`
will hit the new `/api/v1/transcribe` endpoint and meetings will work. Users
without the new shared-chat injection just won't see the V trigger button.
