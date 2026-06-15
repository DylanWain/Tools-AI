/**
 * PostHog client-side instrumentation.
 *
 * Next.js runs this file once on the client before hydration (the
 * official `instrumentation-client` hook, 15.3+). Because the desktop
 * app (veronum-desktop) simply loads this site in a BrowserWindow,
 * initialising PostHog here covers BOTH surfaces — web visitors and
 * desktop users — from one place. Every event is tagged with `surface`
 * so the two can be told apart in the dashboard.
 *
 * Session recording is intentionally UNMASKED (product decision,
 * 2026-06-15): it captures on-screen text and typed input, including
 * prompts and code. Password inputs stay masked (PostHog forces this).
 * This is disclosed on /privacy — keep them in sync.
 */
import posthog from "posthog-js";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

// Only initialise with a real project key. Keeps local dev (and any
// build without the env var set) clean — capture() calls elsewhere
// become harmless no-ops until a real key is present.
const keyLooksReal = !!KEY && KEY.startsWith("phc_") && !KEY.includes("REPLACE");

if (keyLooksReal) {
  posthog.init(KEY as string, {
    api_host: HOST,
    // Bundled defaults: pageviews, pageleave, autocapture (clicks on
    // every button/link), and sensible recording defaults.
    defaults: "2026-01-30",
    // Track anonymous users too — Veronum has no login, so this is the
    // only way to get real retention / "how often they open" numbers.
    person_profiles: "always",
    session_recording: {
      // Unmasked: capture full text + typed input (prompts, code).
      // Password inputs are always masked by PostHog regardless.
      maskAllInputs: false,
      maskInputOptions: { password: true },
    },
  });

  // Distinguish the desktop app (Electron renderer) from the website.
  // Desktop loads the exact same site, so the user-agent is the tell.
  const isDesktop =
    typeof navigator !== "undefined" && /electron/i.test(navigator.userAgent);
  posthog.register({ surface: isDesktop ? "desktop" : "web" });
}
