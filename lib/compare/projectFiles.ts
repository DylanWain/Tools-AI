/**
 * Code-mode output parser. Extracts file blocks from each agent's
 * streamed response and aggregates them into a virtual project tree
 * with conflict detection.
 *
 * Output format we tell the agents to use:
 *
 *   ```ts:app/login/page.tsx
 *   export default function LoginPage() { ... }
 *   ```
 *
 *   ```css:app/globals.css
 *   .container { ... }
 *   ```
 *
 * The path after the colon is the relative file path; the prefix is
 * the language tag (optional but encouraged for syntax hints).
 *
 * Conflict rule: if two agents both emit a block for the same path,
 * the FIRST writer "owns" the file and any subsequent writers are
 * recorded in `conflictingSlotIds` so the UI can mark the row red.
 */

import type { ProjectFile } from "./sessions";

/**
 * Match a code-fence with a `lang:path` header. The path may contain
 * any non-space character so paths with subdirectories work.
 *
 * Regex breakdown:
 *   ```                           opening fence
 *   ([a-zA-Z0-9+\-]+)?            optional language tag
 *   :                             separator
 *   (\S+)                         path (one or more non-space chars)
 *   \n                            newline
 *   ([\s\S]*?)                    body (non-greedy)
 *   ```                           closing fence (lookahead also handled)
 *
 * We export a SEPARATE regex for "incomplete" (no closing fence yet)
 * so the project tree can still show files mid-stream as they're typed.
 */
// Code-fence with explicit `lang:path` header (preferred).
const COMPLETE_PATH_RE = /```([a-zA-Z0-9+\-]*):(\S+)\n([\s\S]*?)```/g;
const INCOMPLETE_PATH_RE = /```([a-zA-Z0-9+\-]*):(\S+)\n([\s\S]*?)$/;

// Code-fence with only a language tag — no path. Compare mode uses
// this because the user's prompt is just "write a function" and the
// model emits ```ts / ```html / etc. with no file. We synthesize a
// per-block path below.
const COMPLETE_LANG_RE = /```([a-zA-Z0-9+\-]+)\n([\s\S]*?)```/g;
const INCOMPLETE_LANG_RE = /```([a-zA-Z0-9+\-]+)\n([\s\S]*?)$/;

export type ParsedBlock = {
  path: string;
  language?: string;
  content: string;
  complete: boolean;
  /** True if the path was synthesized because the fence had no
   *  explicit `lang:path` header. UI can render these slightly
   *  differently (e.g. "snippet" badge). */
  synthesizedPath?: boolean;
};

/** Pure: scan a single agent's accumulated text into all file blocks.
 *  Catches both `lang:path` (Veronum convention) and plain `lang`
 *  (compare-mode style) fences. Path-less blocks get a synthesized
 *  path under `<synthHint>/snippet-N.<ext>` so the project tree
 *  always has something stable to render against. */
export function parseAgentOutput(text: string, synthHint = "snippet"): ParsedBlock[] {
  type Hit = { start: number; end: number; block: ParsedBlock };
  const hits: Hit[] = [];

  // Pass 1 — explicit `lang:path` blocks.
  const pathRe = new RegExp(COMPLETE_PATH_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = pathRe.exec(text)) !== null) {
    hits.push({
      start: m.index,
      end: pathRe.lastIndex,
      block: {
        path: m[2],
        language: m[1] || undefined,
        content: m[3],
        complete: true,
      },
    });
  }

  // Pass 2 — plain `lang` blocks. Skip any span already consumed by a
  // path-tagged hit so we don't double-count.
  const langRe = new RegExp(COMPLETE_LANG_RE.source, "g");
  let synthIdx = 0;
  while ((m = langRe.exec(text)) !== null) {
    const inside = hits.some((h) => m!.index >= h.start && m!.index < h.end);
    if (inside) continue;
    const lang = m[1];
    if (lang.includes(":")) continue;
    synthIdx += 1;
    hits.push({
      start: m.index,
      end: langRe.lastIndex,
      block: {
        path: `${synthHint}/snippet-${synthIdx}.${extFor(lang)}`,
        language: lang,
        content: m[2],
        complete: true,
        synthesizedPath: true,
      },
    });
  }

  hits.sort((a, b) => a.start - b.start);

  // Trailing in-progress fence (only one possible — the last open).
  const lastEnd = hits.length ? hits[hits.length - 1].end : 0;
  const tail = text.slice(lastEnd);
  const incompletePath = INCOMPLETE_PATH_RE.exec(tail);
  const incompleteLang = INCOMPLETE_LANG_RE.exec(tail);
  let trailing: ParsedBlock | null = null;
  if (incompletePath) {
    trailing = {
      path: incompletePath[2],
      language: incompletePath[1] || undefined,
      content: incompletePath[3],
      complete: false,
    };
  } else if (incompleteLang && !incompleteLang[1].includes(":")) {
    synthIdx += 1;
    trailing = {
      path: `${synthHint}/snippet-${synthIdx}.${extFor(incompleteLang[1])}`,
      language: incompleteLang[1],
      content: incompleteLang[2],
      complete: false,
      synthesizedPath: true,
    };
  }

  const out = hits.map((h) => h.block);
  if (trailing) out.push(trailing);
  return out;
}

