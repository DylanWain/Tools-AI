"use client";

/**
 * Multi-select chip picker. Disabled chips show a tooltip explaining
 * which env var is missing — provider availability comes from the
 * server via the `availableProviders` prop so the UI is honest about
 * what will actually answer.
 */

import { MODELS, type ProviderId } from "@/lib/compare/models";

type Props = {
  selected: Set<string>;
  onToggle: (id: string) => void;
  availableProviders: Set<ProviderId>;
};

const ENV_HINT: Record<ProviderId, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  perplexity: "PERPLEXITY_API_KEY",
  gemini: "GEMINI_API_KEY",
  xai: "XAI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
};

export function ModelChips({ selected, onToggle, availableProviders }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {MODELS.map((m) => {
        const isOn = selected.has(m.id);
        const isAvail = availableProviders.has(m.provider);
        const disabled = !isAvail;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => !disabled && onToggle(m.id)}
            disabled={disabled}
            title={disabled ? `Disabled — set ${ENV_HINT[m.provider]} on the server` : m.blurb}
            className={[
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors border",
              disabled
                ? "border-white/10 text-white/30 cursor-not-allowed"
                : isOn
                  ? "text-white"
                  : "border-white/15 text-white/70 hover:border-white/30 hover:text-white",
            ].join(" ")}
            style={
              isOn && !disabled
                ? { backgroundColor: m.accentHex, borderColor: m.accentHex }
                : undefined
            }
          >
            <span
              aria-hidden
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: disabled ? "#3a3a36" : m.accentHex }}
            />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
