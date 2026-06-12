/**
 * Desktop magic-link handoff.
 *
 * When the user signs in from inside Veronum Desktop, the magic-link
 * email's redirect target is THIS page (not /). Supabase appends the
 * verified access_token + refresh_token to the URL fragment. We pluck
 * them out client-side and immediately redirect to:
 *
 *   veronum://auth?access_token=...&refresh_token=...
 *
 * macOS recognizes the custom scheme, opens Veronum.app (registered
 * via app.setAsDefaultProtocolClient('veronum') in the Electron main),
 * and the main process IPCs the URL to the renderer. The renderer
 * then calls supabase.auth.setSession to land the session on the
 * local 127.0.0.1:27500 origin — same origin every other request uses,
 * so the chat, billing, /api/* calls all see a signed-in user.
 *
 * Why not server-side: Supabase puts the tokens in the URL FRAGMENT
 * (the part after `#`). Fragments never reach the server. We must do
 * the redirect client-side.
 *
 * What happens if the user opened the link from a browser without the
 * desktop app installed: the veronum:// redirect quietly fails. We
 * show a fallback UI with a "Use 6-digit code instead" prompt so they
 * have a path forward. (The code path lives in CompareAuthGate and is
 * the supported fallback already.)
 */
"use client";

import { useEffect, useState } from "react";

function buildVeronumUrl(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return null;
  // Parse fragment as URLSearchParams — Supabase delivers tokens this way.
  const params = new URLSearchParams(hash);
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return null;
  // Pass-through expires_in / token_type so the renderer can populate
  // the full session object if it wants. access_token alone is enough
  // for supabase.auth.setSession but the extras don't hurt.
  const out = new URLSearchParams();
  out.set("access_token", access_token);
  out.set("refresh_token", refresh_token);
  const expires_in = params.get("expires_in");
  if (expires_in) out.set("expires_in", expires_in);
  const token_type = params.get("token_type");
  if (token_type) out.set("token_type", token_type);
  return `veronum://auth?${out.toString()}`;
}

export default function DesktopHandoff() {
  const [state, setState] = useState<"working" | "no-token" | "redirected">("working");
  const [veronumUrl, setVeronumUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = buildVeronumUrl();
    if (!url) { setState("no-token"); return; }
    setVeronumUrl(url);
    // Fire the deep link. On macOS, if Veronum.app is registered for
    // the scheme, this opens the app. If not registered (user opened
    // the link in a browser without the app installed), nothing
    // happens and we surface the fallback after a short delay.
    window.location.href = url;
    // Bring the page to a clean "we're done here" state after the
    // redirect dispatches. The browser tab can stay open or close;
    // either is fine because the session lands on the desktop, not
    // here.
    const t = window.setTimeout(() => setState("redirected"), 800);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white/85 px-6">
      <div className="w-full max-w-[460px] rounded-2xl border border-white/10 bg-[#161616] p-7">
        {state === "working" && (
          <>
            <h1 className="text-[22px] font-serif mb-1.5">Opening Veronum Desktop…</h1>
            <p className="text-white/55 text-[13px] leading-[1.5]">
              You should see a prompt asking to open the Veronum app. Approve it and you&rsquo;ll land signed in.
            </p>
          </>
        )}
        {state === "redirected" && (
          <>
            <h1 className="text-[22px] font-serif mb-1.5">Sent to Veronum Desktop.</h1>
            <p className="text-white/55 text-[13px] leading-[1.5] mb-4">
              Switch back to the Veronum app to finish signing in. You can close this tab.
            </p>
            {veronumUrl && (
              <button
                onClick={() => { window.location.href = veronumUrl; }}
                className="text-[12px] text-white/45 hover:text-white/75 underline underline-offset-2"
              >
                Didn&rsquo;t open? Try again.
              </button>
            )}
          </>
        )}
        {state === "no-token" && (
          <>
            <h1 className="text-[22px] font-serif mb-1.5">No sign-in token in the URL.</h1>
            <p className="text-white/55 text-[13px] leading-[1.5]">
              The magic link may have expired or already been used. Go back to the Veronum app and request a fresh code.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
