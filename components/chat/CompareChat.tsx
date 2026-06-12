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
  saveProject as saveProjectCache,
  loadProject as loadProjectCache,
  probeHandlePermission,
  walkHandle,
  DRAFT_SESSION_KEY,
  migrateDraft,
} from "@/lib/compare/projectCache";
import {
  isDesktop as isVeronumDesktop,
  desktopPickFolder,
  desktopWalkFolder,
  desktopWriteFile,
  type DesktopPickResult,
} from "@/lib/desktop";
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
import { ProjectRulesModal } from "./ProjectRulesModal";
import { loadProjectRules, hasProjectRules } from "@/lib/compare/projectRules";
import { AgentRunner, AgentEventRow } from "./AgentRunner";
import { runAgent, type AgentEvent } from "@/lib/agent/loop";
import type { AgentContext } from "@/lib/agent/executor";
import {
  INSPECTION_SYSTEM_PROMPT,
  buildInspectionPrompt,
  estimateInspectionSize,
} from "@/lib/compare/inspection";
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

type Mode = "compare" | "agents" | "auto-research" | "agent";

export function CompareChat({ availableProviders }: Props) {
  const availSet = useMemo(() => new Set(availableProviders), [availableProviders]);
  const [mode, setMode] = useState<Mode>("compare");

  // Compare-mode state
  const [selected, setSelected] = useState<Set<string>>(() => initialSelection(availSet));
  const [pickerOpen, setPickerOpen] = useState(false);

  // Agent execution (the tool loop with bash) — active when a folder
  // is loaded in the desktop app and ONE model is selected. This is
  // what lets Compare actually RUN commands (npm, git, open apps), not
  // just edit files. Events drive the inline transcript.
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const [agentRunning, setAgentRunning] = useState(false);
  const agentAbortRef = useRef<AbortController | null>(null);

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
  // True iff the page is running inside Veronum Desktop (Electron).
  // SSR safe: starts false so server-rendered HTML matches first
  // client paint; flipped in a mount effect once window is available.
  const [inDesktopWrapper, setInDesktopWrapper] = useState(false);
  useEffect(() => {
    setInDesktopWrapper(isVeronumDesktop());
  }, []);
  // The live DirectoryHandle from showDirectoryPicker (Chrome/Edge),
  // or null for webkitdirectory uploads / GitHub ingests / Safari.
  // We persist this per-session to IndexedDB so reopening a chat can
  // silently re-read the folder if Chrome still has the read grant.
  const [liveHandle, setLiveHandle] = useState<FileSystemDirectoryHandle | null>(null);
  // Desktop-bridge root id for the active workspace (Veronum Desktop
  // only). The main process persists rootId → path on disk, so this
  // id stays valid across app relaunches — restore re-walks the
  // folder live instead of using the snapshot. Cursor's model.
  const [desktopRootId, setDesktopRootId] = useState<string | null>(null);
  // True when we loaded files from cache but the handle's read
  // permission has lapsed — used to surface a one-click Reconnect
  // affordance instead of silently losing the live link.
  const [handleNeedsReconnect, setHandleNeedsReconnect] = useState(false);

  // Session-start picker — surfaces on first load + every newChat() to
  // make the user pick a project context (New / Upload folder / Upload
  // from GitHub URL). Files loaded here merge into the existing
  // fileEdits overlay so they appear in FileTreePane immediately AND
  // become part of `project` for prompt-side context injection in the
  // /api/compare route. User edits still win because fileEdits is the
  // overlay layer above the agent-output build.
  // Recent projects (folders + GitHub repos) for the workspace chips
  // in EmptyState. Persisted to localStorage so they survive reloads.
  // Mirrors Claude.app's "Recent" header pattern in the folder
  // dropdown (c5610fbe3-rsWnjbnF.js:654657) — clicking a recent
  // re-loads it through the same handlers as the picker actions.
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("veronum.recent_projects");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
    } catch { return []; }
  });
  const pushRecent = useCallback((next: RecentProject) => {
    setRecentProjects((prev) => {
      const filtered = prev.filter((r) =>
        r.kind !== next.kind || r.name !== next.name,
      );
      const merged = [next, ...filtered].slice(0, 8);
      try { localStorage.setItem("veronum.recent_projects", JSON.stringify(merged)); }
      catch { /* quota — non-fatal */ }
      return merged;
    });
  }, []);
  const [importingGitHub, setImportingGitHub] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedRepo, setImportedRepo] = useState<{
    repo: string;
    count: number;
    dropped: number;
  } | null>(null);

  // Allowlist + skip rules mirror the server-side GitHub ingest filter
  // so a folder picker on your Mac and a `github.com/owner/repo` paste
  // produce identical-shape workspaces. Path matching is regex so a
  // subdir named "node_modules" anywhere in the tree is excluded.
  const LOCAL_ALLOWED_EXTENSIONS = new Set([
    "ts","tsx","js","jsx","mjs","cjs",
    "py","go","rs","rb","java","kt","swift",
    "c","cc","cpp","h","hpp",
    "html","css","scss","sass","vue","svelte",
    "md","mdx","txt","yaml","yml","toml","json",
    "sh","bash","zsh","fish","sql","graphql","proto",
  ]);
  const LOCAL_SKIP_DIRS = /(^|\/)(node_modules|\.next|\.turbo|dist|build|out|\.git|vendor|target|\.cache|\.vscode|\.idea|coverage|__pycache__|\.pytest_cache|\.venv)(\/|$)/;

  // Shared caps + the inner processor so both entry points
  // (FileList from webkitdirectory + FileSystemDirectoryHandle from
  // showDirectoryPicker) reuse the exact same allowlist, sort, cap,
  // and merge behaviour.
  const MAX_FILE_BYTES = 100 * 1024;
  const MAX_TOTAL_BYTES = 1_500 * 1024;
  const MAX_FILE_COUNT = 250;
  type Candidate = { file: File; rel: string };

  /** Walk a FileSystemDirectoryHandle recursively, producing the same
   *  Candidate[] shape the FileList path builds. showDirectoryPicker
   *  is what gives Chrome's native "New Folder" dialog (matches the
   *  Electron dialog Claude uses). Safari/Firefox fall through to the
   *  webkitdirectory input which lacks the New Folder button. */
  async function walkDirectoryHandle(
    dir: FileSystemDirectoryHandle,
    prefix: string,
  ): Promise<Candidate[]> {
    const out: Candidate[] = [];
    // Async iterator exists at runtime on all browsers that ship
    // showDirectoryPicker; TS DOM lib doesn't yet model `.values()`.
    const iter = (dir as FileSystemDirectoryHandle & {
      values(): AsyncIterableIterator<FileSystemHandle>;
    }).values();
    for await (const entry of iter) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.kind === "directory") {
        if (LOCAL_SKIP_DIRS.test("/" + rel + "/")) continue;
        out.push(...(await walkDirectoryHandle(entry as FileSystemDirectoryHandle, rel)));
      } else if (entry.kind === "file") {
        const ext = (rel.split(".").pop() || "").toLowerCase();
        if (!LOCAL_ALLOWED_EXTENSIONS.has(ext)) continue;
        const file = await (entry as FileSystemFileHandle).getFile();
        if (file.size > MAX_FILE_BYTES) continue;
        out.push({ file, rel });
      }
    }
    return out;
  }

  /** Read text files from a picked folder. Shared processor body —
   *  the path-stripping ensures `my-repo/app/page.tsx` becomes
   *  `app/page.tsx`, matching what the GitHub ingest produces. */
  const processCandidates = async (
    candidates: Candidate[],
    knownRootName: string | null,
    /** When the candidates came from a DirectoryHandle pick, pass it
     *  here so we cache the handle alongside the file contents. Passed
     *  through explicitly rather than read from state because React
     *  batches setState calls — reading liveHandle inside this same
     *  synchronous flow would see the stale value. */
    handleForCache: FileSystemDirectoryHandle | null = null,
  ): Promise<{ repo: string; count: number; dropped: number } | null> => {
    try {
      candidates.sort((a, b) => a.rel.localeCompare(b.rel));

      const next: Record<string, string> = {};
      let totalBytes = 0;
      let dropped = 0;
      let rootName: string | null = knownRootName;
      for (const c of candidates) {
        if (Object.keys(next).length >= MAX_FILE_COUNT) { dropped++; continue; }
        if (totalBytes + c.file.size > MAX_TOTAL_BYTES) { dropped++; continue; }
        let text: string;
        try {
          text = await c.file.text();
        } catch {
          dropped++;
          continue;
        }
        if (text.length > MAX_FILE_BYTES) { dropped++; continue; }
        // Strip the leading folder name (the one the user picked) so
        // paths line up with GitHub-ingested paths.
        const stripped = c.rel.includes("/") ? c.rel.slice(c.rel.indexOf("/") + 1) : c.rel;
        if (rootName === null && c.rel.includes("/")) {
          rootName = c.rel.slice(0, c.rel.indexOf("/"));
        }
        next[stripped] = text;
        totalBytes += text.length;
      }
      setFileEdits((prev) => ({ ...prev, ...next }));
      const summary = {
        repo: rootName || "folder",
        count: Object.keys(next).length,
        dropped,
      };
      setImportedRepo(summary);
      pushRecent({
        kind: summary.repo.includes("/") && !summary.repo.startsWith("/")
          ? "github"
          : "folder",
        name: summary.repo,
        url: summary.repo.includes("/") && !summary.repo.startsWith("/")
          ? summary.repo
          : undefined,
        lastUsed: Date.now(),
      });
      // Persist the project (files + optional handle) so reopening this
      // chat from history restores the workspace. We pull the handle
      // from the LATEST liveHandle state; the caller stamps it just
      // before invoking us via setLiveHandle.
      // ALWAYS cache — draft key when no session exists yet (folder
      // picked before the first message), migrated to the session id
      // on creation. Fire-and-forget — failures (private mode, quota)
      // shouldn't block the UI.
      void saveProjectCache(currentId ?? DRAFT_SESSION_KEY, {
        rootName: summary.repo,
        files: Object.entries(next).map(([path, content]) => ({ path, content })),
        handle: handleForCache,
        savedAt: Date.now(),
      });
      return summary;
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Failed to read folder");
      return null;
    } finally {
      setImportingGitHub(false);
    }
  };

  /** FileList entry point — used by the <input webkitdirectory> fallback
   *  on Safari/Firefox where showDirectoryPicker isn't available. */
  const loadLocalFolder = async (
    files: FileList,
  ): Promise<{ repo: string; count: number; dropped: number } | null> => {
    setImportError(null);
    setImportingGitHub(true);
    const candidates: Candidate[] = [];
    for (const f of Array.from(files)) {
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      if (LOCAL_SKIP_DIRS.test(rel)) continue;
      const ext = (rel.split(".").pop() || "").toLowerCase();
      if (!LOCAL_ALLOWED_EXTENSIONS.has(ext)) continue;
      if (f.size > MAX_FILE_BYTES) continue;
      candidates.push({ file: f, rel });
    }
    return processCandidates(candidates, null);
  };

  /** DirectoryHandle entry point — the path that gives Chrome/Edge the
   *  native "New Folder" dialog matching Claude's UX. The handle's
   *  `.name` is the folder the user picked, used as the display name
   *  and stripped from the per-file paths inside processCandidates. */
  const loadLocalFolderFromHandle = async (
    handle: FileSystemDirectoryHandle,
  ): Promise<{ repo: string; count: number; dropped: number } | null> => {
    setImportError(null);
    setImportingGitHub(true);
    // Stamp the handle BEFORE processCandidates runs — it reads
    // liveHandle when it builds the IndexedDB payload. React schedules
    // the state update synchronously so the closure inside
    // processCandidates picks it up; if a race ever bites us, we can
    // pass handle as an extra arg instead.
    setLiveHandle(handle);
    setHandleNeedsReconnect(false);
    try {
      const candidates = await walkDirectoryHandle(handle, handle.name);
      return processCandidates(candidates, handle.name, handle);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Failed to read folder");
      setImportingGitHub(false);
      return null;
    }
  };

  /** Desktop-wrapper entry point — when running inside Veronum Desktop
   *  (Electron), the picker is a native OS dialog and the file walk runs
   *  in the main process. The renderer never sees absolute paths; we
   *  just merge the returned files into fileEdits and stash the opaque
   *  rootId in importedRepo so future reads/writes can authorize. The
   *  flow bypasses the FSA permission popup entirely. */
  const loadDesktopFolder = async (): Promise<{ repo: string; count: number; dropped: number } | null> => {
    setImportError(null);
    setImportingGitHub(true);
    try {
      const result: DesktopPickResult | null = await desktopPickFolder();
      if (!result) {
        setImportingGitHub(false);
        return null;
      }
      // Merge into fileEdits with the website's path conventions
      // (relative paths, no leading rootName — matches FSA + GitHub).
      const next: Record<string, string> = {};
      for (const f of result.files) next[f.path] = f.content;
      setFileEdits((prev) => ({ ...prev, ...next }));
      const summary = {
        repo: result.rootName,
        count: result.files.length,
        dropped: result.dropped,
      };
      setImportedRepo(summary);
      setDesktopRootId(result.rootId);
      pushRecent({
        kind: "folder",
        name: result.rootName,
        lastUsed: Date.now(),
      });
      // ALWAYS cache — under the session id when one exists, under
      // the draft key otherwise (folder picked at the empty state
      // before the first message). The draft migrates to the real
      // session id the moment one is created. desktopRootId rides
      // along so restore can re-walk the folder LIVE from disk —
      // the main process persists rootId → path across relaunches.
      void saveProjectCache(currentId ?? DRAFT_SESSION_KEY, {
        rootName: result.rootName,
        files: result.files,
        handle: null,
        desktopRootId: result.rootId,
        savedAt: Date.now(),
      });
      setImportingGitHub(false);
      return summary;
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Failed to read folder");
      setImportingGitHub(false);
      return null;
    }
  };

  /** Fetch a GitHub repo and merge its text files into the workspace.
   *  When `accessToken` is provided (from Supabase's GitHub OAuth),
   *  authenticates the upstream fetch so private repos load AND we get
   *  the 5,000/hr rate-limit ceiling instead of the 60/hr anon cap. */
  const loadGitHubRepo = async (
    url: string,
    accessToken?: string | null,
  ): Promise<{ repo: string; count: number; dropped: number } | null> => {
    if (!url.trim()) return null;
    setImportError(null);
    setImportingGitHub(true);
    try {
      const r = await fetch("/api/github/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, ...(accessToken ? { accessToken } : {}) }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
        repo?: string;
        files?: Array<{ path: string; content: string }>;
        droppedCount?: number;
      };
      if (!r.ok || !Array.isArray(j.files)) {
        setImportError(j.detail || j.error || `HTTP ${r.status}`);
        return null;
      }
      // Build a fresh-copy overlay update so React reliably re-renders
      // FileTreePane. We don't tombstone existing imports — successive
      // loads from different repos merge; users can delete files they
      // don't want via FileTreePane's existing context menu.
      const next: Record<string, string> = {};
      for (const f of j.files) next[f.path] = f.content;
      setFileEdits((prev) => ({ ...prev, ...next }));
      const summary = {
        repo: j.repo || "repo",
        count: j.files.length,
        dropped: j.droppedCount ?? 0,
      };
      setImportedRepo(summary);
      pushRecent({
        kind: summary.repo.includes("/") && !summary.repo.startsWith("/")
          ? "github"
          : "folder",
        name: summary.repo,
        url: summary.repo.includes("/") && !summary.repo.startsWith("/")
          ? summary.repo
          : undefined,
        lastUsed: Date.now(),
      });
      return summary;
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Network error");
      return null;
    } finally {
      setImportingGitHub(false);
    }
  };

  // Tombstones for files the user deleted from the file tree. These
  // win over BOTH agent output AND fileEdits — if the path appears
  // here, the project map skips it entirely. Rename = tombstone old +
  // write new. Recreating the same path after deletion re-adds it
  // (fileEdits write removes the entry from this set).
  const [deletedPaths, setDeletedPaths] = useState<Set<string>>(new Set());
  // Split workspace (file tree + editor + terminal) visibility.
  // Default OPEN so users can upload/create files on a fresh chat —
  // VS Code's Explorer is always visible even on an empty folder.
  // Users can still hide it via the "Code" button.
  const [workspaceOpen, setWorkspaceOpen] = useState<boolean>(true);
  // The outer <main> element's scroll container. Passed through to
  // ActiveCompare / ActiveAgents so the scroll-to-bottom chevron can
  // listen to scroll events and call scrollTo on this exact ref.
  const mainScrollRef = useRef<HTMLDivElement | null>(null);
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

  // Restore the cached project (files + DirectoryHandle) when the user
  // switches to a different chat session. Two paths:
  //   1. Files come back from IndexedDB instantly — workspace looks
  //      the same as when the user left it. No permission popup.
  //   2. If a DirectoryHandle was saved AND its read permission is
  //      still 'granted', we silently re-walk the folder for fresh
  //      content. If permission lapsed we flip handleNeedsReconnect
  //      so the UI can surface a one-click reconnect.
  // Dependencies: currentId only. Don't trigger on fileEdits changes
  // (that would clobber edits the user just made with stale cache).
  useEffect(() => {
    if (!currentId) {
      setLiveHandle(null);
      setHandleNeedsReconnect(false);
      return;
    }
    // A session just came into existence (or was switched to). If the
    // user picked a folder BEFORE this session existed, the cache rode
    // under the draft key — migrate it to this session id first so the
    // load below finds it. Idempotent: no-op when no draft exists.
    let cancelled = false;
    (async () => {
      await migrateDraft(currentId);
      const cached = await loadProjectCache(currentId);
      if (cancelled || !cached) return;
      // Files first — instant restore so the workspace is non-empty
      // even if the live re-walk below is slow or fails.
      const restored: Record<string, string> = {};
      for (const f of cached.files) restored[f.path] = f.content;
      setFileEdits((prev) => ({ ...prev, ...restored }));
      setImportedRepo({
        repo: cached.rootName,
        count: cached.files.length,
        dropped: 0,
      });
      // Desktop bridge root (Cursor model): the main process persists
      // rootId → absolute path on disk, so we can re-walk the folder
      // LIVE — fresh bytes from disk, exactly like Cursor reopening a
      // workspace. The snapshot above is just the instant-paint
      // fallback for when the folder moved or was deleted.
      if (cached.desktopRootId && isVeronumDesktop()) {
        setDesktopRootId(cached.desktopRootId);
        try {
          const fresh = await desktopWalkFolder(cached.desktopRootId);
          if (!cancelled && fresh && fresh.files.length > 0) {
            const merged: Record<string, string> = {};
            for (const f of fresh.files) merged[f.path] = f.content;
            setFileEdits((prev) => ({ ...prev, ...merged }));
            setImportedRepo({
              repo: cached.rootName,
              count: fresh.files.length,
              dropped: fresh.dropped,
            });
          }
        } catch {
          // Folder gone or walk failed — cached snapshot stays.
        }
      }
      // Handle, when present: probe permission, re-walk if granted.
      if (cached.handle) {
        const state = await probeHandlePermission(cached.handle);
        if (cancelled) return;
        if (state === "granted") {
          setLiveHandle(cached.handle);
          setHandleNeedsReconnect(false);
          try {
            const fresh = await walkHandle(cached.handle, {
              skipDirs: LOCAL_SKIP_DIRS,
              allowedExtensions: LOCAL_ALLOWED_EXTENSIONS,
              maxFileBytes: MAX_FILE_BYTES,
            });
            if (cancelled) return;
            const merged: Record<string, string> = {};
            for (const f of fresh) merged[f.path] = f.content;
            setFileEdits((prev) => ({ ...prev, ...merged }));
          } catch {
            // Walk failed mid-flight — keep the cached snapshot.
          }
        } else {
          // 'prompt' or 'denied' — keep the snapshot visible but flag
          // that the live link is broken so the UI can offer reconnect.
          setLiveHandle(cached.handle);
          setHandleNeedsReconnect(true);
        }
      } else {
        setLiveHandle(null);
        setHandleNeedsReconnect(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  // Reopen exactly where the user left off — Cursor's model: its
  // storage.json remembers lastActiveWindow.folder and reopens it on
  // every launch. We remember the last active session id and reload
  // it on mount; that flips currentId, which re-fires the restore
  // effect above and brings the whole workspace back (live-walked
  // from disk in desktop mode). Without this, any reload landed on
  // an empty new chat and the user read it as "my code is gone".
  useEffect(() => {
    try {
      if (currentId) localStorage.setItem("veronum.last_session_id", currentId);
    } catch { /* private mode — non-fatal */ }
  }, [currentId]);
  useEffect(() => {
    if (currentId) return; // user already navigated — don't clobber
    let saved: string | null = null;
    try { saved = localStorage.getItem("veronum.last_session_id"); } catch { /* */ }
    if (saved && getSession(saved)) loadSession(saved);
    // Mount-only by design; loadSession is a stable function declaration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setSessions(listSessions()); }, []);

  // Project rules — the user's CLAUDE.md-equivalent text. Persisted in
  // localStorage by lib/compare/projectRules; loaded fresh on each Send
  // so a save in the modal takes effect immediately. `rulesActive`
  // mirrors whether any rules are saved so the header pill can render
  // the active state without re-reading localStorage on every paint.
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [rulesActive, setRulesActive] = useState(false);
  useEffect(() => { setRulesActive(hasProjectRules()); }, []);

  const busy = Object.values(runs).some((r) => r.status === "streaming");
  // hasContent gates the header Code toggle + the active vs empty
  // state of <main>. fileEdits is populated the moment a folder loads
  // (processCandidates merges into it), so checking it here brings the
  // Code toggle into the header right after pick — and the auto-open
  // effect on `projectHasFiles` further down expands the workspace pane.
  // (Can't reference `project` directly: it's a useMemo declared later
  // in this function body, after hasContent's call site.)
  const hasContent =
    lastSlots.length > 0 || turns.length > 0 || Object.keys(fileEdits).length > 0;
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
    // Tombstones win over everything. Files deleted from the file
    // tree disappear regardless of whether an agent originally
    // emitted them or the user edited them previously.
    for (const dead of deletedPaths) delete built[dead];
    return built;
  }, [mode, codeMode, lastSlots, runs, fileEdits, deletedPaths]);

  // Flat path → content map for the agent (read/grep/glob source of
  // truth). Derived from the same `project` the file tree renders.
  const agentFilesMap = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const [path, pf] of Object.entries(project)) out[path] = pf.content;
    return out;
  }, [project]);

  // Workspace snapshot for the prompt — same map the file tree renders,
  // serialised down to the {path, content} pairs /api/compare wants.
  // Capped at ~60KB total to keep the upstream payload sane; the server
  // caps again. Files are taken in path-sort order until the budget
  // is hit, so the same project produces a deterministic snapshot.
  const projectFilesPayload = useMemo<ReadonlyArray<{ path: string; content: string }>>(() => {
    const CAP_BYTES = 60 * 1024;
    const sorted = Object.values(project).sort((a, b) => a.path.localeCompare(b.path));
    const out: Array<{ path: string; content: string }> = [];
    let used = 0;
    for (const f of sorted) {
      const size = (f.content?.length ?? 0) + f.path.length + 12; // ~ fence overhead
      if (used + size > CAP_BYTES) break;
      out.push({ path: f.path, content: f.content ?? "" });
      used += size;
    }
    return out;
  }, [project]);

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

  // Write an edit through to the REAL local file when a desktop folder
  // is loaded. This is what makes the agents (and the editor) actually
  // change code on disk, not just Veronum's in-memory copy. No-op in
  // the browser (no bridge) — there fileEdits stays the source of truth.
  function persistToDisk(path: string, content: string) {
    if (!desktopRootId) return;
    void desktopWriteFile(desktopRootId, path, content).then((r) => {
      if (!r.ok) console.warn(`[disk] write ${path} failed: ${r.error}`);
    });
  }

  function handleFileEdit(path: string, content: string) {
    setFileEdits((prev) => ({ ...prev, [path]: content }));
    persistToDisk(path, content);
    scheduleUserEditRecord(path, content);
  }

  /** New file from the tree (or upload, or drag-drop). Same overlay
   *  as edits; also clears the tombstone in case the user is
   *  recreating a previously-deleted path. */
  function handleFileCreate(path: string, content: string) {
    setFileEdits((prev) => ({ ...prev, [path]: content }));
    persistToDisk(path, content);
    setDeletedPaths((prev) => {
      if (!prev.has(path)) return prev;
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }

  /** Move a file. Read the current content from the project map (so
   *  we pick up either the agent-emitted version or the user's edits,
   *  whichever is current), write it to the new path, tombstone the
   *  old one. Folder renames decompose into N calls in FileTreePane. */
  function handleFileRename(oldPath: string, newPath: string) {
    if (oldPath === newPath) return;
    const current = project[oldPath]?.content ?? fileEdits[oldPath] ?? "";
    persistToDisk(newPath, current);
    setFileEdits((prev) => {
      const next = { ...prev, [newPath]: current };
      delete next[oldPath];
      return next;
    });
    setDeletedPaths((prev) => {
      const next = new Set(prev);
      next.add(oldPath);
      next.delete(newPath);
      return next;
    });
  }

  /** Tombstone a path. We also remove any fileEdits entry so a future
   *  rebuild doesn't resurrect it from the overlay. */
  function handleFileDelete(path: string) {
    setFileEdits((prev) => {
      if (!(path in prev)) return prev;
      const next = { ...prev };
      delete next[path];
      return next;
    });
    setDeletedPaths((prev) => {
      if (prev.has(path)) return prev;
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  }

  // ── Compare → real file edits ────────────────────────────────────
  // Write a model's code output through to the actual local files.
  // handleFileEdit persists to disk (desktop) AND updates the in-memory
  // workspace, so the editor reflects it too. Only COMPLETE blocks are
  // written — never partial streamed content.
  const applyModelEditsToDisk = useCallback((slotId: string) => {
    if (!desktopRootId) return;
    const text = runs[slotId]?.text ?? "";
    if (!text.trim()) return;
    const model = MODELS.find((m) => m.id === slotId);
    const hint = model?.label?.replace(/\s+/g, "-") || slotId;
    const blocks = parseAgentOutput(text, hint);
    for (const b of blocks) {
      if (b.path && b.complete && b.content) handleFileEdit(b.path, b.content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desktopRootId, runs]);

  // Tracks which (slotId@finishedAt) completions we've already written
  // so the effects don't re-apply the same output every render.
  const appliedRef = useRef<Set<string>>(new Set());

  // SINGLE model + folder loaded → auto-apply its edits to real files
  // the moment it finishes. No picking needed (the user's rule).
  useEffect(() => {
    if (!desktopRootId) return;
    const workers = lastSlots.filter((s) => s.role !== "synthesizer");
    if (workers.length !== 1) return;
    const slot = workers[0];
    const run = runs[slot.id];
    if (run?.status !== "done") return;
    const key = `${slot.id}@${run.finishedAt ?? 0}`;
    if (appliedRef.current.has(key)) return;
    appliedRef.current.add(key);
    applyModelEditsToDisk(slot.id);
  }, [runs, lastSlots, desktopRootId, applyModelEditsToDisk]);

  // MULTIPLE models + folder → when the user PICKS a winner (favorite),
  // apply THAT model's edits to the real files.
  useEffect(() => {
    if (!desktopRootId || !favorite) return;
    const workers = lastSlots.filter((s) => s.role !== "synthesizer");
    if (workers.length < 2) return;
    const run = runs[favorite];
    if (run?.status !== "done") return;
    const key = `pick:${favorite}@${run.finishedAt ?? 0}`;
    if (appliedRef.current.has(key)) return;
    appliedRef.current.add(key);
    applyModelEditsToDisk(favorite);
  }, [favorite, runs, lastSlots, desktopRootId, applyModelEditsToDisk]);

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

  /** Run the tool-use agent loop for the single selected model. This
   *  is what makes Compare actually DO things — edit files AND run
   *  commands (npm, git, open apps) via the desktop bash bridge.
   *  Auto-applies (no permission prompts) per the user's rule. */
  async function runCompareAgent(prompt: string) {
    if (!desktopRootId) return;
    const modelId = [...selected][0];
    if (!modelId) return;
    agentAbortRef.current?.abort();
    const abort = new AbortController();
    agentAbortRef.current = abort;
    setAgentRunning(true);
    setAgentEvents([{ type: "assistant", text: prompt, calls: [] }]);
    const context: AgentContext = {
      desktopRootId,
      files: () => agentFilesMap,
      applyEdit: async (path, content) => { handleFileEdit(path, content); return true; },
    };
    try {
      await runAgent({
        modelId,
        task: prompt,
        // Fresh, auto-refreshed token each step so a long npm/build
        // run doesn't die with invalid_token partway through.
        getToken: async () => {
          const { data } = await getBrowserSupabase().auth.getSession();
          return data.session?.access_token ?? null;
        },
        context,
        mode: "bypass", // auto — just do it (user: ignore permissions for now)
        systemExtra: hasProjectRules() ? loadProjectRules() ?? undefined : undefined,
        signal: abort.signal,
        requestApproval: async () => true,
        onEvent: (e) => setAgentEvents((prev) => [...prev, e]),
      });
    } finally {
      setAgentRunning(false);
      agentAbortRef.current = null;
    }
  }

  async function submitCompare(prompt: string, attachments: Attachment[]) {
    // Agent path: a real local folder is loaded (desktop bridge) AND
    // exactly one model is selected → run the tool loop so it can edit
    // files AND run commands, instead of a chat-only compare. Multiple
    // models stay normal compare (you pick a winner to apply).
    if (desktopRootId && selected.size === 1) {
      void runCompareAgent(prompt);
      return;
    }
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
    // Read project rules fresh per Send so an edit in the modal takes
    // effect on the very next send without a remount. Empty string =>
    // no projectContext field on the slot (server skips the append).
    const rules = loadProjectRules();
    const slots: RunSlot[] = [...selected].map((modelId) => ({
      id: modelId, modelId, prompt,
      ...(rules ? { projectContext: rules } : {}),
      attachments: wire.length ? wire : undefined,
      projectFiles: projectFilesPayload.length ? projectFilesPayload : undefined,
      prevTurns: history.length ? history : undefined,
      sessionId: sessId,
      turnIndex,
      mode: "compare",
    }));
    await start(slots);
  }

  /** "Inspect" button — fires a deep code review across every
   *  selected model in parallel. Reuses submitCompare's freezing +
   *  history wiring so the inspection lands in the chat like any
   *  other turn (pick-as-main + follow-ups work for free). Differs
   *  in two ways: the prompt body is auto-generated (all project
   *  files inlined), and the systemPrompt is overridden with the
   *  inspection-specific rules so the model produces structured,
   *  cited findings instead of bland prose. */
  async function submitInspection() {
    if (busy) return;
    if (selected.size === 0) return;
    const size = estimateInspectionSize(project);
    if (size.files === 0) {
      // Easier to use window.alert than build a toast for v1 — same
      // posture as the file-tree delete confirm.
      window.alert("Nothing to inspect — generate or upload some code first.");
      return;
    }
    if (size.willTruncate) {
      const ok = window.confirm(
        `This project has ${size.files} files (${(size.chars / 1024).toFixed(0)}k chars). It exceeds the per-request cap, so some files will be omitted from each model's view. Inspect anyway?`,
      );
      if (!ok) return;
    }

    // Freeze prior turn first — same pattern as submitCompare.
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
              pickedSlotId: favorite,
            }),
          ]
        : turns;
    setTurns(frozenTurnsBefore);

    const sessId = currentId ?? newSessionId();
    if (!currentId) setCurrentId(sessId);
    setFavorite(null);
    setExpandedId(null);
    setPaywallDismissed(false);

    const history = buildHistory(frozenTurnsBefore);
    const turnIndex = frozenTurnsBefore.length;
    const inspectionPrompt = buildInspectionPrompt(project);
    const projectRules = loadProjectRules();
    // Layer house voice → project rules → inspection on top of each
    // other. Inspection rules are the most specific so they go last.
    const layeredSystem = projectRules
      ? `${INSPECTION_SYSTEM_PROMPT}\n\n# This user's project conventions\n${projectRules}`
      : INSPECTION_SYSTEM_PROMPT;

    const slots: RunSlot[] = [...selected].map((modelId) => ({
      id: modelId,
      modelId,
      prompt: inspectionPrompt,
      systemPrompt: layeredSystem,
      projectFiles: projectFilesPayload.length ? projectFilesPayload : undefined,
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
      projectFiles: projectFilesPayload.length ? projectFilesPayload : undefined,
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
    setFileEdits({});
    setDeletedPaths(new Set());
    setImportedRepo(null);
    setImportError(null);
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
    setDeletedPaths(new Set());
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
    // h-screen + overflow-hidden pins the page to the viewport so the
    // sidebar (a flex-row child) stays put while the chat scrolls
    // INSIDE <main> below — instead of the whole document scrolling and
    // dragging the sidebar with it. ChatHeader's `sticky top-0` and the
    // composers' `sticky bottom-0` keep working because their nearest
    // scrolling ancestor is now <main>, exactly the contract sticky
    // wants.
    <div className="h-screen bg-black text-white flex overflow-hidden">
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
          rulesActive={rulesActive}
          onOpenRules={() => setRulesModalOpen(true)}
          currentProjectName={importedRepo?.repo ?? null}
        />
        {/* min-h-0 lets <main> shrink below its content size inside the
         *  flex column (without it the flex parent grows tall and we're
         *  back to body scroll). overflow-y-auto makes <main> the
         *  scrolling container. */}
        <main ref={mainScrollRef} className="flex-1 min-h-0 overflow-y-auto flex flex-col">
          {agentEvents.length > 0 ? (
            // Agent execution view: a normal top-to-bottom chat where
            // the transcript scrolls and the composer stays pinned to
            // the bottom (same sticky pattern as ActiveCompare) — so it
            // never pushes the composer off-screen.
            <>
              <div className="flex justify-center pt-4">
                <ModeToggle mode={mode} onChange={setModeAndReset} autoResearchLocked={!isSubscribed} />
              </div>
              <div className="flex-1 px-4 sm:px-6 lg:px-10 pt-5 pb-40">
                <div className="max-w-[1100px] mx-auto w-full">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-white/80 text-[13px] font-medium">Agent</span>
                    {agentRunning ? (
                      <button
                        onClick={() => { agentAbortRef.current?.abort(); setAgentRunning(false); }}
                        className="text-[12px] text-white/50 hover:text-white/80 underline underline-offset-2"
                      >
                        Stop
                      </button>
                    ) : (
                      <button
                        onClick={() => setAgentEvents([])}
                        className="text-[12px] text-white/40 hover:text-white/70 underline underline-offset-2"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {agentEvents.map((e, i) => <AgentEventRow key={i} event={e} />)}
                    {agentRunning && (
                      <div className="text-white/45 text-[13px] animate-pulse">Working…</div>
                    )}
                  </div>
                </div>
              </div>
              <div className="sticky bottom-0 px-4 sm:px-6 lg:px-10 pb-6 pt-12 bg-gradient-to-t from-black from-50% to-transparent pointer-events-none">
                <div className="max-w-[1100px] mx-auto pointer-events-auto">
                  <PromptBar
                    busy={agentRunning}
                    onSubmit={submitCompare}
                    onCancel={() => { agentAbortRef.current?.abort(); setAgentRunning(false); }}
                    selected={selected}
                    onOpenPicker={() => setPickerOpen(true)}
                    autoFocus
                    onOpenRulesModal={() => setRulesModalOpen(true)}
                    onNewChat={newChat}
                  />
                </div>
              </div>
            </>
          ) : !hasContent ? (
            <EmptyState
              mode={mode}
              onModeChange={setModeAndReset}
              autoResearchLocked={!isSubscribed}
              workspaceChips={
                <FolderChip
                  currentName={importedRepo?.repo ?? null}
                  busy={importingGitHub}
                  onPickHandle={loadLocalFolderFromHandle}
                  onPickFiles={loadLocalFolder}
                  onPickDesktop={inDesktopWrapper ? loadDesktopFolder : undefined}
                />
              }
              compare={
                <PromptBar
                  busy={busy}
                  onSubmit={submitCompare}
                  onCancel={cancel}
                  selected={selected}
                  onOpenPicker={() => setPickerOpen(true)}
                  autoFocus
                  onOpenRulesModal={() => setRulesModalOpen(true)}
                  onNewChat={newChat}
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
              onFileCreate={handleFileCreate}
              onFileRename={handleFileRename}
              onFileDelete={handleFileDelete}
              onInspect={submitInspection}
              canUndo={!!undoState.nextUndo}
              canRedo={!!undoState.nextRedo}
              undoTooltip={undoTooltip}
              redoTooltip={redoTooltip}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onOpenVersionHistory={() => setVersionModalOpen(true)}
              canPreview={isSubscribed === true}
              outerScrollRef={mainScrollRef}
              compose={
                <PromptBar
                  busy={busy}
                  onSubmit={submitCompare}
                  onCancel={cancel}
                  selected={selected}
                  onOpenPicker={() => setPickerOpen(true)}
                  onOpenRulesModal={() => setRulesModalOpen(true)}
                  onNewChat={newChat}
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
              onFileCreate={handleFileCreate}
              onFileRename={handleFileRename}
              onFileDelete={handleFileDelete}
              onInspect={submitInspection}
              canUndo={!!undoState.nextUndo}
              canRedo={!!undoState.nextRedo}
              undoTooltip={undoTooltip}
              redoTooltip={redoTooltip}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onOpenVersionHistory={() => setVersionModalOpen(true)}
              canPreview={isSubscribed === true}
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

      {rulesModalOpen && (
        <ProjectRulesModal
          onClose={() => setRulesModalOpen(false)}
          onSaved={() => setRulesActive(hasProjectRules())}
        />
      )}

    </div>
  );
}

/** Recent project entry persisted in localStorage and surfaced in the
 *  workspace-chip dropdown. `name` is what's displayed and used as the
 *  dedup key; `url` is filled when kind === 'github' so we can re-ingest
 *  with one click. Folders can't be re-ingested without the user
 *  re-picking (browser file APIs don't keep handles across reloads),
 *  so the folder recents only show the historical name for tooltip. */
type RecentProject = {
  kind: "folder" | "github";
  name: string;
  url?: string;
  lastUsed: number;
};

/**
 * SessionStartPicker — surfaces at the top of every new session so the
 * user picks a project context before chatting. Three options:
 *
 *   1. New project  — empty workspace; just chat
 *   2. Upload project — native folder picker via webkitdirectory; files
 *      read in-browser, no upload to our server
 *   3. Upload from GitHub URL — paste a public repo URL; /api/github/ingest
 *      fetches the text files server-side. OAuth-based "Connect GitHub"
 *      repo picker is queued for a follow-up.
 *
 * The picker is a blocking modal — there's no close button because the
 * user must pick before starting. Re-opens on every newChat() so each
 * fresh session starts with a fresh project context.
 */
function SessionStartPicker({
  busy, error, onClose, onPickNew, onPickFolder, onPickGitHub,
}: {
  busy: boolean;
  error: string | null;
  /** Dismiss without picking. Called on X-button click, backdrop click,
   *  and Escape. Leaves any existing project attachment alone — this
   *  picker is for ATTACHING a new project, not unattaching one. */
  onClose: () => void;
  onPickNew: () => void;
  onPickFolder: (files: FileList) => Promise<void> | void;
  onPickGitHub: (url: string) => Promise<void> | void;
}) {
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [showUrl, setShowUrl] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  // webkitdirectory isn't a standard HTML attribute, so React's typed
  // props don't include it. Setting via attribute on mount is the
  // cleanest workaround — browsers that support it pick it up; older
  // browsers fall back to a regular file picker.
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "");
      folderInputRef.current.setAttribute("directory", "");
    }
  }, []);

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center px-6"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
      onKeyDown={(e) => { if (e.key === "Escape" && !busy) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Attach project"
      tabIndex={-1}
    >
      <div className="w-full max-w-[560px] rounded-2xl border border-white/10 bg-[#161616] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.55)] relative">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Close"
          className="absolute top-3 right-3 w-7 h-7 inline-flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] rounded-md transition-colors disabled:opacity-50"
        >
          <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
            <path d="M3 3l6 6M9 3l-6 6" />
          </svg>
        </button>
        <h2 className="text-white font-serif text-[24px] leading-[1.2] mb-2">
          What are you working on?
        </h2>
        <p className="text-white/55 text-[13.5px] leading-[1.5] mb-6">
          Pick a project so every model in the grid sees the same code.
          You can skip and just chat, but agents work better when they
          have your files for context.
        </p>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onPickNew}
            disabled={busy}
            className="block w-full text-left rounded-xl border border-white/10 bg-[#1f1f1f] hover:border-white/30 transition p-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-baseline justify-between">
              <span className="font-serif text-[16px] font-medium text-white">
                New project
              </span>
              <span className="font-mono text-[12px] text-white/40">empty</span>
            </div>
            <p className="text-[12.5px] text-white/55 mt-1">
              Start blank. Add files later or just chat.
            </p>
          </button>

          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            disabled={busy}
            className="block w-full text-left rounded-xl border border-[#d97757]/40 bg-[#d97757]/[0.06] hover:border-[#d97757] transition p-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-baseline justify-between">
              <span className="font-serif text-[16px] font-medium text-white">
                Upload project
              </span>
              <span className="font-mono text-[12px] text-[#d97757]">recommended</span>
            </div>
            <p className="text-[12.5px] text-white/55 mt-1">
              Pick a folder from your Mac. Files stay in your browser — we
              don&rsquo;t upload them anywhere.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setShowUrl((v) => !v)}
            disabled={busy}
            aria-expanded={showUrl}
            className="block w-full text-left rounded-xl border border-white/10 bg-[#1f1f1f] hover:border-white/30 transition p-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-baseline justify-between">
              <span className="font-serif text-[16px] font-medium text-white">
                Upload from GitHub
              </span>
              <span className="font-mono text-[12px] text-white/40">public repo URL</span>
            </div>
            <p className="text-[12.5px] text-white/55 mt-1">
              Paste a github.com URL. Connecting your GitHub account
              for private repos is coming soon.
            </p>
          </button>

          {showUrl && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && urlInput.trim() && !busy) {
                    onPickGitHub(urlInput.trim());
                  }
                }}
                placeholder="github.com/owner/repo"
                autoFocus
                disabled={busy}
                className="flex-1 bg-black/40 border border-white/10 focus:border-white/30 rounded-md px-3 py-2 text-[13px] text-white/95 placeholder:text-white/30 outline-none transition-colors font-mono"
              />
              <button
                type="button"
                onClick={() => urlInput.trim() && onPickGitHub(urlInput.trim())}
                disabled={busy || !urlInput.trim()}
                className="px-3 py-2 rounded-md text-[13px] font-medium bg-[#d97757] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#c5663f] transition-colors"
              >
                {busy ? "Loading…" : "Load"}
              </button>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 text-[12px] text-red-300/90 font-mono break-words">
            {error}
          </p>
        )}

        <input
          ref={folderInputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onPickFolder(e.target.files);
            }
          }}
        />
      </div>
    </div>
  );
}

function ChatHeader({
  showWorkspaceToggle, workspaceOpen, onToggleWorkspace,
  rulesActive, onOpenRules,
  currentProjectName,
}: {
  showWorkspaceToggle: boolean;
  workspaceOpen: boolean;
  onToggleWorkspace: () => void;
  rulesActive: boolean;
  onOpenRules: () => void;
  /** Currently-attached project (folder name or owner/repo). Shown as
   *  a static status pill so the user always knows what's in context.
   *  Picking / changing happens via the WorkspaceChips in EmptyState. */
  currentProjectName: string | null;
}) {
  // Window-drag region for Veronum Desktop (Claude.app's pattern,
  // verified in their CSS bundle: `-webkit-app-region: drag` on the
  // title bar surface, `no-drag` on every interactive child). The
  // Electron window uses titleBarStyle:hiddenInset, so without this
  // the window can be resized but never MOVED. In a regular browser
  // the property is unknown CSS and silently ignored.
  const dragRegion = { WebkitAppRegion: "drag" } as React.CSSProperties;
  const noDrag = { WebkitAppRegion: "no-drag" } as React.CSSProperties;
  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-black/85" style={dragRegion}>
      <div className="px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-end gap-1">
        {/* Project status pill — shown only when something's attached
         *  so the user always knows what's in context. Pick / change a
         *  project via the WorkspaceChips in the empty state at session
         *  start (sidebar → New session brings you back to it). */}
        {currentProjectName ? (
          <span
            title={`Project: ${currentProjectName}`}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-mono mr-2 text-white/75 bg-white/[0.05] border border-white/10"
          >
            <FolderIcon />
            {currentProjectName}
          </span>
        ) : null}
        {showWorkspaceToggle && (
          <button
            type="button"
            onClick={onToggleWorkspace}
            style={noDrag}
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
        <button
          type="button"
          onClick={onOpenRules}
          style={noDrag}
          title={rulesActive
            ? "Edit project rules (active on every send)"
            : "Set project rules — the CLAUDE.md for every model in the grid"}
          aria-pressed={rulesActive}
          className={[
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] transition-colors",
            rulesActive
              ? "bg-[#d97757]/10 text-[#d97757] border border-[#d97757]/40 hover:bg-[#d97757]/15"
              : "text-white/60 hover:text-white hover:bg-white/[0.06] border border-transparent",
          ].join(" ")}
        >
          <RulesIcon />
          Rules{rulesActive ? " · on" : ""}
        </button>
        <Link href="/welcome" style={noDrag} className="px-3 py-1.5 rounded-full text-[13px] text-white/60 hover:text-white hover:bg-white/[0.06] transition">
          Desktop app
        </Link>
        <Link href="/admin" style={noDrag} className="hidden sm:inline px-3 py-1.5 rounded-full text-[13px] text-white/60 hover:text-white hover:bg-white/[0.06] transition">
          Admin
        </Link>
      </div>
    </header>
  );
}

function FolderIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1.5 4.5h4l1.5 1.5h7.5v8H1.5z" />
    </svg>
  );
}

function GitHubIconSmall() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
    </svg>
  );
}


