"use client";

/**
 * Floating autocomplete menu shown above the prompt textarea when
 * the user types a leading slash. Matches the Cursor / Discord /
 * Slack convention.
 *
 *   ┌───────────────────────────────┐
 *   │ /rules     Edit project rules │  ← active row, highlighted
 *   │ /clear     Start a new chat   │
 *   │ /explain   Explain code       │
 *   │ /fix       Fix a bug          │
 *   │ ...                           │
 *   └───────────────────────────────┘
 *   ┌───────────────────────────────┐
 *   │ /rules                        │  ← textarea below
 *   └───────────────────────────────┘
 *
 * Keyboard nav lives in PromptBar (Up/Down adjusts activeIndex,
 * Enter fires onPick, Esc closes). This component only renders.
 */

import type { SlashCommand } from "@/lib/compare/slashCommands";

type Props = {
  commands: SlashCommand[];
  activeIndex: number;
  onPick: (cmd: SlashCommand) => void;
  onHoverIndex: (i: number) => void;
};

export function SlashCommandMenu({ commands, activeIndex, onPick, onHoverIndex }: Props) {
  if (commands.length === 0) {
    return (
      <div className="mb-2 rounded-xl border border-white/10 bg-[#161616] shadow-[0_10px_40px_rgba(0,0,0,0.45)] overflow-hidden">
        <div className="px-3 py-3 text-[12.5px] text-white/45">
          No matching commands. Press <kbd className="px-1 py-0.5 rounded bg-white/[0.08] text-white/70 text-[11px] font-mono">Esc</kbd> to cancel.
        </div>
      </div>
    );
  }

  return (
    <div
      role="listbox"
      aria-label="Slash commands"
      className="mb-2 rounded-xl border border-white/10 bg-[#161616] shadow-[0_10px_40px_rgba(0,0,0,0.45)] overflow-hidden max-h-[280px] overflow-y-auto"
    >
      {commands.map((cmd, i) => {
        const isActive = i === activeIndex;
        return (
          <button
            key={cmd.name}
            type="button"
            role="option"
            aria-selected={isActive}
            onMouseDown={(e) => {
              // Mouse-down (not click) so the textarea doesn't blur
              // before the handler fires. Otherwise PromptBar's
              // onBlur logic could close the menu before onPick runs.
              e.preventDefault();
              onPick(cmd);
            }}
            onMouseEnter={() => onHoverIndex(i)}
            className={[
              "w-full text-left px-3 py-2 flex items-center gap-3 transition-colors",
              isActive
                ? "bg-white/[0.06]"
                : "hover:bg-white/[0.03]",
            ].join(" ")}
          >
            <span className={[
              "font-mono text-[13px] shrink-0 min-w-[88px]",
              isActive ? "text-[#d97757]" : "text-white/75",
            ].join(" ")}>
              /{cmd.name}
            </span>
            <span className="flex-1 min-w-0">
              <span className={[
                "block text-[13px] truncate",
                isActive ? "text-white" : "text-white/70",
              ].join(" ")}>
                {cmd.description}
              </span>
              {cmd.hint && (
                <span className="block text-[11.5px] text-white/40 truncate mt-0.5">
                  {cmd.hint}
                </span>
              )}
            </span>
            {isActive && (
              <span className="hidden sm:inline text-[10.5px] uppercase tracking-wider text-white/40 font-mono shrink-0">
                ↵ Enter
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
