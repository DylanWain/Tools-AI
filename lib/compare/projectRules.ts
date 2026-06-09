/**
 * Project rules storage — the web-app equivalent of Claude Code's
 * CLAUDE.md. The user types their project conventions (stack, style,
 * file-tree quirks, what they care about in reviews) into a textarea
 * and they get appended to the system prompt on every /compare call.
 *
 * v1 persistence: localStorage. Per-browser, no DB round-trip, ships
 * today. v2 will sync to public.users so it follows the user across
 * devices, but the API contract here is stable — only the storage
 * backend changes.
 *
 * One key for now (global rules per browser). If users want per-project
 * rules later, we'll switch to keying by sessionId / project name.
 */

const KEY = "tools_ai.project_rules.v1";
const MAX_CHARS = 32_000; // matches MAX_PROMPT_CHARS * 8 in /api/compare

/** Read the user's stored project rules. Returns "" when nothing is set
 *  or when called server-side. Trims trailing whitespace so a textarea
 *  with stray newlines doesn't poison length checks. */
export function loadProjectRules(): string {
  if (typeof window === "undefined") return "";
  try {
    return (window.localStorage.getItem(KEY) ?? "").trim();
  } catch {
    // Private-mode browsers throw on localStorage access; treat as empty.
    return "";
  }
}

/** Persist project rules. Truncates to MAX_CHARS so a paste of an
 *  entire repo doesn't bloat every request. Pass "" to clear. */
export function saveProjectRules(text: string): void {
  if (typeof window === "undefined") return;
  const trimmed = text.trim().slice(0, MAX_CHARS);
  try {
    if (trimmed) window.localStorage.setItem(KEY, trimmed);
    else window.localStorage.removeItem(KEY);
  } catch {
    // Best-effort. Saving fails silently in private mode.
  }
}

export function hasProjectRules(): boolean {
  return loadProjectRules().length > 0;
}

/** Convenience for components that want a count for "Project rules (1.2k)"
 *  in the chat header without re-reading the full string. */
export function projectRulesLength(): number {
  return loadProjectRules().length;
}

export const PROJECT_RULES_MAX_CHARS = MAX_CHARS;
