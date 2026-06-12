"use client";

/**
 * Model picker — Cursor-style catalog.
 *
 * Layout matches Cursor's Settings → Models catalog:
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ Choose models                                       ×     │
 *   ├──────────────────────────────────────────────────────────┤
 *   │  Anthropic (Claude)                  3 / 4 · select all  │
 *   │  ─────────────────────────────────────────────────────   │
 *   │  ☑ Claude Sonnet 4.5                                     │
 *   │     Anthropic's current flagship coder.                  │
 *   │  ☐ Claude Opus 4.1                                       │
 *   │     Deepest Claude reasoning — slower, costlier.         │
 *   │  ...                                                     │
 *   │                                                          │
 *   │  OpenAI (GPT)                        2 / 6 · select all  │
 *   │  ─────────────────────────────────────────────────────   │
 *   │  ☑ GPT-4o                                                │
 *   │  ...                                                     │
 *   ├──────────────────────────────────────────────────────────┤
 *   │  5 selected           [ Start chatting with 5 models → ] │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Rows (not chips) so the model description is always visible — Cursor
 * does this exactly. Each provider header has a "select all / clear"
 * shortcut. Disabled providers (no env key on server) show an inline
 * "needs <ENV_VAR>" badge instead of being hidden, so the user knows
 * which models would appear once they add the key.
 */

import { useEffect, useMemo } from "react";
import { MODELS, type CompareModel, type ProviderId } from "@/lib/compare/models";

type Props = {
  selected: Set<string>;
  onToggle: (id: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  availableProviders: Set<ProviderId>;
};

const PROVIDER_LABEL: Record<ProviderId, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI (GPT)",
  perplexity: "Perplexity",
  gemini: "Google (Gemini)",
  xai: "xAI (Grok)",
  deepseek: "DeepSeek",
};

const PROVIDER_ORDER: ProviderId[] = [
  "anthropic", "openai", "perplexity", "gemini", "xai", "deepseek",
];

const ENV_HINT: Record<ProviderId, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  perplexity: "PERPLEXITY_API_KEY",
  gemini: "GEMINI_API_KEY",
  xai: "XAI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
};

export function ModelPickerModal({
  selected, onToggle, onConfirm, onClose, availableProviders,
}: Props) {
  const groups = useMemo(() => {
    const byProvider = new Map<ProviderId, CompareModel[]>();
    for (const m of MODELS) {
      if (!byProvider.has(m.provider)) byProvider.set(m.provider, []);
      byProvider.get(m.provider)!.push(m);
    }
    return PROVIDER_ORDER
      .filter((p) => byProvider.has(p))
      .map((p) => ({ provider: p, models: byProvider.get(p)! }));
  }, []);

  // Esc closes; body scroll locked while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose models"
      onClick={onClose}
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-stretch sm:items-center justify-center p-0 sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[720px] max-h-[100vh] sm:max-h-[88vh] bg-[#161616] sm:rounded-2xl border border-white/10 overflow-hidden flex flex-col shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-white text-[16px] font-medium">Choose models</h2>
            <p className="text-white/40 text-[12px] mt-0.5">
              Each prompt fans out to every selected model in parallel.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white text-[22px] leading-none w-8 h-8 rounded-full hover:bg-white/10 transition"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">
          {groups.map(({ provider, models }) => (
            <ProviderGroup
              key={provider}
              provider={provider}
              models={models}
              selected={selected}
              onToggle={onToggle}
              isAvailable={availableProviders.has(provider)}
            />
          ))}
        </div>

        <footer className="flex items-center justify-between gap-3 px-6 py-4 border-t border-white/10 shrink-0 bg-[#161616]">
          <span className="text-[12px] text-white/50 font-mono uppercase tracking-wider">
            {selected.size} selected
          </span>
          <button
            type="button"
            onClick={onConfirm}
            disabled={selected.size === 0}
            className="px-5 py-2 rounded-full text-[14px] font-medium bg-[#d97757] text-white hover:bg-[#c6613f] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {selected.size === 0
              ? "Pick at least one model"
              : `Start chatting with ${selected.size} model${selected.size === 1 ? "" : "s"} →`}
          </button>
        </footer>
      </div>
    </div>
  );
}

