/**
 * Slash command registry. Each command is a small action the user
 * can trigger from the prompt bar by typing "/" followed by the
 * command name. Pattern matches Claude Code / Cursor / Discord.
 *
 * Two kinds of action:
 *   - imperative side-effect (open modal, start new chat)
 *   - prompt-rewrite (replace the textarea with a starter prompt)
 *
 * The PromptBar dispatches via `exec(ctx)`. CompareChat owns the
 * context (it has `openRulesModal`, `newChat`, etc.) and passes it
 * down to PromptBar as one prop bundle. Adding a new command means
 * adding one entry here — no PromptBar changes required.
 */

export type SlashContext = {
  /** Replace the textarea's content. Used by prompt-rewrite commands
   *  like /explain that leave the cursor positioned for the user to
   *  fill in the rest. */
  setText: (text: string) => void;
  /** Open the Project Rules modal (the CLAUDE.md editor). */
  openRulesModal: () => void;
  /** Start a fresh chat — drops the current session. */
  newChat: () => void;
};

export type SlashCommand = {
  /** Name without the leading slash, e.g. "rules". */
  name: string;
  /** One-line description shown in the menu. */
  description: string;
  /** Optional secondary line — usage hint or example. */
  hint?: string;
  /** What pressing Enter on this command does. */
  exec: (ctx: SlashContext) => void;
};

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: "rules",
    description: "Edit project rules",
    hint: "Open the CLAUDE.md-style editor",
    exec: ({ openRulesModal, setText }) => {
      openRulesModal();
      setText("");
    },
  },
  {
    name: "clear",
    description: "Start a new chat",
    hint: "Drop the current conversation, keep models selected",
    exec: ({ newChat }) => {
      newChat();
    },
  },
  {
    name: "explain",
    description: "Explain code",
    hint: "Paste code below this line and send",
    exec: ({ setText }) => setText("Explain this code, step by step:\n\n"),
  },
  {
    name: "fix",
    description: "Fix a bug",
    hint: "Describe the bug below and paste the code",
    exec: ({ setText }) => setText("Find and fix the bug in this code. Be precise about what was wrong:\n\n"),
  },
  {
    name: "test",
    description: "Write tests",
    hint: "Paste the code; the AI writes Jest/Vitest tests for it",
    exec: ({ setText }) => setText("Write thorough unit tests for this code. Cover edge cases:\n\n"),
  },
  {
    name: "refactor",
    description: "Refactor code",
    hint: "Clean up without changing behavior",
    exec: ({ setText }) => setText("Refactor this code for readability. Keep behavior identical. Explain what you changed:\n\n"),
  },
  {
    name: "review",
    description: "Code review",
    hint: "Get a critical review of code you paste below",
    exec: ({ setText }) => setText("Review this code as a senior engineer. Flag bugs, security issues, and style problems:\n\n"),
  },
  {
    name: "docs",
    description: "Generate documentation",
    hint: "Get a README / JSDoc draft from the code",
    exec: ({ setText }) => setText("Write clear documentation for this code (README + JSDoc):\n\n"),
  },
];

/** Parse the textarea's current value. If it looks like a slash
 *  trigger (`/`, `/r`, `/rules`), return the query string so the menu
 *  can filter; otherwise return null and the menu stays hidden.
 *
 *  Trigger rules:
 *    - Starts with "/"
 *    - First token only — once the user types a space or newline
 *      after the command word, the trigger is gone.
 */
export function detectSlashTrigger(value: string): string | null {
  if (!value.startsWith("/")) return null;
  // The trigger covers everything from the leading "/" up to the
  // first whitespace. If a space exists, the user has moved past
  // the slash command into the prompt body — don't show the menu.
  const sliced = value.slice(1);
  if (/\s/.test(sliced)) return null;
  return sliced;
}

/** Filter the command list by prefix match. Empty query returns all
 *  commands so a bare "/" shows the full menu. */
export function filterSlashCommands(query: string): SlashCommand[] {
  const q = query.toLowerCase().trim();
  if (!q) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter((c) => c.name.startsWith(q));
}
