/*
 * dwc-shared-chat.js — Veronum's multi-user shared chat layer.
 *
 * Drop into Veronum's app.asar next to dwc-meetings.js, dwc-toolbar.js,
 * dwc-agents-ui.js, etc. Then add to bootstrap.js's injection chain:
 *
 *   const SHARED_CHAT_TEMPLATE = require("./dwc-shared-chat");
 *   contents.executeJavaScript(SHARED_CHAT_TEMPLATE.replace(/__DWC_PORT__/g, port));
 *
 * What it does:
 *   1. On load, registers this Veronum install with the API (POST /users/register).
 *      Stores the returned user.id in localStorage so subsequent loads reuse it.
 *   2. Adds a floating "V" trigger button in the top-right corner of claude.ai.
 *   3. On click, opens the Veronum overlay (full chat thread + presence sidebar)
 *      that covers the right side of the chat area but leaves Claude's sidebar
 *      visible so the user can keep navigating their own conversations.
 *   4. Subscribes to Supabase Realtime for the active project's messages and
 *      presence — incoming events from teammates show up live.
 *   5. The composer in the overlay POSTs to /projects/{id}/messages. Other
 *      teammates' overlays receive the message via Realtime within ~50ms.
 *   6. @claude / @codex / @cursor mentions trigger an AI reply via /chat,
 *      streamed back into the same thread for everyone to see.
 *
 * Coexists with all existing dwc-* injections — they continue to work
 * unchanged. This module reads from window.__dwcAgents (from dwc-agents-ui)
 * for fleet dispatch and window.__dwcModal (from dwc-modal) for history UI.
 *
 * Backend contract (see Veronum-site/app/api/v1/*):
 *   POST /api/v1/users/register
 *   GET  /api/v1/projects
 *   POST /api/v1/projects
 *   GET  /api/v1/projects/{id}/messages?since=
 *   POST /api/v1/projects/{id}/messages
 *   POST /api/v1/projects/{id}/invite
 *   POST /api/v1/projects/join/{token}
 *   POST /api/v1/projects/{id}/presence
 *   POST /api/v1/chat                            (AI reply)
 *
 * Supabase Realtime channels (subscribed by the renderer via supabase-js):
 *   public:messages where project_id=eq.{id}
 *   public:presence where project_id=eq.{id}
 *
 * Env at injection time (replaced by bootstrap.js):
 *   __DWC_PORT__   the local bridge port
 *   __DWC_API__    the deployed API base URL (https://thetoolswebsite.com/api/v1)
 *   __DWC_SBURL__  Supabase URL (public, NEXT_PUBLIC_SUPABASE_URL)
 *   __DWC_SBANON__ Supabase anon key (public, NEXT_PUBLIC_SUPABASE_ANON_KEY)
 *   __DWC_TOKEN__  Bearer token (matches lib/auth.ts SHIPPED_DMG_TOKEN)
 */

