"use client";

/**
 * AutoResearchComposer — the input UI for the "Auto-research" mode.
 *
 * Two sub-modes:
 *   - Auto: just type a prompt. /api/auto-classify picks the lineup
 *     on Send; the user sees the chosen models AFTER the chain starts
 *     (visible in the PipelineView).
 *   - Manual: type a prompt + arrange your own ordered lineup (up to 5
 *     models). Each model in the list can be moved up/down or removed.
 *
 * Rounds slider — 1 to 5. Default 2 (matches the user's described
 * Alzheimer's research use case: Gemini → GPT → Claude → Gemini → GPT
 * → Claude).
 *
 * The "Send" button is disabled until: prompt is non-empty AND
 * (auto mode OR manual lineup has ≥1 model).
 */

import { useState } from "react";
import { MODELS, type CompareModel, type ProviderId } from "@/lib/compare/models";

type Mode = "auto" | "manual";

type Props = {
  busy: boolean;
  onSubmit: (input: {
    prompt: string;
    mode: Mode;
    /** Only present in manual mode. */
    manualLineup?: CompareModel[];
    rounds: number;
  }) => void;
  onCancel: () => void;
  availableProviders: Set<ProviderId>;
  autoFocus?: boolean;
};

const MAX_MANUAL_MODELS = 5;