/**
 * FolderChip — single button above the composer. Click it and you get
 * the native OS folder picker — with the "New Folder" button when the
 * browser supports showDirectoryPicker (Chrome / Edge / Brave / Opera),
 * or the upload-style dialog as a fallback (Safari / Firefox).
 *
 * Same behaviour as Claude.app's folder button: one click → OS picker
 * with both choose-existing and create-new as native dialog actions,
 * no app-side dropdown.
 */
function FolderChip({
  currentName, busy, onPickHandle, onPickFiles, onPickDesktop,
}: {
  currentName: string | null;
  busy: boolean;
  onPickHandle: (handle: FileSystemDirectoryHandle) => Promise<{ repo: string; count: number; dropped: number } | null>;
  onPickFiles: (files: FileList) => Promise<{ repo: string; count: number; dropped: number } | null>;
  /** Present only when the app is running inside Veronum Desktop —
   *  fires a native OS folder dialog via Electron IPC. */
  onPickDesktop?: () => Promise<{ repo: string; count: number; dropped: number } | null>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.setAttribute("webkitdirectory", "");
      inputRef.current.setAttribute("directory", "");
    }
  }, []);

  const handleClick = async () => {
    if (busy) return;
    // 1) Desktop wrapper wins outright — native dialog, no FSA prompt,
    //    Node fs walks the tree. The bridge is the whole point of the
    //    desktop app.
    if (onPickDesktop) {
      try { await onPickDesktop(); } catch (e) {
        console.warn("[FolderChip] desktop pick failed:", e);
      }
      return;
    }
    // 2) Chrome/Edge/Brave/Opera — FSA path with the native "New
    //    Folder" button in the dialog.
    const fsa = (window as Window & {
      showDirectoryPicker?: (opts?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
    }).showDirectoryPicker;
    if (typeof fsa === "function") {
      try {
        const handle = await fsa({ mode: "read" });
        if (handle) await onPickHandle(handle);
      } catch (e) {
        const name = e instanceof Error ? e.name : "";
        if (name !== "AbortError") {
          console.warn("[FolderChip] showDirectoryPicker failed:", e);
        }
      }
      return;
    }
    // 3) Safari / Firefox — webkitdirectory fallback. No "New Folder"
    //    button but covers everyone.
    inputRef.current?.click();
  };

  const label = currentName
    ? currentName.length > 26 ? `${currentName.slice(0, 24)}…` : currentName
    : "Folder";

  return (
    <div className="flex items-center justify-center mb-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        title={currentName ? "Change project folder" : "Pick a folder or create a new one"}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] bg-[#1f1f1f] border border-white/10 text-white/80 hover:bg-[#262626] hover:border-white/25 transition-colors disabled:opacity-50"
      >
        <FolderIcon />
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onPickFiles(e.target.files);
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}

function CaretDownIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 4.5l3 3 3-3" />
    </svg>
  );
}

function RulesIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 2.5h6l3 3v8H3.5z" />
      <path d="M9.5 2.5v3h3" />
      <path d="M5.5 8.5h5" />
      <path d="M5.5 11h3.5" />
    </svg>
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
  // "Agent" is no longer a separate tab — it's merged into Compare:
  // load a folder in Compare and the agent surface (tool execution +
  // permission control) takes over. Multi-agent stays its own tab.
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
  workspaceChips,
}: {
  mode: Mode;
  onModeChange: (m: Mode) => void;
  compare: React.ReactNode;
  agents: React.ReactNode;
  autoResearch: React.ReactNode;
  autoResearchLocked?: boolean;
  /** Folder + GitHub chips that let the user attach a project context
   *  before sending. Rendered above the mode-specific compose section
   *  so it's the first thing the user sees and reaches for. */
  workspaceChips?: React.ReactNode;
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
        {workspaceChips}
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
  onFileCreate, onFileRename, onFileDelete, onInspect,
  canUndo, canRedo, undoTooltip, redoTooltip,
  onUndo, onRedo, onOpenVersionHistory, canPreview,
  outerScrollRef,
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
  onFileCreate: (path: string, content: string) => void;
  onFileRename: (oldPath: string, newPath: string) => void;
  onFileDelete: (path: string) => void;
  onInspect: () => void;
  canUndo: boolean;
  canRedo: boolean;
  undoTooltip: string;
  redoTooltip: string;
  onUndo: () => void;
  onRedo: () => void;
  onOpenVersionHistory: () => void;
  canPreview: boolean;
  outerScrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [chatPct, setChatPct] = useState(56);
  const rowRef = useRef<HTMLDivElement | null>(null);
  // Inner scroll container ref — only attached when the workspace is open
  // (the layout has its OWN scrolling chat column, separate from <main>).
  // When closed, scroll happens on outerScrollRef from the parent.
  const innerScrollRef = useRef<HTMLDivElement | null>(null);

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
          <div className="max-w-[1100px] mx-auto pointer-events-auto relative">
            <ScrollToBottomButton scrollRef={outerScrollRef} />
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
          ref={innerScrollRef}
          className="min-w-0 flex flex-col gap-4 overflow-y-auto pr-3 relative"
          style={{ flexBasis: `${chatPct}%`, flexGrow: 0, flexShrink: 0 }}
        >
          <div className="flex-1">{chatBody}</div>
          <div className="sticky bottom-0 pt-8 pb-2 bg-gradient-to-t from-black from-60% to-transparent pointer-events-none">
            <div className="pointer-events-auto relative">
              <ScrollToBottomButton scrollRef={innerScrollRef} />
              {compose}
            </div>
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
            onFileCreate={onFileCreate}
            onFileRename={onFileRename}
            onFileDelete={onFileDelete}
            onInspect={onInspect}
            canUndo={canUndo}
            canRedo={canRedo}
            undoTooltip={undoTooltip}
            redoTooltip={redoTooltip}
            onUndo={onUndo}
            onRedo={onRedo}
            onOpenVersionHistory={onOpenVersionHistory}
            canPreview={canPreview}
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
  onFileCreate, onFileRename, onFileDelete, onInspect,
  canUndo, canRedo, undoTooltip, redoTooltip,
  onUndo, onRedo, onOpenVersionHistory, canPreview,
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
  onFileCreate: (path: string, content: string) => void;
  onFileRename: (oldPath: string, newPath: string) => void;
  onFileDelete: (path: string) => void;
  onInspect: () => void;
  canUndo: boolean;
  canRedo: boolean;
  undoTooltip: string;
  redoTooltip: string;
  onUndo: () => void;
  onRedo: () => void;
  onOpenVersionHistory: () => void;
  canPreview: boolean;
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
                onFileCreate={onFileCreate}
                onFileRename={onFileRename}
                onFileDelete={onFileDelete}
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

/**
 * Floating chevron button that appears just above the composer when the
 * scroll container is NOT pinned to the bottom — click it and the chat
 * smooth-scrolls to the latest message. Modeled on Claude's pattern
 * (absolute, -top-[32px] above the composer, fades in/out via opacity).
 *
 * Two contracts:
 *   - The button positions absolutely; its nearest positioned parent
 *     must be the sticky composer wrapper (already `position: sticky`).
 *   - `scrollRef` must point to the scroll container whose scrollTop /
 *     scrollHeight we watch. We attach a scroll listener on mount.
 *
 * Threshold: 80px from the bottom. Below that we treat the view as
 * "at bottom" and hide the button. Matches Claude's feel — small enough
 * that the button doesn't linger on tiny scroll jitters, large enough
 * that a typical streaming chunk doesn't yank the button on/off.
 */
function ScrollToBottomButton({
  scrollRef,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const compute = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShow(distanceFromBottom > 80);
    };
    compute();
    el.addEventListener("scroll", compute, { passive: true });
    // ResizeObserver catches the case where new content arrives but the
    // user didn't scroll — without it the button would never appear
    // during streaming because scroll events aren't fired.
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", compute);
      ro.disconnect();
    };
  }, [scrollRef]);

  function handleClick() {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Scroll to bottom"
      aria-hidden={!show}
      tabIndex={show ? 0 : -1}
      className={
        "absolute left-1/2 -translate-x-1/2 -top-[32px] z-[1] " +
        "inline-flex items-center justify-center h-[24px] w-[24px] " +
        "rounded-full bg-[#1f1f1f] border border-white/10 text-white/70 " +
        "hover:bg-[#262626] hover:border-white/25 hover:text-white/95 " +
        "transition-opacity duration-150 outline-none " +
        (show ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")
      }
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 6l4 4 4-4" />
      </svg>
    </button>
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