module.exports = `(() => {
  if (window.__dwcSharedChatInstalled) return;
  window.__dwcSharedChatInstalled = true;

  const PORT = "__DWC_PORT__";
  const API = "__DWC_API__";
  const SB_URL = "__DWC_SBURL__";
  const SB_ANON = "__DWC_SBANON__";
  const TOKEN = "__DWC_TOKEN__";
  const TAG = "[dwc-shared-chat]";
  const log = (...a) => { try { console.log(TAG, ...a); } catch {} };

  /* ---------------- Storage ---------------- */
  function getInstallToken() {
    let t = localStorage.getItem("veronum_install_token");
    if (!t) {
      t = crypto.randomUUID();
      localStorage.setItem("veronum_install_token", t);
    }
    return t;
  }
  function getUserId() { return localStorage.getItem("veronum_user_id"); }
  function setUserId(id) { localStorage.setItem("veronum_user_id", id); }
  function getActiveProject() { return localStorage.getItem("veronum_active_project"); }
  function setActiveProject(id) { localStorage.setItem("veronum_active_project", id); }

  /* ---------------- API client ---------------- */
  async function api(path, options = {}) {
    const headers = {
      "Authorization": "Bearer " + TOKEN,
      "Content-Type": "application/json",
      ...(getUserId() ? { "x-veronum-user-id": getUserId() } : {}),
      ...(options.headers || {}),
    };
    const res = await fetch(API + path, { ...options, headers });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error("API " + path + " failed " + res.status + ": " + body.slice(0, 200));
    }
    return res.json();
  }

  /* ---------------- Register install ---------------- */
  async function ensureRegistered() {
    if (getUserId()) return;
    const installToken = getInstallToken();
    const displayName = (document.cookie.match(/[?&]?name=([^;&]+)/) || [])[1] || "Anon";
    const user = await api("/users/register", {
      method: "POST",
      body: JSON.stringify({
        install_token: installToken,
        display_name: decodeURIComponent(displayName),
      }),
    });
    setUserId(user.id);
    log("registered user", user.id);
  }

  /* ---------------- Realtime (lazy-loaded supabase-js) ---------------- */
  let supabaseClient = null;
  let activeChannel = null;
  let onMessageCallback = null;
  let onPresenceCallback = null;

  async function loadSupabase() {
    if (supabaseClient) return supabaseClient;
    // Load supabase-js from CDN since Veronum can't bundle ES modules into asar easily
    if (!window.__supabaseJs) {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    supabaseClient = window.supabase.createClient(SB_URL, SB_ANON, {
      realtime: { params: { eventsPerSecond: 10 } },
    });
    return supabaseClient;
  }

  async function subscribeToProject(projectId) {
    const sb = await loadSupabase();
    if (activeChannel) await sb.removeChannel(activeChannel);

    activeChannel = sb.channel("project:" + projectId);

    activeChannel
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: "project_id=eq." + projectId },
        (payload) => { if (onMessageCallback) onMessageCallback(payload.new); }
      )
      .on("postgres_changes",
        { event: "*", schema: "public", table: "presence", filter: "project_id=eq." + projectId },
        (payload) => { if (onPresenceCallback) onPresenceCallback(payload.new || payload.old); }
      )
      .subscribe((status) => log("realtime status", status));

    log("subscribed to project", projectId);
  }

  /* ---------------- claude.ai DOM helpers (the AI engine) ---------------- */
  // We never proxy AI through our server. The user's claude.ai is the AI:
  //   1. Inject the prompt into claude.ai's contenteditable composer
  //   2. Click their Send button
  //   3. Observe the assistant message stream from the DOM
  //   4. Broadcast the captured response to teammates via Supabase

  function findComposer() {
    // Try the most stable selectors Anthropic ships
    const candidates = [
      'div[contenteditable="true"][data-testid="chat-input"]',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
      'textarea[placeholder*="Reply"]',
      'textarea',
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function findSendButton() {
    const candidates = [
      'button[aria-label*="Send" i]',
      'button[aria-label*="Submit" i]',
      'button[type="submit"]',
    ];
    for (const sel of candidates) {
      const btn = document.querySelector(sel);
      if (btn && !btn.disabled) return btn;
    }
    return null;
  }

  function findThread() {
    // The scrollable message list
    const candidates = [
      '[role="log"]',
      '[data-testid="conversation-turns"]',
      'main [class*="conversation" i]',
      'main',
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  /** Wait for the next assistant message to finish streaming, return its text. */
  function waitForAssistantResponse(timeoutMs = 90000) {
    return new Promise((resolve) => {
      const thread = findThread();
      if (!thread) return resolve(null);

      let lastTurn = null;
      let stableTimer = null;
      let lastText = "";

      const observer = new MutationObserver(() => {
        // Find the most recent assistant turn (Anthropic uses data-test-render-count + class
        // patterns that vary, so we look for the last child of the thread that contains
        // a <code> block or significant text and isn't the user's just-sent message).
        const turns = thread.querySelectorAll('[data-test-render-count], [data-testid*="message" i]');
        if (turns.length === 0) return;
        const lastEl = turns[turns.length - 1];
        if (lastEl !== lastTurn) {
          lastTurn = lastEl;
          lastText = "";
        }
        const currentText = (lastEl.innerText || lastEl.textContent || "").trim();
        if (currentText !== lastText && currentText.length > 0) {
          lastText = currentText;
          // Reset the stability timer — text is still changing
          if (stableTimer) clearTimeout(stableTimer);
          stableTimer = setTimeout(() => {
            // Text hasn't changed for 800ms — assume streaming is done
            observer.disconnect();
            resolve(lastText);
          }, 800);
        }
      });

      observer.observe(thread, { childList: true, subtree: true, characterData: true });

      // Hard timeout
      setTimeout(() => {
        observer.disconnect();
        if (stableTimer) clearTimeout(stableTimer);
        resolve(lastText || null);
      }, timeoutMs);
    });
  }

  /** Inject text into claude.ai's composer + click send. Returns true if dispatched. */
  function dispatchToClaude(prompt) {
    const composer = findComposer();
    if (!composer) { log("composer not found"); return false; }

    // contenteditable: replace innerHTML with text node + dispatch input event
    if (composer.tagName === 'TEXTAREA') {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(composer, prompt);
      composer.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      composer.focus();
      composer.innerHTML = '';
      const text = document.createTextNode(prompt);
      composer.appendChild(text);
      composer.dispatchEvent(new InputEvent('input', { bubbles: true, data: prompt, inputType: 'insertText' }));
    }

    // Wait a tick for React to register, then click Send
    setTimeout(() => {
      const btn = findSendButton();
      if (btn) btn.click();
      else log("send button not found");
    }, 80);

    return true;
  }

  /* ---------------- Send a message ---------------- */
  async function sendMessage(projectId, text) {
    if (!text || !text.trim()) return;

    // Detect AI mention
    const aiMention = (text.match(/(^|\\s)@(claude|codex|cursor|gpt)(\\s|$)/i) || [])[2];

    // 1. Post the human message to Supabase FIRST so teammates see it immediately
    await api("/projects/" + projectId + "/messages", {
      method: "POST",
      body: JSON.stringify({
        kind: "human",
        body: text,
        app: "Claude (overlay)",
      }),
    });

    if (!aiMention) return;

    // 2. Strip the @mention, send the bare prompt to YOUR claude.ai
    //    (the user pays Claude — we don't proxy through our Anthropic key)
    const cleanPrompt = text.replace(/(^|\\s)@(claude|codex|cursor|gpt)\\s*/gi, "").trim();
    if (!cleanPrompt) return;

    const dispatched = dispatchToClaude(cleanPrompt);
    if (!dispatched) {
      await api("/projects/" + projectId + "/messages", {
        method: "POST",
        body: JSON.stringify({
          kind: "system",
          body: "Could not find Claude composer — make sure you're in a chat",
        }),
      });
      return;
    }

    // 3. Observe claude.ai's response from the DOM, capture full text once streaming stops
    const responseText = await waitForAssistantResponse();
    if (!responseText) return;

    // 4. Broadcast the response to teammates so they see it in their overlays
    await api("/projects/" + projectId + "/messages", {
      method: "POST",
      body: JSON.stringify({
        kind: "ai",
        body: responseText,
        model: "Claude (your account)",
      }),
    });
  }

  /* ---------------- Heartbeat presence ---------------- */
  let presenceTimer = null;
  function startPresence(projectId) {
    if (presenceTimer) clearInterval(presenceTimer);
    const send = async () => {
      try {
        await api("/projects/" + projectId + "/presence", {
          method: "POST",
          body: JSON.stringify({
            app: "Claude",
            file: location.pathname,
            typing: !!document.activeElement && /textarea|input/i.test(document.activeElement.tagName),
          }),
        });
      } catch (err) { log("presence err", err.message); }
    };
    send();
    presenceTimer = setInterval(send, 5000);
  }
  function stopPresence() {
    if (presenceTimer) { clearInterval(presenceTimer); presenceTimer = null; }
  }

  /* ---------------- Overlay UI (placeholder shell — actual UI loads from API) ---------------- */
  function ensureOverlayShell() {
    if (document.getElementById("dwc-veronum-overlay")) return;

    // Trigger button (top-right corner, alwaysOnTop simulated via fixed position + max z)
    const btn = document.createElement("button");
    btn.id = "dwc-veronum-trigger";
    btn.style.cssText = \`
      position: fixed; top: 16px; right: 16px; z-index: 2147483646;
      width: 44px; height: 44px; border-radius: 12px;
      background: #fafaf7; border: 1px solid rgba(0,0,0,0.10);
      box-shadow: 0 4px 16px -4px rgba(0,0,0,0.18), 0 2px 4px -1px rgba(0,0,0,0.06);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: transform 200ms ease, box-shadow 200ms ease;
      font-family: 'Newsreader', Georgia, serif; font-size: 22px; font-weight: 500; color: #cc785c;
    \`;
    btn.textContent = "V";
    btn.title = "Open Veronum (Cmd+Shift+V)";
    btn.onmouseenter = () => { btn.style.transform = "scale(1.05)"; };
    btn.onmouseleave = () => { btn.style.transform = "scale(1)"; };
    btn.onclick = () => toggleOverlay();
    document.body.appendChild(btn);

    // Overlay shell — covers right side of screen but leaves Claude sidebar (260px wide) visible
    const ov = document.createElement("div");
    ov.id = "dwc-veronum-overlay";
    ov.style.cssText = \`
      position: fixed; top: 0; right: 0; bottom: 0; left: 260px; z-index: 2147483645;
      background: #faf9f5; border-left: 1px solid rgba(0,0,0,0.08);
      display: none; flex-direction: column; overflow: hidden;
      font-family: 'Inter', -apple-system, system-ui, sans-serif;
      animation: dwc-veronum-in 220ms cubic-bezier(0.16, 1, 0.3, 1);
    \`;
    ov.innerHTML = \`
      <header style="display:flex;align-items:center;justify-content:space-between;
        padding:12px 20px;border-bottom:1px solid rgba(0,0,0,0.06);">
        <div style="font-family:'Newsreader',Georgia,serif;font-size:16px;font-weight:500;">
          Veronum <span style="color:#7d7d76;font-style:italic;font-weight:400;">on Claude</span>
        </div>
        <button id="dwc-veronum-close" style="background:none;border:none;cursor:pointer;
          padding:6px 10px;color:#5a5a55;">✕</button>
      </header>
      <div id="dwc-veronum-body" style="flex:1;overflow-y:auto;padding:20px;">
        <div style="color:#5a5a55;font-size:13px;text-align:center;padding:40px 0;">
          Loading shared chat…
        </div>
      </div>
      <footer style="padding:12px 20px;border-top:1px solid rgba(0,0,0,0.06);background:#f4f3ed;
        font-family:ui-monospace,monospace;font-size:11px;color:#7d7d76;
        display:flex;justify-content:space-between;">
        <span>● BRIDGE :\${PORT} · LIVE</span>
        <span>v1.0.7 · ⌘⇧V to toggle</span>
      </footer>
    \`;
    document.body.appendChild(ov);
    document.getElementById("dwc-veronum-close").onclick = () => toggleOverlay(false);

    // Inject keyframes
    const style = document.createElement("style");
    style.textContent = \`
      @keyframes dwc-veronum-in {
        from { opacity: 0; transform: scale(0.985); }
        to { opacity: 1; transform: scale(1); }
      }
    \`;
    document.head.appendChild(style);

    // Global keyboard shortcut Cmd+Shift+V
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        toggleOverlay();
      }
      if (e.key === "Escape" && ov.style.display === "flex") {
        toggleOverlay(false);
      }
    });
  }

  let overlayOpen = false;
  function toggleOverlay(force) {
    const ov = document.getElementById("dwc-veronum-overlay");
    if (!ov) return;
    overlayOpen = typeof force === "boolean" ? force : !overlayOpen;
    ov.style.display = overlayOpen ? "flex" : "none";
    if (overlayOpen) loadOverlay();
  }

  /* ---------------- Load + render overlay content ---------------- */
  async function loadOverlay() {
    const body = document.getElementById("dwc-veronum-body");
    const projectId = getActiveProject();

    if (!projectId) {
      body.innerHTML = \`
        <div style="text-align:center;padding:60px 20px;">
          <div style="font-family:'Newsreader',Georgia,serif;font-size:20px;color:#1a1a18;margin-bottom:8px;">
            No active project
          </div>
          <p style="color:#5a5a55;font-size:13px;margin-bottom:24px;">
            Create a project to start a shared chat with your team.
          </p>
          <button id="dwc-veronum-create" style="padding:8px 16px;border-radius:8px;
            background:#cc785c;color:white;border:none;font-size:13px;font-weight:500;cursor:pointer;">
            Create project
          </button>
        </div>
      \`;
      document.getElementById("dwc-veronum-create").onclick = async () => {
        const name = prompt("Project name?");
        if (!name) return;
        const project = await api("/projects", {
          method: "POST",
          body: JSON.stringify({ name }),
        });
        setActiveProject(project.id);
        await subscribeToProject(project.id);
        startPresence(project.id);
        loadOverlay();
      };
      return;
    }

    // Load message history + render thread (full UI port from /overlay-preview comes next)
    body.innerHTML = \`
      <div style="text-align:center;padding:40px 0;color:#5a5a55;font-size:13px;">
        Loading messages for project \${projectId}…
      </div>
    \`;
    try {
      const { messages } = await api("/projects/" + projectId + "/messages?limit=100");
      renderThread(messages);
    } catch (err) {
      body.innerHTML = \`<div style="color:#c44;padding:20px;font-size:13px;">\${err.message}</div>\`;
    }
  }

  function renderThread(messages) {
    const body = document.getElementById("dwc-veronum-body");
    body.innerHTML = messages.map(m => \`
      <div style="display:flex;gap:12px;margin-bottom:14px;">
        <div style="width:32px;height:32px;border-radius:\${m.kind === 'ai' ? '8px' : '50%'};
          background:\${m.kind === 'ai' ? '#1a1a18' : m.author_color};
          color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:500;flex-shrink:0;">
          \${m.kind === 'ai' ? 'V' : m.author_name[0]}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;gap:8px;align-items:baseline;margin-bottom:4px;">
            <span style="font-size:12.5px;font-weight:500;">\${m.author_name}</span>
            \${m.app ? \`<span style="font-size:10px;color:#9a9a93;font-family:ui-monospace,monospace;">via \${m.app}</span>\` : ''}
            \${m.model ? \`<span style="font-size:9.5px;color:#7d7d76;background:rgba(0,0,0,0.04);padding:2px 6px;border-radius:4px;font-family:ui-monospace,monospace;">\${m.model}</span>\` : ''}
            <span style="margin-left:auto;font-size:10px;color:#9a9a93;">\${formatTime(m.created_at)}</span>
          </div>
          <div style="font-size:14px;line-height:1.55;color:#1a1a18;
            font-family:\${m.kind === 'ai' ? \"'Newsreader',Georgia,serif\" : 'inherit'};
            white-space:pre-wrap;">\${escapeHtml(m.body)}</div>
        </div>
      </div>
    \`).join('') + composerHtml();

    setupComposer();
  }

  function composerHtml() {
    return \`
      <div style="position:sticky;bottom:0;background:#faf9f5;padding-top:12px;border-top:1px solid rgba(0,0,0,0.06);margin-top:20px;">
        <div style="background:white;border:1px solid rgba(0,0,0,0.10);border-radius:16px;padding:12px 16px;">
          <textarea id="dwc-veronum-composer" rows="2" placeholder="Message the team or @claude / @codex / @cursor for AI..."
            style="width:100%;border:none;outline:none;resize:none;font-size:14px;font-family:'Newsreader',Georgia,serif;line-height:1.5;background:transparent;"></textarea>
          <div style="display:flex;gap:8px;align-items:center;padding-top:8px;border-top:1px solid rgba(0,0,0,0.05);font-size:11px;font-family:ui-monospace,monospace;color:#7d7d76;">
            <span>Enter to send · Shift+Enter for newline</span>
            <button id="dwc-veronum-send" style="margin-left:auto;padding:4px 12px;background:#cc785c;color:white;border:none;border-radius:999px;font-size:11px;font-weight:500;cursor:pointer;">Send</button>
          </div>
        </div>
      </div>
    \`;
  }

  function setupComposer() {
    const ta = document.getElementById("dwc-veronum-composer");
    const send = document.getElementById("dwc-veronum-send");
    if (!ta || !send) return;

    const submit = async () => {
      const text = ta.value.trim();
      if (!text) return;
      ta.value = "";
      try {
        await sendMessage(getActiveProject(), text);
      } catch (err) { log("send err", err.message); }
    };

    send.onclick = submit;
    ta.onkeydown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    };
    ta.focus();
  }

  /* ---------------- Live Realtime callbacks ---------------- */
  onMessageCallback = (newMsg) => {
    if (!overlayOpen) return;
    // Reload thread (simple v1 — replace with append-only later)
    loadOverlay();
  };
  onPresenceCallback = (presence) => {
    log("presence update", presence);
    // TODO: render presence sidebar
  };

  /* ---------------- Helpers ---------------- */
  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function formatTime(iso) {
    const d = new Date(iso);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    return d.toLocaleDateString();
  }

  /* ---------------- Bootstrap ---------------- */
  async function init() {
    try {
      await ensureRegistered();
      ensureOverlayShell();

      const activeProject = getActiveProject();
      if (activeProject) {
        await subscribeToProject(activeProject);
        startPresence(activeProject);
      }
      log("ready");
    } catch (err) {
      log("init failed", err.message);
    }
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();`;
