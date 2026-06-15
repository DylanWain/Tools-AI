/**
 * Typed PostHog event helpers.
 *
 * Thin wrappers over the posthog-js singleton (initialised in
 * instrumentation-client.ts). Keeping event names + property shapes in
 * one place stops them drifting across call sites. Autocapture already
 * records every button/link click and pageview, so this file is only
 * for the few high-value product events worth naming explicitly.
 *
 * Analytics must NEVER break the app: every call is wrapped so a
 * capture failure (or PostHog not yet initialised) can't throw into
 * the product code path.
 */
import posthog from "posthog-js";

export type SendMode = "single" | "compare" | "multi-agent" | "pipeline";

function safeCapture(event: string, props?: Record<string, unknown>): void {
  try {
    posthog.capture(event, props);
  } catch (err) {
    // Don't swallow silently — surface in dev, but never rethrow.
    if (typeof console !== "undefined") {
      console.debug(`[analytics] capture "${event}" failed`, err);
    }
  }
}

/** Fired once per user-initiated Send (not per fan-out model call). */
export function captureMessageSent(p: {
  mode: SendMode;
  models: readonly string[];
  sessionId?: string;
}): void {
  safeCapture("message_sent", {
    mode: p.mode,
    models: [...p.models],
    model_count: p.models.length,
    session_id: p.sessionId,
  });
}

/** Fired when someone clicks a desktop-app download link. */
export function captureDownloadClicked(p: { os: string; kind: string }): void {
  safeCapture("download_clicked", { os: p.os, kind: p.kind });
}

/**
 * Tie all events + session recordings to the user's account email.
 * Using the chat requires signing in (CompareAuthGate), so identifying
 * by email turns PostHog "Persons" into a real, contactable list — the
 * missing piece for actually talking to users.
 */
export function identifyUser(email?: string | null): void {
  const e = email?.trim().toLowerCase();
  if (!e) return;
  try {
    posthog.identify(e, { email: e });
  } catch (err) {
    if (typeof console !== "undefined") console.debug("[analytics] identify failed", err);
  }
}

/** Clear identity on sign-out so the next user isn't merged into this one. */
export function resetUser(): void {
  try {
    posthog.reset();
  } catch (err) {
    if (typeof console !== "undefined") console.debug("[analytics] reset failed", err);
  }
}
