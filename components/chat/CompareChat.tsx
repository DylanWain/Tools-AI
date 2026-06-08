"use client";

/**
 * CompareChat — top-level client component for /compare.
 *
 * Two modes, switchable from the toggle above the composer:
 *
 *   Compare   — one prompt fans out to N models, side-by-side answers
 *   Multi-agent — N agent slots, each with its own model + task, run
 *                 in parallel. Mirrors the Veronum desktop 10-agent
 *                 dispatch pattern, just swapping `Claude Code in a
 *                 worktree` for `API call to the chosen model`.
 *
 * Sessions persist to localStorage (lib/compare/sessions.ts) and are
 * listed in the left sidebar. Each Send creates a new session;
 * loading a session populates the response grid read-only and locks
 * the mode to whatever the session was.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MODELS, type ProviderId } from "@/lib/compare/models";
import {
  type AgentSlot,
  type CompareSession,
  type SessionRun,
  type ProjectFile,
  listSessions,
  saveSession,
  deleteSession,
  getSession,
  newSessionId,
  titleFromPrompt,
} from "@/lib/compare/sessions";
import { parseAgentOutput, buildProject } from "@/lib/compare/projectFiles";
import {
  type Attachment,
  toWireAttachment,
} from "@/lib/compare/attachments";
import {
  type FrozenTurn,
  buildHistory,
  freezeTurn,
} from "@/lib/compare/turns";
import {
  type CompareVersion,
  type VersionFile,
  listVersions,
  saveVersion,
  getVersion,
  deleteVersion,
} from "@/lib/compare/versions";
import {
  type EditEvent,
  listEdits,
  appendEdit,
  setEditName as renameEdit,
  computeUndoState,
} from "@/lib/compare/editLog";
import {
  type BridgeGitStatus,
  bridgeStatus as checkBridge,
  bridgeSave,
  bridgeRevert,
} from "@/lib/compare/bridgeGit";
import { PromptBar } from "./PromptBar";
import { MultiAgentComposer } from "./MultiAgentComposer";
import { ResponseBox } from "./ResponseBox";
import { SplitWorkspace } from "./SplitWorkspace";
import { ExpandedModal } from "./ExpandedModal";
import { ModelPickerModal } from "./ModelPickerModal";
import { SessionSidebar } from "./SessionSidebar";
import { ProjectView } from "./ProjectView";
import { VersionHistoryModal } from "./VersionHistoryModal";
import { CompareAuthGate } from "./CompareAuthGate";
import { ComparePaywall } from "./ComparePaywall";
import { AutoResearchComposer } from "./AutoResearchComposer";
import { PipelineView, type PipelineSlot } from "./PipelineView";
import { useCompareStream, type RunSlot, type RunState } from "./useCompareStream";
import { getBrowserSupabase } from "@/lib/supabase";
import { trackActivity } from "@/lib/activity/track";
import { claimSubscriptionIfNeeded } from "@/lib/claim/claim";
import {
  buildStepPrompt,
  buildStepSystemPrompt,
  buildSteps,
} from "@/lib/compare/pipeline";
import type { CompareModel } from "@/lib/compare/models";

type Props = {
  availableProviders: ProviderId[];
};

type Mode = "compare" | "agents" | "auto-research";

export function CompareChat({ availableProviders }: Props) {
  const availSet = useMemo(() => new Set(availableProviders), [availableProviders]);
  const [mode, setMode] = useState<Mode>("compare");

  // Compare-mode state
  const [selected, setSelected] = useState<Set<string>>(() => initialSelection(availSet));
  const [pickerOpen, setPickerOpen] = useState(false);

  // Multi-agent state. The composer is inline (no popup), so we just
  // hold the live draft right here in CompareChat.
  const [agents, setAgents] = useState<AgentSlot[]>([]);
  const [goal, setGoal] = useState<string>("");
  const [agentAttachments, setAgentAttachments] = useState<Attachment[]>([]);
  const codeMode = true;
  // User edits to files in the workspace editor. Keyed by path,
  // wins over the parsed agent output so streaming new content from
  // a future agent doesn't trample a person's typing.
  const [fileEdits, setFileEdits] = useState<Record<string, string>>({});
  // Split workspace (file tree + editor + terminal) visibility.
  // Hidden by default — toggled via the "Code" button in the header.
  // Opens automatically when the first file streams into the project.
  const [workspaceOpen, setWorkspaceOpen] = useState<boolean>(false);
  // Version history modal visibility + a tick that re-derives the
  // edit log / version list whenever we mutate localStorage. (We
  // could subscribe to a storage event, but a manual tick is cheaper
  // and works inside the same tab.)
  const [versionModalOpen, setVersionModalOpen] = useState<boolean>(false);
  const [logTick, setLogTick] = useState<number>(0);
  // Bridge passthrough — when the user is signed in AND has a
  // paired Veronum Bridge that's reachable, save/revert also fire
  // real git commits + GitHub pushes on the user's Mac. Falls back
  // to localStorage if unavailable. Checked once on mount; recheck
  // when the modal opens so a freshly-paired Bridge becomes
  // active without a reload.
  const [bridgeStatus, setBridgeStatus] = useState<BridgeGitStatus>({
    available: false, reason: "not_signed_in",
  });
  const [bridgeSyncing, setBridgeSyncing] = useState<boolean>(false);
  useEffect(() => {
    let cancelled = false;
    checkBridge().then((s) => { if (!cancelled) setBridgeStatus(s); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!versionModalOpen) return;
    checkBridge().then((s) => setBridgeStatus(s));
  }, [versionModalOpen]);
  // Per-path "before" snapshot for the in-flight typing burst. When
  // the user types we coalesce keystrokes into one edit event per
  // burst (debounced ~500ms) so the log doesn't fill up per-char.
  const burstBeforeRef = useRef<Record<string, string>>({});
  const burstTimerRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});

  // Common UI state
  const [favorite, setFavorite] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { runs, start, startWorkflow, startPipeline, cancel, lastSlots, getRun, replaceState } = useCompareStream();
  // Auto-research / pipeline mode state. These three drive the
  // PipelineView render — pipelineSteps is the ordered chain,
  // pipelinePrompt is what the user typed, autoLabel is the
  // category badge ("research", "code", etc.) when auto mode picked
  // the lineup itself. Null when not in auto-research mode.
  const [pipelineSteps, setPipelineSteps] = useState<PipelineSlot[] | null>(null);
  const [pipelinePrompt, setPipelinePrompt] = useState<string>("");
  const [autoLabel, setAutoLabel] = useState<string | null>(null);
  // Subscription state for the auto-research gate. true = subscriber
  // or PAYG, can use pipeline. false = free, locked. null = checking.
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);

  // ── Auth + paywall state ─────────────────────────────────────────
  // `signedIn === null` means "still checking persisted session" — we
  // render a quiet placeholder rather than flash the auth gate to a
  // user who's actually signed in. After the first session check it
  // settles into true/false and stays in sync via onAuthStateChange.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    const supabase = getBrowserSupabase();
    // On every sign-in event, fire a one-time claim attempt against
    // Stripe. The helper is cached per-user_id in localStorage, so
    // signed_in token refreshes don't re-hit the API. If a matching
    // Stripe customer with an active subscription is found, the
    // route promotes them to tier='chad' and the helper reloads the
    // page so the UI picks up the new tier.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const uid = session?.user?.id ?? null;
      setSignedIn(!!uid);
      if (uid) void claimSubscriptionIfNeeded(uid);
    });
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      setSignedIn(!!uid);
      if (uid) void claimSubscriptionIfNeeded(uid);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  // Subscription check — used to lock the Auto-research toggle for
  // free users. Re-runs when signedIn flips so a freshly signed-in
  // user gets their state without a reload.
  useEffect(() => {
    if (!signedIn) { setIsSubscribed(null); return; }
    let cancelled = false;
    // Wrap in async IIFE — supabase's .single() returns a PromiseLike
    // that doesn't expose .catch(), so the try/catch shape is cleaner
    // than chaining .then().catch().
    (async () => {
      try {
        const { data } = await getBrowserSupabase()
          .rpc("veronum_my_billing_state")
          .single();
        if (cancelled) return;
        const b = data as {
          tier?: string;
          has_active_subscription?: boolean;
        } | null;
        const tier = b?.tier ?? "free";
        const ok = !!b?.has_active_subscription || tier === "chad" || tier === "payg" || tier === "admin";
        setIsSubscribed(ok);
      } catch {
        if (!cancelled) setIsSubscribed(false);
      }
    })();
    return () => { cancelled = true; };
  }, [signedIn]);
  // Derive paywall context from any over-quota run. The route returns
  // the same userId/consumed/free numbers on every slot's 402, so
  // we just grab the first one. `paywallDismissed` lets the user click
  // "Hide for now" — next Send re-runs the gate.
  const [paywallDismissed, setPaywallDismissed] = useState(false);
  const paywallContext = useMemo(() => {
    if (paywallDismissed) return null;
    for (const r of Object.values(runs)) {
      if (r.errorKind === "over_quota" && r.userId !== undefined
        && r.consumedCents !== undefined && r.freeTrialCents !== undefined) {
        return {
          userId: r.userId,
          consumedCents: r.consumedCents,
          freeTrialCents: r.freeTrialCents,
        };
      }
    }
    return null;
  }, [runs, paywallDismissed]);
  // Auth-required modal — pops when /api/compare returns 401 on a Send
  // attempt and the user isn't currently signed in. Mutually exclusive
  // with the paywall (you need a JWT for 402 to be possible at all).
  // Also pops when the user clicks "Sign in" in the bottom-left
  // sidebar footer (manualAuthOpen).
  const [manualAuthOpen, setManualAuthOpen] = useState(false);
  const authRequired = useMemo(() => {
    if (signedIn) return false;
    if (manualAuthOpen) return true;
    return Object.values(runs).some((r) => r.errorKind === "auth");
  }, [runs, signedIn, manualAuthOpen]);

  /** Clear auth-errored runs AND drop the manual "Sign in" flag so the
   *  auth modal closes and the user sees the composer again. Called
   *  from the modal's backdrop click, Escape key, and after a
   *  successful sign-in (right before retry). */
  const clearAuthErrors = useCallback(() => {
    setManualAuthOpen(false);
    const cleaned: Record<string, RunState> = {};
    for (const [id, r] of Object.entries(runs)) {
      if (r.errorKind !== "auth") cleaned[id] = r;
    }
    replaceState(cleaned, lastSlots);
  }, [runs, lastSlots, replaceState]);

  // Auto-retry on sign-in. The user clicked a magic link, came back
  // signed in — we want them to SEE THE RESPONSES to the prompt they
  // originally tried to send, not stale "unauthenticated" error cards.
  // Fires the previously-blocked slots again now that the bearer token
  // is available. Only runs when signedIn flips true AND we have a
  // batch with auth errors to retry — no-op otherwise.
  useEffect(() => {
    if (!signedIn) return;
    const hasAuthErrors = Object.values(runs).some((r) => r.errorKind === "auth");
    if (!hasAuthErrors || lastSlots.length === 0) return;
    // Re-fire the same slots; useCompareStream's start() resets the
    // runs map for these IDs, so the stale errors get replaced with
    // fresh streaming state.
    void start(lastSlots);
    // intentionally only depend on signedIn — we want this to fire
    // ONCE when sign-in completes, not every time runs/lastSlots change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  // Escape key dismisses the auth modal (matches the modal pattern in
  // VersionHistoryModal). Only active while the modal is showing.
  useEffect(() => {
    if (!authRequired) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearAuthErrors();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [authRequired, clearAuthErrors]);
  // Compare-mode transcript. Every completed Send becomes one FrozenTurn
  // here; lastSlots/runs hold the IN-FLIGHT (or most recent) batch.
  // When the user submits a new prompt, the current live batch is frozen
  // into turns, then the new batch streams. The turn's `pickedSlotId`
  // controls which card flows into subsequent multi-turn history — the
  // user can click any card later to change their pick. (See
  // lib/compare/turns.ts for the buildHistory rules.)
  const [turns, setTurns] = useState<FrozenTurn[]>([]);

  // Sessions
  const [sessions, setSessions] = useState<CompareSession[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);

  useEffect(() => { setSessions(listSessions()); }, []);

  const busy = Object.values(runs).some((r) => r.status === "streaming");
  const hasContent = lastSlots.length > 0 || turns.length > 0;
  const expandedSlot = expandedId ? lastSlots.find((s) => s.id === expandedId) : null;
  const expandedModel = expandedSlot ? MODELS.find((m) => m.id === expandedSlot.modelId) : null;

  // Code-mode: parse each agent's output into file blocks on every
  // render and aggregate into the project tree. Cheap because the
  // parser is pure regex over short strings — re-runs as fast as
  // tokens arrive.
  const project: Record<string, ProjectFile> = useMemo(() => {
    // Parse code blocks in BOTH modes — compare-mode answers often
    // include "```html\n…\n```" blocks even though the user didn't ask
    // for a file path. The parser synthesizes paths per-slot.
    const inputs = lastSlots
      .filter((s) => s.role !== "synthesizer")
      .map((s) => {
        const model = MODELS.find((m) => m.id === s.modelId);
        const hint = model?.label?.replace(/\s+/g, "-") || s.modelId;
        return {
          slotId: s.id,
          blocks: parseAgentOutput(runs[s.id]?.text ?? "", hint),
        };
      });
    const built = buildProject(inputs);
    // Layer user edits on top — typing in the editor beats incoming
    // agent stream content for that same path.
    for (const [path, content] of Object.entries(fileEdits)) {
      const existing = built[path];
      if (existing) {
        built[path] = { ...existing, content, complete: true };
      } else {
        // User-created file (typed content for a path no agent emitted).
        built[path] = {
          path,
          content,
          ownerSlotId: "user",
          complete: true,
        };
      }
    }
    return built;
  }, [mode, codeMode, lastSlots, runs, fileEdits]);

  // Auto-open the workspace the first time an agent emits a file —
  // saves a click without forcing the panel on users who never get
  // there. Re-toggle and we honor the user's last preference.
  const projectHasFiles = Object.keys(project).length > 0;
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (projectHasFiles && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      setWorkspaceOpen(true);
    }
  }, [projectHasFiles]);

  // Friendly labels for the project view's owner badges
  // ("Agent 1 · Claude Sonnet").
  const slotLabels = useMemo(() => {
    const out: Record<string, string> = {};
    lastSlots.forEach((s, idx) => {
      const model = MODELS.find((m) => m.id === s.modelId);
      out[s.id] = `Agent ${idx + 1} · ${model?.label ?? s.modelId}`;
    });
    return out;
  }, [lastSlots]);

  // ── Edit log + versions (per-session) ────────────────────────────
  // logTick is bumped after every appendEdit / saveVersion so the
  // memoized reads pick up the fresh localStorage state.
  const currentEdits: EditEvent[] = useMemo(
    () => (currentId ? listEdits(currentId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentId, logTick],
  );
  const undoState = useMemo(() => computeUndoState(currentEdits), [currentEdits]);
  const currentVersions: CompareVersion[] = useMemo(
    () => (currentId ? listVersions(currentId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentId, logTick],
  );
  // Snapshot for the "Save" button — every file in the workspace
  // collapsed to { content, language }.
  const currentVersionFiles: Record<string, VersionFile> = useMemo(() => {
    const out: Record<string, VersionFile> = {};
    for (const [path, pf] of Object.entries(project)) {
      out[path] = { content: pf.content, language: pf.language };
    }
    return out;
  }, [project]);

  /** Debounced recorder. When the user types in the editor we
   *  coalesce a typing burst (~500ms idle) into one EditEvent so the
   *  log doesn't fill up per-keystroke. */
  function scheduleUserEditRecord(path: string, after: string) {
    if (!currentId) return;
    // Lazily capture the "before" snapshot once per burst.
    if (!(path in burstBeforeRef.current)) {
      const existing = project[path];
      burstBeforeRef.current[path] = existing?.content ?? "";
    }
    if (burstTimerRef.current[path]) {
      clearTimeout(burstTimerRef.current[path]!);
    }
    burstTimerRef.current[path] = setTimeout(() => {
      const before = burstBeforeRef.current[path];
      if (before !== after) {
        appendEdit({
          sessionId: currentId,
          source: "user",
          filePath: path,
          before,
          after,
        });
        setLogTick((t) => t + 1);
      }
      delete burstBeforeRef.current[path];
      delete burstTimerRef.current[path];
    }, 500);
  }

  function handleFileEdit(path: string, content: string) {
    setFileEdits((prev) => ({ ...prev, [path]: content }));
    scheduleUserEditRecord(path, content);
  }

  function handleUndo() {
    if (!currentId || !undoState.nextUndo) return;
    const e = undoState.nextUndo;
    // Apply the "before" content back into the fileEdits overlay.
    setFileEdits((prev) => ({ ...prev, [e.filePath]: e.before }));
    appendEdit({
      sessionId: currentId,
      source: "undo",
      filePath: e.filePath,
      before: e.after,
      after: e.before,
      undoneId: e.id,
    });
    setLogTick((t) => t + 1);
  }

  function handleRedo() {
    if (!currentId || !undoState.nextRedo) return;
    const undoEvent = undoState.nextRedo;
    // The original event is what we're re-applying. nextRedo.before
    // is the post-undo content, nextRedo.after is the post-original
    // content (= pre-undo).
    setFileEdits((prev) => ({ ...prev, [undoEvent.filePath]: undoEvent.before }));
    appendEdit({
      sessionId: currentId,
      source: "redo",
      filePath: undoEvent.filePath,
      before: undoEvent.after,
      after: undoEvent.before,
      undoneId: undoEvent.undoneId,
    });
    setLogTick((t) => t + 1);
  }

  function handleSaveVersion(name: string) {
    if (!currentId) return;
    // Always write locally first — guarantees the save survives
    // even if the Bridge round-trip fails or the user is offline.
    saveVersion(currentId, name, currentVersionFiles);
    setLogTick((t) => t + 1);
    // Then push through the Bridge if available so it lands in real
    // git + GitHub. Errors don't fail the local save.
    if (bridgeStatus.available) {
      setBridgeSyncing(true);
      bridgeSave(currentId, name, currentVersionFiles)
        .then((r) => {
          if (!r.ok) {
            console.warn("[bridge] save failed:", r.error);
          } else {
            console.log("[bridge] commit", r.hash);
          }
        })
        .catch((e) => console.warn("[bridge] save threw:", e))
        .finally(() => setBridgeSyncing(false));
    }
  }

  function handleRevertVersion(versionId: string) {
    const v = getVersion(versionId);
    if (!v) return;
    // Local-first revert via fileEdits overlay so the revert is
    // itself undoable through the editor Undo button.
    setFileEdits((prev) => {
      const next = { ...prev };
      for (const [pathKey, vf] of Object.entries(v.files)) {
        next[pathKey] = vf.content;
      }
      return next;
    });
    // The local snapshot doesn't carry a git hash. If you want a
    // true filesystem revert on your Mac (e.g. you've been editing
    // files outside /compare too), bridge a Bridge-tracked version
    // by its hash — wired separately when version listings come
    // from the daemon's git log.
  }

  function handleRenameVersion(versionId: string, name: string) {
    // Versions don't have their own setName helper — port of the
    // daemon stores the name on the commit message, immutable. For
    // the localStorage version we just rewrite the row.
    const all = listVersions(currentId ?? "");
    const target = all.find((v) => v.id === versionId);
    if (!target) return;
    deleteVersion(versionId);
    saveVersion(target.sessionId, name, target.files);
    setLogTick((t) => t + 1);
  }

  function handleDeleteVersion(versionId: string) {
    deleteVersion(versionId);
    setLogTick((t) => t + 1);
  }
  // Edit naming follows the daemon's setEditName helper — exposed
  // for future activity-feed UI, no caller yet.
  void renameEdit;
  // bridgeRevert is wired for the day version listings come from the
  // daemon's git log (need a hash to checkout against). Today we
  // list from localStorage, which doesn't carry hashes.
  void bridgeRevert;

  // Pretty undo/redo tooltip strings for the editor header.
  const undoTooltip = undoState.nextUndo
    ? `Undo: ${undoState.nextUndo.name || undoState.nextUndo.filePath}`
    : "Nothing to undo";
  const redoTooltip = undoState.nextRedo
    ? `Redo: ${undoState.nextRedo.filePath}`
    : "Nothing to redo";

  // Persist the session whenever runs finish + we have an active id.
  useEffect(() => {
    if (!currentId || lastSlots.length === 0 || busy) return;
    // Auto-research sessions aren't persisted yet — pipeline_steps +
    // per-step outputs aren't in the CompareSession shape. Bail
    // rather than save a partial/broken row that won't rehydrate.
    if (mode === "auto-research") return;
    const finalRuns: Record<string, SessionRun> = {};
    let anyFinished = false;
    for (const slot of lastSlots) {
      const r = runs[slot.id];
      if (r && (r.status === "done" || r.status === "error")) {
        anyFinished = true;
        finalRuns[slot.id] = {
          text: r.text,
          error: r.error,
          durationMs: r.startedAt && r.finishedAt ? r.finishedAt - r.startedAt : undefined,
          modelId: slot.modelId,
          task: slot.prompt,
        };
      }
    }
    if (!anyFinished) return;
    const existing = getSession(currentId);
    const titleSrc =
      mode === "agents"
        ? (goal.trim() || `${lastSlots.length} agents · ${lastSlots[0]?.prompt || ""}`)
        : (lastSlots[0]?.prompt || "");
    const session: CompareSession = {
      id: currentId,
      title: existing?.title ?? titleFromPrompt(titleSrc),
      createdAt: existing?.createdAt ?? Date.now(),
      mode,
      ...(mode === "compare"
        ? {
            prompt: lastSlots[0]?.prompt || "",
            modelIds: lastSlots.map((s) => s.modelId),
            // Persist the full transcript so reloading the session
            // shows every prior turn (not just the most recent batch).
            // `turns` may be empty for a single-turn chat — that's fine.
            turns,
          }
        : {
            goal: goal.trim(),
            agents: lastSlots
              .filter((s) => s.role !== "synthesizer")
              .map((s) => {
                // Look up the agent's claimed files from the live agents
                // array so the session preserves them for re-rendering.
                const idx = Number(/^agent-(\d+)$/.exec(s.id)?.[1] ?? -1);
                const live = idx >= 0 ? agents[idx] : undefined;
                return {
                  modelId: s.modelId,
                  task: s.prompt,
                  files: live?.files ?? [],
                  lineRange: live?.lineRange,
                };
              }),
            project: codeMode ? project : undefined,
          }),
      runs: finalRuns,
    };
    saveSession(session);
    setSessions(listSessions());
    // `turns` is in the dep list so picking/unpicking a card on a past
    // turn (which only mutates `turns`, not `runs`) also rewrites the
    // session — otherwise the pick wouldn't survive reload.
  }, [busy, runs, currentId, lastSlots, mode, goal, agents, codeMode, project, turns]);

  function toggleModel(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Set (or clear) the picked card for an EARLIER turn already in the
   *  transcript. Clicking the same card again un-picks. The change only
   *  affects what gets sent on the NEXT Send — we don't re-run any
   *  past turn. Matches popup.js:7599-7635. */
  function pickInTurn(turnId: string, slotId: string) {
    setTurns((prev) =>
      prev.map((t) =>
        t.id === turnId
          ? { ...t, pickedSlotId: t.pickedSlotId === slotId ? null : slotId }
          : t,
      ),
    );
  }

  /** "View all responses" button on a picked turn — un-pick. */
  function unpickTurn(turnId: string) {
    setTurns((prev) =>
      prev.map((t) => (t.id === turnId ? { ...t, pickedSlotId: null } : t)),
    );
  }

  async function submitCompare(prompt: string, attachments: Attachment[]) {
    // 1. Freeze the previous live batch (if any) into the transcript
    //    BEFORE we start a new one — useCompareStream is about to
    //    overwrite lastSlots/runs, and we want the old turn preserved
    //    so the user can scroll through history and (re-)pick cards.
    const frozenTurnsBefore: FrozenTurn[] =
      lastSlots.length > 0 && lastSlots.some((s) => s.role !== "synthesizer")
        ? [
            ...turns,
            freezeTurn({
              id: newSessionId(),
              createdAt: Date.now(),
              userPrompt: lastSlots[0]?.prompt ?? "",
              userAttachments: lastSlots[0]?.attachments,
              liveSlots: lastSlots,
              liveRuns: runs,
              // The current `favorite` is the user's pick for the
              // about-to-be-frozen turn. (If they never picked, it's
              // null and the turn won't contribute to history until
              // they pick later.)
              pickedSlotId: favorite,
            }),
          ]
        : turns;
    setTurns(frozenTurnsBefore);

    // 2. Reuse the current session id across turns. New session only
    //    when the user explicitly hit "New chat" (currentId === null).
    const sessId = currentId ?? newSessionId();
    if (!currentId) setCurrentId(sessId);

    setFavorite(null);
    setExpandedId(null);
    // Reset the paywall-dismissed flag so a re-Send after subscribing
    // (or before subscribing) gets a fresh paywall surfacing if the
    // gate fires again.
    setPaywallDismissed(false);
    // Same wire-attachments shipped to every model. Each provider
    // builds its own multimodal payload on the server side.
    const wire = attachments
      .filter((a) => !a.pending)
      .map(toWireAttachment);
    // 3. Build conversation history from all frozen turns (including
    //    the one we just pushed). Only PICKED turns contribute an
    //    assistant message — un-picked cards are skipped per
    //    popup.js:8124 logic.
    const history = buildHistory(frozenTurnsBefore);
    // Analytics tagging — `sessionId` + `turnIndex` let the admin
    // dashboard group the N parallel-fanout events into a single
    // logical user Send. `mode` is the label used on the chart.
    const turnIndex = frozenTurnsBefore.length;
    const slots: RunSlot[] = [...selected].map((modelId) => ({
      id: modelId, modelId, prompt,
      attachments: wire.length ? wire : undefined,
      prevTurns: history.length ? history : undefined,
      sessionId: sessId,
      turnIndex,
      mode: "compare",
    }));
    await start(slots);
  }

  async function submitAgents() {
    setFavorite(null);
    setExpandedId(null);
    const filled = agents.filter((a) => a.task.trim());
    if (filled.length === 0 || !goal.trim()) return;
    const id = newSessionId();
    setCurrentId(id);
    const wire = agentAttachments
      .filter((a) => !a.pending)
      .map(toWireAttachment);
    await startWorkflow({
      goal: goal.trim(),
      sessionId: id,
      workers: filled.map((a, idx) => {
        const model = MODELS.find((m) => m.id === a.modelId);
        return {
          id: `agent-${idx}`,
          modelId: a.modelId,
          modelLabel: model?.label ?? a.modelId,
          task: a.task.trim(),
          files: [],
          lineRange: undefined,
          attachments: wire,
        };
      }),
      codeMode,
      synthesize: false,
    });
  }

  function newChat() {
    cancel();
    setCurrentId(null);
    setFavorite(null);
    setExpandedId(null);
    setTurns([]);
    setPipelineSteps(null);
    setPipelinePrompt("");
    setAutoLabel(null);
    replaceState({}, []);
  }

  /** Auto-research / pipeline-mode Send handler. In auto sub-mode we
   *  classify the prompt server-side first, then run the picked
   *  lineup. In manual sub-mode we run the user's chosen lineup
   *  verbatim. Either way the chain executes sequentially via
   *  startPipeline(). */
  async function submitAutoResearch(input: {
    prompt: string;
    mode: "auto" | "manual";
    manualLineup?: CompareModel[];
    rounds: number;
  }) {
    setFavorite(null);
    setExpandedId(null);
    setPaywallDismissed(false);
    // Reuse the existing session id across pipeline runs so all the
    // events land under one logical chat.
    const sessId = currentId ?? newSessionId();
    if (!currentId) setCurrentId(sessId);

    // Resolve the lineup.
    let lineup: CompareModel[] = [];
    let label: string | null = null;
    if (input.mode === "manual" && input.manualLineup) {
      lineup = input.manualLineup;
    } else {
      // Auto — ask the classifier route which models to use.
      try {
        const { data: sessionData } = await getBrowserSupabase().auth.getSession();
        const token = sessionData?.session?.access_token;
        const r = await fetch("/api/auto-classify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ prompt: input.prompt }),
        });
        if (r.ok) {
          const body = await r.json() as {
            category: string;
            lineup: Array<{ id: string; label: string; provider: string }>;
          };
          label = body.category;
          // Resolve to full CompareModel objects.
          lineup = body.lineup
            .map((m) => MODELS.find((x) => x.id === m.id))
            .filter((m): m is CompareModel => !!m);
        }
      } catch (e) {
        console.warn("[auto-research] classify failed:", (e as Error).message);
      }
      // Fall back to a sensible default lineup if classification
      // returned nothing.
      if (lineup.length === 0) {
        for (const id of ["gemini-pro", "gpt-4o", "claude-sonnet-4-5"]) {
          const m = MODELS.find((x) => x.id === id);
          if (m && availSet.has(m.provider)) lineup.push(m);
          if (lineup.length >= 3) break;
        }
      }
    }

    if (lineup.length === 0) {
      console.warn("[auto-research] no models available for pipeline");
      return;
    }

    // Build the step list so the UI can render the chain immediately
    // (status=queued for every step). startPipeline will then flip
    // each step to streaming/done as it executes.
    const stepList = buildSteps(
      lineup.map((m) => ({ id: m.id, label: m.label })),
      input.rounds,
    );
    setPipelineSteps(stepList.map((s) => ({
      stepId: s.stepId,
      modelId: s.modelId,
      roundIndex: s.roundIndex,
      slotIndex: s.slotIndex,
    })));
    setPipelinePrompt(input.prompt);
    setAutoLabel(input.mode === "auto" ? `auto-picked · ${label ?? "general"}` : null);

    await startPipeline({
      sessionId: sessId,
      originalPrompt: input.prompt,
      lineup: lineup.map((m) => ({ id: m.id, label: m.label })),
      rounds: input.rounds,
      buildPrompt: buildStepPrompt,
      buildSys: buildStepSystemPrompt,
    });
  }

  function setModeAndReset(next: Mode) {
    if (next === mode) return;
    // Block free users from entering auto-research mode entirely.
    if (next === "auto-research" && !isSubscribed) return;
    // Log the toggle for the admin Activity tab BEFORE updating state
    // so the from→to direction is captured accurately.
    trackActivity({ kind: "mode_change", fromMode: mode, toMode: next });
    setMode(next);
    newChat();
    setGoal("");
    setFileEdits({});
    // Seed with one empty agent when first switching in so the user
    // sees the composer's shape immediately.
    if (next === "agents") {
      const seed = MODELS.find((m) => availSet.has(m.provider));
      setAgents(seed ? [{ modelId: seed.id, task: "" }] : []);
    } else {
      setAgents([]);
    }
  }

  function loadSession(id: string) {
    const s = getSession(id);
    if (!s) return;
    cancel();
    setCurrentId(id);
    setFavorite(null);
    setExpandedId(null);
    // Restore the full multi-turn transcript. Old sessions saved before
    // turns landed have `undefined` here — treated as empty (the saved
    // single batch shows as the live state, no prior history).
    setTurns(s.turns ?? []);
    const loadedMode: Mode = s.mode ?? "compare";
    setMode(loadedMode);

    // Rehydrate slots from the saved session into the run state.
    if (loadedMode === "compare") {
      const slots: RunSlot[] = (s.modelIds ?? []).map((modelId) => ({
        id: modelId, modelId, prompt: s.prompt ?? "",
      }));
      replaceState(projectRuns(slots, s.runs, s.createdAt), slots);
      setSelected(new Set(s.modelIds ?? []));
    } else {
      const slots: RunSlot[] = (s.agents ?? []).map((a, idx) => ({
        id: `agent-${idx}`, modelId: a.modelId, prompt: a.task,
      }));
      replaceState(projectRuns(slots, s.runs, s.createdAt), slots);
      setAgents(s.agents ?? []);
      setGoal(s.goal ?? "");
      // Code mode is the only mode for multi-agent now — nothing else to restore.
    }
  }

  function removeSession(id: string) {
    deleteSession(id);
    setSessions(listSessions());
    if (currentId === id) newChat();
  }

  return (
    <div className="min-h-screen bg-black text-white flex">
      <SessionSidebar
        sessions={sessions}
        currentId={currentId}
        onNewChat={newChat}
        onLoad={loadSession}
        onDelete={removeSession}
        onRequestSignIn={() => setManualAuthOpen(true)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <ChatHeader
          showWorkspaceToggle={hasContent}
          workspaceOpen={workspaceOpen}
          onToggleWorkspace={() => setWorkspaceOpen((v) => !v)}
        />
        <main className="flex-1 flex flex-col">
          {!hasContent ? (
            <EmptyState
              mode={mode}
              onModeChange={setModeAndReset}
              autoResearchLocked={!isSubscribed}
              compare={
                <PromptBar
                  busy={busy}
                  onSubmit={submitCompare}
                  onCancel={cancel}
                  selected={selected}
                  onOpenPicker={() => setPickerOpen(true)}
                  autoFocus
                />
              }
              agents={
                <MultiAgentComposer
                  goal={goal}
                  onGoalChange={setGoal}
                  agents={agents}
                  onAgentsChange={setAgents}
                  attachments={agentAttachments}
                  onAttachmentsChange={setAgentAttachments}
                  busy={busy}
                  onSubmit={submitAgents}
                  onCancel={cancel}
                  availableProviders={availSet}
                  autoFocus
                />
              }
              autoResearch={
                <AutoResearchComposer
                  busy={busy}
                  onSubmit={submitAutoResearch}
                  onCancel={cancel}
                  availableProviders={availSet}
                  autoFocus
                />
              }
            />
          ) : mode === "auto-research" ? (
            <ActiveAutoResearch
              onModeChange={setModeAndReset}
              autoResearchLocked={!isSubscribed}
              pipelineSteps={pipelineSteps ?? []}
              pipelinePrompt={pipelinePrompt}
              autoLabel={autoLabel}
              runs={runs}
              compose={
                <AutoResearchComposer
                  busy={busy}
                  onSubmit={submitAutoResearch}
                  onCancel={cancel}
                  availableProviders={availSet}
                />
              }
            />
          ) : mode === "compare" ? (
            <ActiveCompare
              onModeChange={setModeAndReset}
              turns={turns}
              onPickTurn={pickInTurn}
              onUnpickTurn={unpickTurn}
              lastSlots={lastSlots}
              favorite={favorite}
              setFavorite={setFavorite}
              setExpandedId={setExpandedId}
              getRun={getRun}
              project={project}
              slotLabels={slotLabels}
              workspaceOpen={workspaceOpen}
              onFileEdit={handleFileEdit}
              canUndo={!!undoState.nextUndo}
              canRedo={!!undoState.nextRedo}
              undoTooltip={undoTooltip}
              redoTooltip={redoTooltip}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onOpenVersionHistory={() => setVersionModalOpen(true)}
              compose={
                <PromptBar
                  busy={busy}
                  onSubmit={submitCompare}
                  onCancel={cancel}
                  selected={selected}
                  onOpenPicker={() => setPickerOpen(true)}
                />
              }
            />
          ) : (
            <ActiveAgents
              onModeChange={setModeAndReset}
              goal={goal}
              onGoalChange={setGoal}
              agents={agents}
              onAgentsChange={setAgents}
              attachments={agentAttachments}
              onAttachmentsChange={setAgentAttachments}
              busy={busy}
              onSubmit={submitAgents}
              onCancel={cancel}
              availableProviders={availSet}
              lastSlots={lastSlots}
              favorite={favorite}
              setFavorite={setFavorite}
              setExpandedId={setExpandedId}
              getRun={getRun}
              project={project}
              slotLabels={slotLabels}
              workspaceOpen={workspaceOpen}
              onFileEdit={handleFileEdit}
              canUndo={!!undoState.nextUndo}
              canRedo={!!undoState.nextRedo}
              undoTooltip={undoTooltip}
              redoTooltip={redoTooltip}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onOpenVersionHistory={() => setVersionModalOpen(true)}
            />
          )}
        </main>
      </div>

      {pickerOpen && (
        <ModelPickerModal
          selected={selected}
          onToggle={toggleModel}
          onConfirm={() => setPickerOpen(false)}
          onClose={() => setPickerOpen(false)}
          availableProviders={availSet}
        />
      )}


      {expandedModel && expandedSlot && (
        <ExpandedModal
          model={expandedModel}
          run={getRun(expandedSlot.id)}
          onClose={() => setExpandedId(null)}
        />
      )}

      {authRequired && (
        <div
          onClick={clearAuthErrors}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Sign in to send"
        >
          {/* stopPropagation so clicks on the card itself don't dismiss. */}
          <div onClick={(e) => e.stopPropagation()}>
            <CompareAuthGate onSignedIn={() => setSignedIn(true)} />
          </div>
        </div>
      )}

      {paywallContext && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Paywall"
        >
          <ComparePaywall
            userId={paywallContext.userId}
            consumedCents={paywallContext.consumedCents}
            freeTrialCents={paywallContext.freeTrialCents}
            onDismiss={() => setPaywallDismissed(true)}
          />
        </div>
      )}

      <VersionHistoryModal
        open={versionModalOpen}
        onClose={() => setVersionModalOpen(false)}
        versions={currentVersions}
        currentFiles={currentVersionFiles}
        onSave={handleSaveVersion}
        onRevert={handleRevertVersion}
        onDelete={handleDeleteVersion}
        onRename={handleRenameVersion}
        bridgeStatus={bridgeStatus}
        bridgeSyncing={bridgeSyncing}
      />
    </div>
  );
}

function ChatHeader({
  showWorkspaceToggle, workspaceOpen, onToggleWorkspace,
}: {
  showWorkspaceToggle: boolean;
  workspaceOpen: boolean;
  onToggleWorkspace: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-black/85">
      <div className="px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-end gap-1">
        {showWorkspaceToggle && (
          <button
            type="button"
            onClick={onToggleWorkspace}
            title={workspaceOpen ? "Hide code workspace" : "Show code workspace"}
            aria-pressed={workspaceOpen}
            className={[
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] transition-colors",
              workspaceOpen
                ? "bg-white/[0.08] text-white border border-white/15"
                : "text-white/60 hover:text-white hover:bg-white/[0.06] border border-transparent",
            ].join(" ")}
          >
            <WorkspaceIcon />
            Code
          </button>
        )}
        <Link href="/welcome" className="px-3 py-1.5 rounded-full text-[13px] text-white/60 hover:text-white hover:bg-white/[0.06] transition">
          Desktop app
        </Link>
        <Link href="/admin" className="hidden sm:inline px-3 py-1.5 rounded-full text-[13px] text-white/60 hover:text-white hover:bg-white/[0.06] transition">
          Admin
        </Link>
      </div>
    </header>
  );
}

function WorkspaceIcon() {
  // Two-pane "split-right" glyph — represents the workspace pane.
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <line x1="9.5" y1="3" x2="9.5" y2="13" />
    </svg>
  );
}

