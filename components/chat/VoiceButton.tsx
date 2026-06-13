"use client";

/**
 * VoiceButton — press-and-hold mic for the compare composer.
 *
 * Presentational: the parent owns the `useVoiceSession` hook (so it can
 * also call `onReplyFinished` when a turn completes) and passes the API
 * in. First press enables voice (mic permission + Realtime connect);
 * after that, press-and-hold = push-to-talk, and just speaking (hands
 * off the button) talks to the always-on Companion.
 */
import type { MicState } from "@/lib/voice/useVoiceSession";

interface VoiceApi {
  enabled: boolean;
  status: { text: string; kind?: "ok" | "err" };
  micState: MicState;
  enable: () => Promise<void>;
  disable: () => void;
  pttStart: () => void;
  pttEnd: () => Promise<void>;
}

const RING: Record<MicState, string> = {
  off: "text-white/55 hover:text-white/80 hover:bg-white/[0.06]",
  connecting: "text-amber-300 animate-pulse",
  ready: "text-emerald-300 bg-emerald-400/10",
  listening: "text-red-300 bg-red-500/15 ring-2 ring-red-500/40",
  speaking: "text-violet-300 bg-violet-500/15 ring-2 ring-violet-500/40",
};

export function VoiceButton({ voice }: { voice: VoiceApi }) {
  const { micState, enabled, status } = voice;

  // Pointer events unify mouse + touch. preventDefault stops the press
  // from stealing focus / scrolling on mobile.
  const down = (e: React.PointerEvent) => { e.preventDefault(); voice.pttStart(); };
  const up = (e: React.PointerEvent) => { e.preventDefault(); void voice.pttEnd(); };

  return (
    <div className="flex items-center gap-2">
      {status.text ? (
        <span
          className={
            "text-[11px] leading-none max-w-[200px] truncate " +
            (status.kind === "err" ? "text-red-300" : status.kind === "ok" ? "text-emerald-300/90" : "text-white/45")
          }
          title={status.text}
        >
          {status.text}
        </span>
      ) : null}

      <button
        type="button"
        aria-label={enabled ? "Hold to talk" : "Enable voice"}
        title={enabled ? "Hold to talk · just speak for the assistant" : "Enable voice"}
        onPointerDown={down}
        onPointerUp={up}
        onPointerLeave={up}
        onPointerCancel={up}
        className={"h-9 w-9 shrink-0 rounded-full flex items-center justify-center transition select-none touch-none " + RING[micState]}
      >
        <MicIcon />
      </button>

      {enabled ? (
        <button
          type="button"
          aria-label="Stop voice"
          title="Stop voice"
          onClick={() => voice.disable()}
          className="h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-white/45 hover:text-white/80 hover:bg-white/[0.06] transition"
        >
          <span className="text-[15px] leading-none">✕</span>
        </button>
      ) : null}
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 15a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" fill="currentColor" />
      <path d="M6 11v1a6 6 0 0 0 12 0v-1M12 18v3M9 21h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
