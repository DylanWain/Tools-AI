/**
 * "Inspect" mode — packs the user's virtual project into a single
 * prompt and asks every selected model to do a deep code review.
 *
 * The system prompt is intentionally HEAVY on anti-blandness rules.
 * Every model defaults to "consider adding error handling" style
 * advice when given a blob of code. We forbid that. Findings must
 * cite specific lines and quote the actual offending code.
 *
 * No tool-calling yet — v1 just inlines every file. Works for
 * projects up to ~30 files / ~50k chars before hitting the per-model
 * prompt cap on /api/compare. v2 will replace the inline dump with
 * tool calls (read_file, grep, find_symbol) so the model can request
 * files on demand instead of getting everything.
 */

import type { ProjectFile } from "./sessions";

/** System prompt override. Layers on top of the house voice — same
 *  outcome-first, prose-not-fragments rules apply, plus inspection-
 *  specific structure and anti-bland clauses. */
export const INSPECTION_SYSTEM_PROMPT = [
  "You are doing a deep code review. The user is going to give you their entire project as a series of file blocks. Read EVERY file before responding. Do not skip any.",
  "",
  "Your job is to find:",
  "  - BUGS: correctness issues that will produce wrong output, crash, or behave unexpectedly",
  "  - SECURITY: injection, broken auth, exposed secrets, missing validation at trust boundaries, OWASP top 10",
  "  - PERFORMANCE: N+1 queries, sync I/O in hot paths, memory leaks, quadratic loops, missing memoization, oversized payloads",
  "  - IMPROVEMENTS: cleanups that aren't required but would meaningfully help (only suggest if you can cite specific lines)",
  "",
  "STRICT RULES — failing these makes the review useless:",
  "  1. Every finding MUST cite `file_path:line_number`. No exceptions.",
  "  2. Every finding MUST quote the offending code (3-10 lines, in a fenced code block).",
  "  3. Every finding MUST explain WHY it's wrong and WHAT the specific fix is. No vague hedging.",
  "  4. Generic advice is BANNED. Never write \"consider adding error handling\", \"use TypeScript better\", \"this could be more robust\", \"add tests\", \"document this\". If you can't cite a specific line that's broken, don't mention it.",
  "  5. Do not include findings that are matters of taste (variable naming preference, brace style, etc).",
  "  6. If the project is clean in a category, say so explicitly. Don't pad.",
  "",
  "Format your response as Markdown sections, in this order, omitting any section that's empty:",
  "  ## 🔴 Critical bugs",
  "  ## 🟠 Security",
  "  ## 🟡 Performance",
  "  ## 🟢 Improvements",
  "  ## TL;DR",
  "",
  "Within each section, list findings hardest-first. For each finding use this exact structure:",
  "  ### {one-line summary}",
  "  `{file_path}:{line_number}`",
  "  ```{lang}",
  "  {3-10 lines of the actual offending code}",
  "  ```",
  "  **What's wrong:** {1-2 sentences, specific}",
  "  **Fix:** {1-2 sentences, specific — quote the replacement code if useful}",
  "",
  "End with a TL;DR section: one paragraph, 2-4 sentences, naming the single most important thing to fix first and why.",
  "",
  "If a file is incomplete (streaming mid-write, looks truncated), say so and review what's there.",
].join("\n");

/** Soft cap on inlined project content. Beyond this, files get
 *  truncated and a notice is added. Matches MAX_PROMPT_CHARS in
 *  /api/compare so the request doesn't 413. */
const MAX_INLINE_CHARS = 180_000;

/** Build the user-message body — every file inlined as a Cursor-style
 *  Method-1 fenced block (lineRange:filepath). Models see this as
 *  "here is my codebase, find problems". */
export function buildInspectionPrompt(project: Record<string, ProjectFile>): string {
  const files = Object.values(project)
    .filter((f) => f.content.trim().length > 0)
    .sort((a, b) => a.path.localeCompare(b.path));
  if (files.length === 0) {
    return "The workspace is empty. Tell me to add some code before you can inspect it.";
  }

  const header = [
    `I'm giving you my whole project (${files.length} file${files.length === 1 ? "" : "s"}).`,
    `Read every file and follow the inspection format from your system prompt.`,
    `If you skip a file or get vague, the review is useless.`,
    "",
    "---",
    "",
  ].join("\n");

  let body = header;
  let truncated: string[] = [];
  for (const f of files) {
    const lineCount = f.content.split("\n").length;
    const block = [
      "",
      `\`\`\`1:${lineCount}:${f.path}`,
      f.content,
      "```",
      "",
    ].join("\n");
    if (body.length + block.length > MAX_INLINE_CHARS) {
      truncated.push(f.path);
      continue;
    }
    body += block;
  }
  if (truncated.length > 0) {
    body += [
      "",
      "---",
      "",
      `NOTE: ${truncated.length} file${truncated.length === 1 ? " was" : "s were"} omitted to stay under the prompt limit:`,
      ...truncated.map((p) => `  - ${p}`),
      "",
      "Mention this at the top of your review so the user knows the inspection is incomplete.",
    ].join("\n");
  }
  return body;
}

/** Convenience: count chars in the would-be prompt so the UI can warn
 *  the user before they spend tokens on an inspection of a giant
 *  project. */
export function estimateInspectionSize(project: Record<string, ProjectFile>): {
  files: number;
  chars: number;
  willTruncate: boolean;
} {
  const files = Object.values(project).filter((f) => f.content.trim().length > 0);
  const chars = files.reduce((n, f) => n + f.content.length, 0);
  return { files: files.length, chars, willTruncate: chars > MAX_INLINE_CHARS };
}
