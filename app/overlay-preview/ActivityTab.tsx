"use client";

/**
 * ActivityTab — sortable feed of file changes inside a shared Veronum
 * project. Pulls history from /api/v1/projects/[id]/changes once on mount
 * and subscribes to Supabase Realtime for live updates. Group/sort modes
 * (time, person, file, app) come from the user's "organize by" toggle.
 */

import { useEffect, useMemo, useState } from "react";
import { api, type VeronumFileChange } from "@/lib/api-client";
import { getBrowserSupabase } from "@/lib/supabase-browser";

type GroupMode = "time" | "person" | "app" | "file";

export function ActivityTab({
  veronumProjectId,
  userId,
}: {
  veronumProjectId: string;
  userId: string | null;
}) {
  const [changes, setChanges] = useState<VeronumFileChange[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [groupMode, setGroupMode] = useState<GroupMode>("time");

  // Initial fetch
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    api
      .listChanges(veronumProjectId, userId, { limit: 500 })
      .then((r) => {
        if (cancelled) return;
        setChanges(r.changes);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [veronumProjectId, userId]);

  // Realtime subscription for live activity
  useEffect(() => {
    if (!userId) return;
    let channel: ReturnType<ReturnType<typeof getBrowserSupabase>["channel"]> | null = null;
    try {
      const sb = getBrowserSupabase();
      channel = sb
        .channel(`veronum_file_changes:${veronumProjectId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "veronum_file_changes",
            filter: `project_id=eq.${veronumProjectId}`,
          },
          (payload) => {
            const c = payload.new as VeronumFileChange;
            setChanges((prev) => {
              if (!prev) return [c];
              if (prev.some((x) => x.id === c.id)) return prev;
              return [c, ...prev];
            });
          }
        )
        .subscribe();
    } catch (e) {
      console.warn("[activity] realtime subscribe failed:", e);
    }
    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [veronumProjectId, userId]);

  // Group changes by the active mode. Each group keeps changes ordered
  // newest-first inside it.
  const groups = useMemo<Group[]>(() => {
    if (!changes) return [];
    const sorted = [...changes].sort((a, b) =>
      a.created_at < b.created_at ? 1 : -1
    );
    if (groupMode === "time") {
      return [{ key: "all", label: "All changes", color: "#9a9a93", items: sorted }];
    }
    const byKey = new Map<string, Group>();
    for (const c of sorted) {
      let key: string;
      let label: string;
      let color: string;
      if (groupMode === "person") {
        key = c.author_id || c.author_name;
        label = c.author_name;
        color = c.author_color;
      } else if (groupMode === "app") {
        key = c.source_app || "unknown";
        label = c.source_app || "unknown";
        color = "#9a9a93";
      } else {
        // file
        key = c.file_path;
        label = c.file_path;
        color = "#9a9a93";
      }
      let group = byKey.get(key);
      if (!group) {
        group = { key, label, color, items: [] };
        byKey.set(key, group);
      }
      group.items.push(c);
    }
    return [...byKey.values()].sort(
      (a, b) =>
        (b.items[0]?.created_at || "").localeCompare(a.items[0]?.created_at || "") || 0
    );
  }, [changes, groupMode]);

  if (error) {
    return (
      <div className="px-5 py-4 max-w-[820px] mx-auto">
        <p className="text-[12.5px] text-[#c44] font-mono break-words">{error}</p>
      </div>
    );
  }
  if (!changes) {
    return (
      <div className="px-5 py-4 max-w-[820px] mx-auto">
        <div
          className="inline-block w-5 h-5 border-2 rounded-full animate-spin"
          style={{ borderColor: "#cc785c", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  return (
    <div className="px-5 py-4 max-w-[820px] mx-auto pb-32">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-[10.5px] text-[#9a9a93] font-mono uppercase tracking-[0.10em]">
          organize by
        </span>
        {(["time", "person", "app", "file"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setGroupMode(m)}
            className={`px-2.5 py-1 rounded-md text-[11.5px] font-medium transition ${
              groupMode === m
                ? "bg-[#cc785c] text-white"
                : "bg-black/[0.05] text-[#1a1a18] hover:bg-black/[0.08]"
            }`}
          >
            {m}
          </button>
        ))}
        <span className="ml-auto text-[10.5px] text-[#9a9a93] font-mono">
          {changes.length} change{changes.length === 1 ? "" : "s"}
        </span>
      </div>

      {changes.length === 0 ? (
        <p className="text-[12.5px] text-[#7d7d76]">
          No file changes yet. As soon as anyone in the room saves a file in
          their bound project folder, the change will land here within ~1
          second — author, file, line counts, and which IDE they used.
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.key}>
              {groupMode !== "time" && (
                <h3 className="flex items-baseline gap-2 mb-2">
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: g.color }}
                  />
                  <span
                    className="text-[13px] font-medium text-[#1a1a18]"
                    style={{ fontFamily: '"Newsreader", Georgia, serif' }}
                  >
                    {g.label}
                  </span>
                  <span className="text-[10.5px] text-[#9a9a93] font-mono">
                    {g.items.length}
                  </span>
                </h3>
              )}
              <ul className="space-y-1.5">
                {g.items.map((c) => (
                  <ChangeRow key={c.id} change={c} hideAuthor={groupMode === "person"} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type Group = {
  key: string;
  label: string;
  color: string;
  items: VeronumFileChange[];
};

function ChangeRow({
  change,
  hideAuthor,
}: {
  change: VeronumFileChange;
  hideAuthor: boolean;
}) {
  const kindColor =
    change.change_kind === "create"
      ? "#3b8d4a"
      : change.change_kind === "delete"
      ? "#c44"
      : "#1a1a18";
  return (
    <li className="flex items-baseline gap-2 px-2 py-1.5 rounded-md hover:bg-black/[0.03]">
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: change.author_color }}
      />
      {!hideAuthor && (
        <span className="text-[11.5px] text-[#1a1a18] font-medium flex-shrink-0 truncate max-w-[120px]">
          {change.author_name}
        </span>
      )}
      <span
        className="text-[11px] font-mono uppercase tracking-[0.06em] flex-shrink-0"
        style={{ color: kindColor }}
      >
        {change.change_kind}
      </span>
      <span className="text-[12.5px] font-mono text-[#1a1a18] truncate flex-1 min-w-0">
        {change.file_path}
      </span>
      {(change.lines_added != null || change.lines_removed != null) && (
        <span className="text-[10.5px] font-mono text-[#9a9a93] flex-shrink-0">
          {change.lines_added ? <span className="text-[#3b8d4a]">+{change.lines_added}</span> : null}
          {change.lines_removed ? <span className="text-[#c44] ml-1">-{change.lines_removed}</span> : null}
        </span>
      )}
      <span className="text-[10.5px] text-[#9a9a93] font-mono flex-shrink-0">
        {change.source_app || "?"}
      </span>
      <span className="text-[10.5px] text-[#9a9a93] flex-shrink-0">
        {formatRelativeTime(change.created_at)}
      </span>
    </li>
  );
}

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 5000) return "now";
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`;
  return new Date(iso).toLocaleDateString();
}