function ModeToggle({
  mode, onChange, autoResearchLocked,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
  /** When true the Auto-research tab is greyed out + tooltip explains
   *  it's subscriber-only. Lock state comes from CompareChat's
   *  subscription check. */
  autoResearchLocked?: boolean;
}) {
  const tabs: Array<{ id: Mode; label: string; locked?: boolean }> = [
    { id: "compare",       label: "Compare" },
    { id: "agents",        label: "Multi-agent" },
    { id: "auto-research", label: "Auto-research", locked: autoResearchLocked },
  ];
  return (
    <div className="inline-flex self-center rounded-full border border-white/10 bg-[#161616] p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => !t.locked && onChange(t.id)}
          disabled={t.locked}
          title={t.locked ? "Subscribe ($25/mo) or pay-as-you-go to unlock Auto-research — it burns 6+ API calls per Send" : undefined}
          className={[
            "px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-colors inline-flex items-center gap-1.5",
            mode === t.id
              ? "bg-white text-black"
              : t.locked
                ? "text-white/30 cursor-not-allowed"
                : "text-white/60 hover:text-white",
          ].join(" ")}
        >
          {t.locked && (
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <rect x="2.5" y="5.5" width="7" height="5" rx="1" />
              <path d="M4 5.5 V3.5 a2 2 0 0 1 4 0 V5.5" />
            </svg>
          )}
          {t.label}
        </button>
      ))}
    </div>
  );
}

