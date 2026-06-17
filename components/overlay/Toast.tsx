"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type ToastKind = "info" | "success" | "agent" | "team";
type Toast = { id: number; kind: ToastKind; title: string; detail?: string };

const ToastCtx = createContext<{
  push: (t: Omit<Toast, "id">) => void;
} | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast used outside ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 3500);
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastView({ toast }: { toast: Toast }) {
  const accent =
    toast.kind === "success"
      ? "#5cb27e"
      : toast.kind === "agent"
      ? "#8a6dc4"
      : toast.kind === "team"
      ? "#cc785c"
      : "#5a5a55";

  return (
    <div
      className="pointer-events-auto bg-[#1a1a18] text-white rounded-xl shadow-[0_12px_36px_-8px_rgba(0,0,0,0.45)] px-4 py-3 min-w-[280px] max-w-[360px] animate-[toast-in_220ms_cubic-bezier(0.16,1,0.3,1)_forwards]"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="text-[12.5px] font-medium leading-tight">{toast.title}</div>
      {toast.detail && (
        <div className="text-[11.5px] text-white/65 mt-0.5 leading-snug">{toast.detail}</div>
      )}
      <style jsx global>{`
        @keyframes toast-in {
          from {
            opacity: 0;
            transform: translateY(-10px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}

/** Live event simulator — fires every ~10s with random teammate activity */
export function useLiveEventSimulator(callbacks: {
  onChatMessage?: (msg: { person: string; color: string; text: string }) => void;
  onActivity?: (a: { actor: string; action: string; target: string; detail: string; color: string }) => void;
  onConversation?: (c: { person: string; color: string; app: string; prompt: string; response: string }) => void;
  toastPush: (t: { kind: ToastKind; title: string; detail?: string }) => void;
}) {
  useEffect(() => {
    const SIMULATED_EVENTS: Array<() => void> = [
      () => {
        callbacks.onChatMessage?.({
          person: "Sarah",
          color: "#5b8c7a",
          text: "merging the OAuth fix in 5",
        });
        callbacks.toastPush({
          kind: "team",
          title: "Sarah · Team Chat",
          detail: "merging the OAuth fix in 5",
        });
      },
      () => {
        callbacks.onActivity?.({
          actor: "Mike",
          action: "ran tests",
          target: "src/auth/*.test.ts",
          detail: "14 passed · 0 failed",
          color: "#8a6dc4",
        });
        callbacks.toastPush({
          kind: "agent",
          title: "Mike's tests passed",
          detail: "14/14 · src/auth/*.test.ts",
        });
      },
      () => {
        callbacks.onConversation?.({
          person: "Sarah",
          color: "#5b8c7a",
          app: "Cursor",
          prompt: "Add a debounce to the token refresh so concurrent calls share one promise",
          response: "Add a Map<token, Promise> module-level. When refreshIfNearExpiry fires, check the map first; if a promise exists for that token, await it instead of starting a new request...",
        });
        callbacks.toastPush({
          kind: "info",
          title: "Sarah · Cursor",
          detail: "asked about debouncing token refresh",
        });
      },
      () => {
        callbacks.onChatMessage?.({
          person: "Mike",
          color: "#8a6dc4",
          text: "PR #142 ready for review when you're free",
        });
        callbacks.toastPush({
          kind: "team",
          title: "Mike · Team Chat",
          detail: "PR #142 ready for review",
        });
      },
      () => {
        callbacks.onActivity?.({
          actor: "Sarah",
          action: "committed",
          target: "fix(auth): debounce token refresh",
          detail: "8a3f12c → main",
          color: "#5b8c7a",
        });
      },
    ];

    let i = 0;
    const interval = setInterval(() => {
      SIMULATED_EVENTS[i % SIMULATED_EVENTS.length]();
      i++;
    }, 9000);

    return () => clearInterval(interval);
  }, [callbacks]);
}