export function AutoResearchComposer({
  busy, onSubmit, onCancel, availableProviders, autoFocus,
}: Props) {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<Mode>("auto");
  const [rounds, setRounds] = useState(2);
  const [manualLineup, setManualLineup] = useState<CompareModel[]>(() =>
    defaultManualLineup(availableProviders),
  );

  const canSubmit =
    !busy &&
    prompt.trim().length > 0 &&
    (mode === "auto" || manualLineup.length > 0);

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({
      prompt: prompt.trim(),
      mode,
      manualLineup: mode === "manual" ? manualLineup : undefined,
      rounds,
    });
    setPrompt("");
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#161616] p-4 space-y-4">
      {/* Mode toggle + rounds */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex bg-white/[0.04] rounded-full p-1 text-[12.5px]">
          {(["auto", "manual"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={[
                "px-3.5 py-1.5 rounded-full transition-colors capitalize",
                mode === m
                  ? "bg-white text-black font-medium"
                  : "text-white/65 hover:text-white",
              ].join(" ")}
            >
              {m === "auto" ? "Auto pick" : "Manual lineup"}
            </button>
          ))}
        </div>
        <div className="inline-flex items-center gap-2 text-[12px] text-white/55">
          <span className="font-mono uppercase tracking-wider text-[10px] text-white/40">Rounds</span>
          <div className="inline-flex bg-white/[0.04] rounded-md overflow-hidden">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRounds(n)}
                className={[
                  "px-3 py-1 text-[12.5px] font-mono transition-colors",
                  rounds === n
                    ? "bg-[#d97757] text-white"
                    : "text-white/65 hover:text-white hover:bg-white/[0.04]",
                ].join(" ")}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11.5px] text-white/40 leading-[1.4] flex-1 min-w-[160px]">
          {mode === "auto"
            ? "We'll pick the best lineup for your prompt automatically."
            : `Pipeline runs your ${manualLineup.length}-model lineup × ${rounds} round${rounds === 1 ? "" : "s"} = ${manualLineup.length * rounds} step${manualLineup.length * rounds === 1 ? "" : "s"}.`}
        </p>
      </div>

      {/* Manual lineup builder */}
      {mode === "manual" && (
        <ManualLineupEditor
          lineup={manualLineup}
          onChange={setManualLineup}
          availableProviders={availableProviders}
        />
      )}

      {/* Prompt input */}
      <div className="flex gap-2">
        <textarea
          autoFocus={autoFocus}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          rows={2}
          placeholder={
            mode === "auto"
              ? "What do you want investigated? (Enter to send, Shift+Enter for newline)"
              : "Your prompt — runs through the lineup above, " + rounds + "× rounds"
          }
          className="flex-1 bg-[#0f0f0f] border border-white/10 rounded-md px-3 py-2.5 text-[14px] text-white/95 placeholder:text-white/30 outline-none focus:border-white/30 transition-colors resize-none"
        />
        {busy ? (
          <button
            type="button"
            onClick={onCancel}
            className="self-end px-4 py-2.5 rounded-md text-[14px] font-medium bg-white/[0.08] text-white hover:bg-white/[0.12] transition"
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="self-end px-4 py-2.5 rounded-md text-[14px] font-medium bg-[#d97757] text-white hover:bg-[#c6613f] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}

/** Editable ordered lineup. Each row: model label + up/down + remove.
 *  An "Add model" select at the bottom appends to the end. */
function ManualLineupEditor({
  lineup, onChange, availableProviders,
}: {
  lineup: CompareModel[];
  onChange: (next: CompareModel[]) => void;
  availableProviders: Set<ProviderId>;
}) {
  const lineupIds = new Set(lineup.map((m) => m.id));
  const candidates = MODELS.filter(
    (m) => availableProviders.has(m.provider) && !lineupIds.has(m.id),
  );

  function move(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= lineup.length) return;
    const next = [...lineup];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  function remove(i: number) {
    onChange(lineup.filter((_, k) => k !== i));
  }
  function add(modelId: string) {
    if (!modelId) return;
    if (lineup.length >= MAX_MANUAL_MODELS) return;
    const m = MODELS.find((x) => x.id === modelId);
    if (!m) return;
    onChange([...lineup, m]);
  }

  return (
    <div className="rounded-lg border border-white/[0.06] bg-[#0f0f0f] p-3 space-y-2">
      {lineup.length === 0 ? (
        <p className="text-[12px] text-white/45 px-2 py-1">
          Add at least one model below — they'll run in this order.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {lineup.map((m, i) => (
            <li
              key={m.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/[0.03]"
            >
              <span className="text-[10.5px] text-white/35 font-mono w-5 text-right">{i + 1}.</span>
              <span className="text-[13px] text-white/90 flex-1 truncate">{m.label}</span>
              <span className="text-[10.5px] text-white/35 font-mono">{m.model}</span>
              <div className="flex items-center gap-0.5">
                <IconBtn label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</IconBtn>
                <IconBtn label="Move down" disabled={i === lineup.length - 1} onClick={() => move(i, +1)}>↓</IconBtn>
                <IconBtn label="Remove" onClick={() => remove(i)}>×</IconBtn>
              </div>
            </li>
          ))}
        </ol>
      )}
      {lineup.length < MAX_MANUAL_MODELS && (
        <div className="flex items-center gap-2 pt-1">
          <select
            value=""
            onChange={(e) => { add(e.target.value); e.target.value = ""; }}
            className="flex-1 bg-[#161616] border border-white/10 rounded px-2 py-1.5 text-[12.5px] text-white/85 outline-none focus:border-white/25 transition cursor-pointer"
          >
            <option value="" className="bg-[#161616]">+ Add a model…</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#161616]">
                {c.label} ({c.model})
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function IconBtn({
  children, onClick, disabled, label,
}: { children: React.ReactNode; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="w-6 h-6 inline-flex items-center justify-center text-white/55 hover:text-white hover:bg-white/[0.08] rounded transition disabled:opacity-25 disabled:cursor-not-allowed text-[13px]"
    >
      {children}
    </button>
  );
}

/** Default manual lineup — picks 3 models the user is most likely to
 *  want as a starting point. They can edit from here. */
function defaultManualLineup(available: Set<ProviderId>): CompareModel[] {
  const preferredIds = ["gemini-pro", "gpt-4o", "claude-sonnet-4-5"];
  const out: CompareModel[] = [];
  for (const id of preferredIds) {
    const m = MODELS.find((x) => x.id === id);
    if (m && available.has(m.provider)) out.push(m);
  }
  // If nothing matched (no provider keys), fall back to any 3
  // available models so the editor isn't blank.
  if (out.length === 0) {
    for (const m of MODELS) {
      if (available.has(m.provider)) {
        out.push(m);
        if (out.length >= 3) break;
      }
    }
  }
  return out;
}