function EmptyState({
  mode, onModeChange, compare, agents, autoResearch, autoResearchLocked,
}: {
  mode: Mode;
  onModeChange: (m: Mode) => void;
  compare: React.ReactNode;
  agents: React.ReactNode;
  autoResearch: React.ReactNode;
  autoResearchLocked?: boolean;
}) {
  const headline =
    mode === "compare"       ? "What do you want compared?" :
    mode === "agents"        ? "What should the team build?" :
                               "What should we research?";
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-10 pb-24">
      <div className="w-full max-w-[820px]">
        <div className="text-center mb-8">
          <h1
            className="font-serif text-white leading-[1.05] mb-3"
            style={{ fontSize: "clamp(1.875rem, 3vw, 2.5rem)" }}
          >
            {headline}
          </h1>
        </div>
        <div className="flex justify-center mb-4">
          <ModeToggle mode={mode} onChange={onModeChange} autoResearchLocked={autoResearchLocked} />
        </div>
        {mode === "compare"
          ? compare
          : mode === "agents"
            ? agents
            : autoResearch}
      </div>
    </div>
  );
}

/** Active state for compare mode — N model response cards + sticky
 *  composer. When workspaceOpen is true, the layout splits into a
 *  chat column (left) and the SplitWorkspace (right), with a
 *  draggable splitter between. */