function ProviderGroup({
  provider, models, selected, onToggle, isAvailable,
}: {
  provider: ProviderId;
  models: CompareModel[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  isAvailable: boolean;
}) {
  const selectedCount = models.reduce(
    (n, m) => n + (selected.has(m.id) ? 1 : 0),
    0,
  );
  const allOn = selectedCount === models.length;

  function selectAll() {
    if (!isAvailable) return;
    if (allOn) {
      for (const m of models) if (selected.has(m.id)) onToggle(m.id);
    } else {
      for (const m of models) if (!selected.has(m.id)) onToggle(m.id);
    }
  }

  return (
    <section>
      {/* Provider header — name + env badge + select-all shortcut. */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <h3 className="text-white text-[13.5px] font-medium tracking-wide">
            {PROVIDER_LABEL[provider]}
          </h3>
          {!isAvailable ? (
            <span
              title={`Set ${ENV_HINT[provider]} in .env.local on the server to enable these models`}
              className="text-[10px] text-amber-400/80 font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-400/30"
            >
              needs {ENV_HINT[provider]}
            </span>
          ) : (
            <span className="text-[10px] text-white/30 font-mono uppercase tracking-wider">
              {selectedCount} / {models.length}
            </span>
          )}
        </div>
        {isAvailable && (
          <button
            type="button"
            onClick={selectAll}
            className="text-[11.5px] text-white/45 hover:text-white/85 transition-colors"
          >
            {allOn ? "Clear all" : "Select all"}
          </button>
        )}
      </div>

      {/* Model rows. */}
      <ul className="mt-1.5">
        {models.map((m) => (
          <ModelRow
            key={m.id}
            model={m}
            isOn={selected.has(m.id)}
            isAvailable={isAvailable}
            envHint={ENV_HINT[provider]}
            onToggle={() => onToggle(m.id)}
          />
        ))}
      </ul>
    </section>
  );
}

function ModelRow({
  model, isOn, isAvailable, envHint, onToggle,
}: {
  model: CompareModel;
  isOn: boolean;
  isAvailable: boolean;
  envHint: string;
  onToggle: () => void;
}) {
  const disabled = !isAvailable;
  return (
    <li>
      <button
        type="button"
        onClick={() => !disabled && onToggle()}
        disabled={disabled}
        title={disabled ? `Set ${envHint} on the server to enable` : model.blurb}
        className={[
          "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
          disabled
            ? "opacity-40 cursor-not-allowed"
            : "hover:bg-white/[0.04]",
          isOn && !disabled ? "bg-[#d97757]/[0.07]" : "",
        ].join(" ")}
      >
        <CheckSquare on={isOn && !disabled} disabled={disabled} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={[
              "text-[13.5px] font-medium truncate",
              disabled ? "text-white/40" : "text-white",
            ].join(" ")}>
              {model.label}
            </span>
            <span className="text-[10px] text-white/30 font-mono truncate">
              {model.model}
            </span>
          </div>
          <p className={[
            "text-[12px] leading-[1.45] mt-0.5",
            disabled ? "text-white/30" : "text-white/55",
          ].join(" ")}>
            {model.blurb}
          </p>
        </div>
      </button>
    </li>
  );
}

/** Square checkbox glyph matching Cursor's list style. Filled clay when
 *  on, hollow grey when off, faded outline when disabled. */
function CheckSquare({ on, disabled }: { on: boolean; disabled: boolean }) {
  if (disabled) {
    return (
      <span
        aria-hidden
        className="mt-0.5 inline-block w-[16px] h-[16px] rounded-[4px] border border-white/15 shrink-0"
      />
    );
  }
  if (on) {
    return (
      <span
        aria-hidden
        className="mt-0.5 inline-flex items-center justify-center w-[16px] h-[16px] rounded-[4px] bg-[#d97757] shrink-0"
      >
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6.2 L5 8.5 L9.5 3.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="mt-0.5 inline-block w-[16px] h-[16px] rounded-[4px] border border-white/25 shrink-0"
    />
  );
}