const EXT_BY_LANG: Record<string, string> = {
  ts: "ts", tsx: "tsx", js: "js", jsx: "jsx",
  py: "py", python: "py",
  rs: "rs", rust: "rs",
  go: "go",
  rb: "rb", ruby: "rb",
  java: "java", kt: "kt", kotlin: "kt", swift: "swift",
  c: "c", cpp: "cpp", "c++": "cpp", h: "h", hpp: "hpp",
  cs: "cs", "c#": "cs",
  html: "html", css: "css", scss: "scss", sass: "sass",
  json: "json", yaml: "yaml", yml: "yml", toml: "toml",
  md: "md", markdown: "md",
  sh: "sh", bash: "sh", zsh: "sh", shell: "sh",
  sql: "sql",
  php: "php",
};
function extFor(lang: string): string {
  const norm = lang.toLowerCase();
  return EXT_BY_LANG[norm] ?? (norm.replace(/[^a-z0-9]/g, "") || "txt");
}

/** Aggregate one or more (slotId, parsed blocks) into the project
 *  tree. First-writer-wins for ownership; later writers are recorded
 *  as conflicts. */
export function buildProject(
  inputs: Array<{ slotId: string; blocks: ParsedBlock[] }>,
): Record<string, ProjectFile> {
  const project: Record<string, ProjectFile> = {};
  for (const { slotId, blocks } of inputs) {
    for (const b of blocks) {
      const existing = project[b.path];
      if (!existing) {
        project[b.path] = {
          path: b.path,
          language: b.language,
          content: b.content,
          ownerSlotId: slotId,
          complete: b.complete,
        };
      } else if (existing.ownerSlotId === slotId) {
        // Same owner re-emitted (e.g. streamed update) — replace.
        project[b.path] = {
          ...existing,
          language: b.language ?? existing.language,
          content: b.content,
          complete: b.complete,
        };
      } else {
        // Different agent wrote to a file already claimed — conflict.
        const conflicts = existing.conflictingSlotIds ?? [];
        if (!conflicts.includes(slotId)) {
          project[b.path] = {
            ...existing,
            conflictingSlotIds: [...conflicts, slotId],
          };
        }
      }
    }
  }
  return project;
}

/** Pretty file size for the project view. */
export function sizeOf(content: string): string {
  const bytes = new Blob([content]).size;
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/** Detect overlapping file claims BEFORE sending (so the user can
 *  resolve up-front instead of producing a conflict at output time). */
export function detectClaimOverlap(
  claims: Array<{ slotId: string; files: string[] }>,
): Array<{ path: string; slotIds: string[] }> {
  const byPath = new Map<string, string[]>();
  for (const c of claims) {
    for (const f of c.files) {
      const norm = f.trim();
      if (!norm) continue;
      const arr = byPath.get(norm) ?? [];
      if (!arr.includes(c.slotId)) arr.push(c.slotId);
      byPath.set(norm, arr);
    }
  }
  const overlaps: Array<{ path: string; slotIds: string[] }> = [];
  for (const [path, slotIds] of byPath.entries()) {
    if (slotIds.length > 1) overlaps.push({ path, slotIds });
  }
  return overlaps;
}