function ActiveCompare({
  onModeChange, turns, onPickTurn, onUnpickTurn,
  lastSlots, favorite, setFavorite, setExpandedId, getRun, compose,
  project, slotLabels, workspaceOpen, onFileEdit,
  canUndo, canRedo, undoTooltip, redoTooltip,
  onUndo, onRedo, onOpenVersionHistory,
}: {
  onModeChange: (m: Mode) => void;
  turns: FrozenTurn[];
  onPickTurn: (turnId: string, slotId: string) => void;
  onUnpickTurn: (turnId: string) => void;
  lastSlots: RunSlot[];
  favorite: string | null;
  setFavorite: (fn: (cur: string | null) => string | null) => void;
  setExpandedId: (id: string) => void;
  getRun: (id: string) => RunState;
  compose: React.ReactNode;
  project: Record<string, ProjectFile>;
  slotLabels: Record<string, string>;
  workspaceOpen: boolean;
  onFileEdit: (path: string, content: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  undoTooltip: string;
  redoTooltip: string;
  onUndo: () => void;
  onRedo: () => void;
  onOpenVersionHistory: () => void;
}) {
  const [chatPct, setChatPct] = useState(56);
  const rowRef = useRef<HTMLDivElement | null>(null);

  const chatBody = (
    <div className="max-w-[1400px] mx-auto flex flex-col gap-5">
      <div className="flex justify-center">
        <ModeToggle mode="compare" onChange={onModeChange} />
      </div>
      {/* Frozen transcript — every completed Send is a turn here. */}
      {turns.map((turn) => (
        <FrozenTurnView
          key={turn.id}
          turn={turn}
          workspaceOpen={workspaceOpen}
          onPick={(slotId) => onPickTurn(turn.id, slotId)}
          onUnpick={() => onUnpickTurn(turn.id)}
          onExpand={(slotId) => setExpandedId(slotId)}
        />
      ))}
      {/* Live batch — the in-flight Send (or most recently completed
          one before any new Send freezes it into `turns`). */}
      {lastSlots[0]?.prompt && (
        <div className="flex justify-end">
          <div className="rounded-2xl bg-[#1f1f1f] border border-white/10 text-white/95 px-4 py-2.5 max-w-[68ch]">
            <div className="text-[15px] leading-[1.5] whitespace-pre-wrap">
              {lastSlots[0].prompt}
            </div>
          </div>
        </div>
      )}
      {lastSlots.length > 0 && (
        <div className={workspaceOpen ? "grid grid-cols-1 gap-3" : gridCols(lastSlots.length)}>
          {lastSlots.map((slot) => {
            const model = MODELS.find((m) => m.id === slot.modelId);
            if (!model) return null;
            return (
              <ResponseBox
                key={slot.id}
                model={model}
                run={getRun(slot.id)}
                isFavorite={favorite === slot.id}
                onToggleFavorite={() => setFavorite((cur) => (cur === slot.id ? null : slot.id))}
                onExpand={() => setExpandedId(slot.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );

  // When the workspace is closed, keep the classic centered chat +
  // sticky composer. When open, switch to the resizable two-column
  // layout (matches the multi-agent shape).
  if (!workspaceOpen) {
    return (
      <>
        <div className="flex-1 px-4 sm:px-6 lg:px-10 pt-6 pb-40">{chatBody}</div>
        <div className="sticky bottom-0 px-4 sm:px-6 lg:px-10 pb-6 pt-12 bg-gradient-to-t from-black from-50% to-transparent pointer-events-none">
          <div className="max-w-[1100px] mx-auto pointer-events-auto">
            {compose}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="flex-1 px-4 sm:px-6 lg:px-8 pt-4 pb-6 min-h-0 flex flex-col">
      <div ref={rowRef} className="flex-1 min-h-0 flex gap-0">
        <div
          className="min-w-0 flex flex-col gap-4 overflow-y-auto pr-3 relative"
          style={{ flexBasis: `${chatPct}%`, flexGrow: 0, flexShrink: 0 }}
        >
          <div className="flex-1">{chatBody}</div>
          <div className="sticky bottom-0 pt-8 pb-2 bg-gradient-to-t from-black from-60% to-transparent pointer-events-none">
            <div className="pointer-events-auto">{compose}</div>
          </div>
        </div>

        <OuterSplitter
          onDrag={(clientX) => {
            const rect = rowRef.current?.getBoundingClientRect();
            if (!rect) return;
            const pct = ((clientX - rect.left) / rect.width) * 100;
            setChatPct(Math.min(80, Math.max(25, pct)));
          }}
        />

        <div className="flex-1 min-w-0 min-h-0">
          <SplitWorkspace
            project={project}
            slotLabels={slotLabels}
            onFileEdit={onFileEdit}
            canUndo={canUndo}
            canRedo={canRedo}
            undoTooltip={undoTooltip}
            redoTooltip={redoTooltip}
            onUndo={onUndo}
            onRedo={onRedo}
            onOpenVersionHistory={onOpenVersionHistory}
          />
        </div>
      </div>
    </div>
  );
}

/** Active state for multi-agent mode — TWO COLUMNS:
 *
 *   ┌─ chat column (composer + responses) ─┃─ workspace ────┐
 *   │ composer                              ┃ file tree     │
 *   │ ────────────────────────────────────  ┃ ──splitter──  │
 *   │ result box                            ┃ editor        │
 *   │ result box                            ┃ ──splitter──  │
 *   │ ...                                   ┃ terminal      │
 *   └───────────────────────────────────────┴───────────────┘
 *                                            ↑ draggable
 *
 * The outer vertical splitter (between chat and workspace) is
 * draggable. The inner splitters inside SplitWorkspace (tree vs
 * editor, editor vs terminal) are also draggable.
 */
function ActiveAgents({
  onModeChange, goal, onGoalChange, agents, onAgentsChange,
  attachments, onAttachmentsChange,
  busy, onSubmit, onCancel,
  availableProviders, lastSlots, favorite, setFavorite, setExpandedId, getRun,
  project, slotLabels, workspaceOpen, onFileEdit,
  canUndo, canRedo, undoTooltip, redoTooltip,
  onUndo, onRedo, onOpenVersionHistory,
}: {
  onModeChange: (m: Mode) => void;
  goal: string;
  onGoalChange: (next: string) => void;
  agents: AgentSlot[];
  onAgentsChange: (next: AgentSlot[]) => void;
  attachments: Attachment[];
  onAttachmentsChange: (next: Attachment[]) => void;
  busy: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  availableProviders: Set<ProviderId>;
  lastSlots: RunSlot[];
  favorite: string | null;
  setFavorite: (fn: (cur: string | null) => string | null) => void;
  setExpandedId: (id: string) => void;
  getRun: (id: string) => RunState;
  project: Record<string, ProjectFile>;
  slotLabels: Record<string, string>;
  workspaceOpen: boolean;
  onFileEdit: (path: string, content: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  undoTooltip: string;
  redoTooltip: string;
  onUndo: () => void;
  onRedo: () => void;
  onOpenVersionHistory: () => void;
}) {
  const workerSlots = lastSlots.filter((s) => s.role !== "synthesizer");
  // Width split between the left chat column and the right workspace.
  const [chatPct, setChatPct] = useState(56);
  const rowRef = useRef<HTMLDivElement | null>(null);

  return (
    <div className="flex-1 px-4 sm:px-6 lg:px-8 pt-4 pb-6 min-h-0 flex flex-col">
      <div className="flex justify-center mb-3">
        <ModeToggle mode="agents" onChange={onModeChange} />
      </div>

      <div ref={rowRef} className="flex-1 min-h-0 flex gap-0">
        {/* LEFT — chat column: composer at top, results stack below.
            When the workspace is closed, the chat column takes the
            full width; when open, it sticks to the user-set split. */}
        <div
          className="min-w-0 flex flex-col gap-4 overflow-y-auto pr-3"
          style={
            workspaceOpen
              ? { flexBasis: `${chatPct}%`, flexGrow: 0, flexShrink: 0 }
              : { flex: 1 }
          }
        >
          <MultiAgentComposer
            goal={goal}
            onGoalChange={onGoalChange}
            agents={agents}
            onAgentsChange={onAgentsChange}
            attachments={attachments}
            onAttachmentsChange={onAttachmentsChange}
            busy={busy}
            onSubmit={onSubmit}
            onCancel={onCancel}
            availableProviders={availableProviders}
          />

          {workerSlots.length > 0 && (
            <div className="flex flex-col gap-3 pb-6">
              {workerSlots.map((slot) => {
                const model = MODELS.find((m) => m.id === slot.modelId);
                if (!model) return null;
                return (
                  <ResponseBox
                    key={slot.id}
                    model={model}
                    run={getRun(slot.id)}
                    isFavorite={favorite === slot.id}
                    onToggleFavorite={() => setFavorite((cur) => (cur === slot.id ? null : slot.id))}
                    onExpand={() => setExpandedId(slot.id)}
                    agentLabel={labelFor(slot.id)}
                    task={slot.prompt}
                  />
                );
              })}
            </div>
          )}
        </div>

        {workspaceOpen && (
          <>
            {/* OUTER vertical splitter — drag to resize chat vs workspace */}
            <OuterSplitter
              onDrag={(clientX) => {
                const rect = rowRef.current?.getBoundingClientRect();
                if (!rect) return;
                const pct = ((clientX - rect.left) / rect.width) * 100;
                setChatPct(Math.min(80, Math.max(25, pct)));
              }}
            />

            {/* RIGHT — workspace: file tree + editor + terminal */}
            <div className="flex-1 min-w-0 min-h-0">
              <SplitWorkspace
                project={project}
                slotLabels={slotLabels}
                onFileEdit={onFileEdit}
                canUndo={canUndo}
                canRedo={canRedo}
                undoTooltip={undoTooltip}
                redoTooltip={redoTooltip}
                onUndo={onUndo}
                onRedo={onRedo}
                onOpenVersionHistory={onOpenVersionHistory}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** One past compare turn in the transcript.
 *
 *  Two render modes (matches popup.js:7128-7140):
 *    - pickedSlotId === null → show the user prompt followed by the
 *      grid of every model's reply. Each card is clickable to pick.
 *    - pickedSlotId !== null → show ONLY the picked card as a normal
 *      assistant message, plus a "View all N responses" button that
 *      un-picks (returning to the grid).
 *
 *  Picking flows into the next Send's multi-turn history; un-picking
 *  removes the assistant message from history for that turn. We never
 *  re-run anything when the pick changes — that's exactly the original
 *  Tools-AI semantic. */
function FrozenTurnView({
  turn, workspaceOpen, onPick, onUnpick, onExpand,
}: {
  turn: FrozenTurn;
  workspaceOpen: boolean;
  onPick: (slotId: string) => void;
  onUnpick: () => void;
  onExpand: (slotId: string) => void;
}) {
  const picked = turn.pickedSlotId
    ? turn.slots.find((s) => s.id === turn.pickedSlotId)
    : null;
  const pickedModel = picked ? MODELS.find((m) => m.id === picked.modelId) : null;
  const pickedRun = picked ? turn.runs[picked.id] : null;

  return (
    <div className="flex flex-col gap-5">
      {/* User prompt bubble */}
      <div className="flex justify-end">
        <div className="rounded-2xl bg-[#1f1f1f] border border-white/10 text-white/95 px-4 py-2.5 max-w-[68ch]">
          <div className="text-[15px] leading-[1.5] whitespace-pre-wrap">
            {turn.userPrompt}
          </div>
        </div>
      </div>
      {picked && pickedModel && pickedRun ? (
        <PickedReply
          model={pickedModel}
          run={pickedRun}
          totalSlots={turn.slots.length}
          onViewAll={onUnpick}
          onExpand={() => onExpand(picked.id)}
        />
      ) : (
        <div className={workspaceOpen ? "grid grid-cols-1 gap-3" : gridCols(turn.slots.length)}>
          {turn.slots.map((slot) => {
            const model = MODELS.find((m) => m.id === slot.modelId);
            const run = turn.runs[slot.id];
            if (!model || !run) return null;
            // ResponseBox wants a RunState — our FrozenRun has the same
            // text/error/timing shape. Status is "done" or "error".
            const asRunState: RunState = {
              status: run.error ? "error" : "done",
              text: run.text,
              error: run.error,
              startedAt: run.startedAt,
              finishedAt: run.finishedAt,
              modelId: run.modelId,
              task: run.task,
            };
            return (
              <ResponseBox
                key={slot.id}
                model={model}
                run={asRunState}
                isFavorite={false}
                onToggleFavorite={() => onPick(slot.id)}
                onExpand={() => onExpand(slot.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/** A picked card rendered as the FINAL assistant message for a turn.
 *  Visually wider than a grid card so it reads like a normal assistant
 *  reply. The "View all N responses" link reopens the grid for this
 *  turn (un-pick). The user can re-pick any card at any time. */
function PickedReply({
  model, run, totalSlots, onViewAll, onExpand,
}: {
  model: typeof MODELS[number];
  run: { text: string; error?: string };
  totalSlots: number;
  onViewAll: () => void;
  onExpand: () => void;
}) {
  return (
    <article
      className="rounded-xl border border-[#d97757]/30 bg-[#161616] overflow-hidden"
      onDoubleClick={(e) => { e.preventDefault(); onExpand(); }}
    >
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[13px] font-medium text-white/95 truncate">
            {model.label}
          </span>
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded text-[#d97757] border border-[#d97757]/40 font-mono">
            picked
          </span>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="text-[12px] text-white/45 hover:text-white/85 transition-colors"
          title="Un-pick and see every model's response again"
        >
          View all {totalSlots} responses
        </button>
      </header>
      <div className="px-5 py-4 max-h-[520px] overflow-y-auto text-white/90 text-[14px] leading-[1.6] whitespace-pre-wrap font-sans">
        {run.error ? (
          <div className="text-red-300/90 text-[13px]">⚠ {run.error}</div>
        ) : run.text ? (
          run.text
        ) : (
          <span className="text-white/25">(no response)</span>
        )}
      </div>
    </article>
  );
}

/** Active state for Auto-research mode — renders the PipelineView
 *  (chain of step rows + final assistant message) plus the composer
 *  at the bottom so the user can fire another pipeline run without
 *  scrolling all the way up. Mirrors the shape of ActiveCompare. */
function ActiveAutoResearch({
  onModeChange, autoResearchLocked,
  pipelineSteps, pipelinePrompt, autoLabel, runs, compose,
}: {
  onModeChange: (m: Mode) => void;
  autoResearchLocked?: boolean;
  pipelineSteps: PipelineSlot[];
  pipelinePrompt: string;
  autoLabel: string | null;
  runs: Record<string, RunState>;
  compose: React.ReactNode;
}) {
  return (
    <>
      <div className="flex-1 px-4 sm:px-6 lg:px-10 pt-6 pb-40">
        <div className="max-w-[920px] mx-auto flex flex-col gap-5">
          <div className="flex justify-center">
            <ModeToggle mode="auto-research" onChange={onModeChange} autoResearchLocked={autoResearchLocked} />
          </div>
          {pipelineSteps.length > 0 && (
            <PipelineView
              steps={pipelineSteps}
              runs={runs}
              originalPrompt={pipelinePrompt}
              autoLabel={autoLabel}
            />
          )}
        </div>
      </div>
      <div className="sticky bottom-0 px-4 sm:px-6 lg:px-10 pb-6 pt-12 bg-gradient-to-t from-black from-50% to-transparent pointer-events-none">
        <div className="max-w-[920px] mx-auto pointer-events-auto">
          {compose}
        </div>
      </div>
    </>
  );
}

function OuterSplitter({ onDrag }: { onDrag: (clientX: number) => void }) {
  const draggingRef = useRef(false);
  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    function handleMove(ev: MouseEvent) {
      if (!draggingRef.current) return;
      onDrag(ev.clientX);
    }
    function handleUp() {
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    }
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={onMouseDown}
      className="group shrink-0 w-[5px] cursor-col-resize relative"
      style={{ background: "#1a1918" }}
    >
      <div
        aria-hidden
        className="absolute left-[2px] top-0 bottom-0 w-px"
        style={{ background: "#000" }}
      />
    </div>
  );
}

function labelFor(slotId: string): string {
  const m = /^agent-(\d+)$/.exec(slotId);
  return m ? `Agent ${Number(m[1]) + 1}` : slotId;
}

function projectRuns(
  slots: RunSlot[],
  saved: Record<string, SessionRun>,
  createdAt: number,
): Record<string, RunState> {
  const out: Record<string, RunState> = {};
  for (const slot of slots) {
    const r = saved[slot.id];
    if (!r) continue;
    out[slot.id] = {
      status: r.error ? "error" : "done",
      text: r.text,
      error: r.error,
      startedAt: createdAt,
      finishedAt: createdAt + (r.durationMs ?? 0),
      modelId: slot.modelId,
      task: slot.prompt,
    };
  }
  return out;
}

function initialSelection(avail: Set<ProviderId>) {
  const sel = new Set<string>();
  for (const m of MODELS) {
    if (m.defaultSelected && avail.has(m.provider)) sel.add(m.id);
  }
  if (sel.size === 0) {
    const first = MODELS.find((m) => avail.has(m.provider));
    if (first) sel.add(first.id);
  }
  return sel;
}

function gridCols(n: number) {
  if (n <= 1) return "grid grid-cols-1 gap-4";
  if (n === 2) return "grid grid-cols-1 md:grid-cols-2 gap-4";
  if (n === 3) return "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4";
  return "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4";
}
