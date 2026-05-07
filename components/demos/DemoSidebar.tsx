/**
 * DemoSidebar — exact recreation of the Veronum app's left rail.
 *
 * Visual reference: renderer/src/layout/ProjectsSidebar.tsx
 *
 * Layout matches the dframe-sidebar absolute card:
 *   - top: 40px (chrome 32 + inset 8), left: 8, bottom: 8, width: 320
 *   - white background with subtle border + shadow (df-shadow-card)
 *   - rounded 8px, 1px border at hsl(var(--bg-300))
 *   - Newsreader serif "Veronum" header at top with dark-mode toggle
 *   - "Join shared session" link icon row
 *   - Project list — folder icon + name + chevron, expandable into
 *     session children with the small ○ session circle leading slot
 *   - Avatar/Settings affordance pinned at the bottom
 */

const PROJECTS: Array<{
  name: string;
  sessions: string[];
}> = [
  {
    name: "T3 Tools",
    sessions: [
      "Add unit tests for multi-agent orchestrator",
      "Review current project codebase and status",
      "Refactor session middleware",
      "General coding session",
    ],
  },
  {
    name: "Katya App",
    sessions: ["Review app screenshots and plan build"],
  },
  {
    name: "landing page",
    sessions: ["Build landing page with parallel agent team"],
  },
  {
    name: "Tools AI Terminal",
    sessions: ["Study Cursor and Warp product websites", "Research Cursor AI features"],
  },
  {
    name: "vscode-custom",
    sessions: ["Deep dive into AI agents and data sources"],
  },
];

export function DemoSidebar({
  activeProjectName,
  activeSessionTitle,
}: {
  activeProjectName: string;
  activeSessionTitle: string;
}) {
  return (
    <aside
      className="absolute z-20 flex flex-col bg-white rounded-lg overflow-hidden"
      style={{
        top: 40,
        left: 8,
        bottom: 8,
        width: 320,
        boxShadow:
          "0 0 0 1px rgba(20,20,19,0.06), 0 4px 24px rgba(20,20,19,0.06)",
      }}
    >
      {/* Header — "Veronum" serif + dark-mode toggle */}
      <div className="flex items-center px-3 pt-3 pb-2 gap-2">
        <span
          className="font-serif text-[17px] font-medium text-ink ml-1"
          style={{ letterSpacing: "-0.02em" }}
        >
          Veronum
        </span>
        <button
          aria-label="Dark mode"
          className="ml-auto w-[22px] h-[22px] rounded-md flex items-center justify-center text-ink-faded hover:bg-ink/[0.04]"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          >
            <path d="M13 9A6 6 0 0 1 7 3a.6.6 0 0 0-.9-.55A6.5 6.5 0 1 0 13.55 9.9.6.6 0 0 0 13 9Z" />
          </svg>
        </button>
      </div>

      {/* Body — scrollable nav */}
      <div className="flex-1 min-h-0 px-1 py-1 overflow-hidden">
        {/* Join shared session — top quick action */}
        <div className="flex items-center gap-2.5 px-2.5 h-[26px] rounded-md text-[13px] text-ink/80 hover:bg-ink/[0.04] cursor-default mb-1">
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-ink-faded"
          >
            <path d="M6.5 9.5a3 3 0 0 0 4.243 0l2.121-2.121a3 3 0 1 0-4.243-4.243L7.55 4.207" />
            <path d="M9.5 6.5a3 3 0 0 0-4.243 0L3.136 8.62a3 3 0 1 0 4.243 4.243l1.071-1.072" />
          </svg>
          <span>Join shared session</span>
        </div>

        {/* Section label */}
        <div className="px-2 pt-2 pb-0.5">
          <span className="font-mono uppercase text-[10.5px] tracking-[0.06em] text-ink-faded">
            Projects
          </span>
        </div>

        {/* Project list — top one expanded with sessions visible */}
        <ul className="space-y-0.5">
          {PROJECTS.map((p, idx) => {
            const isActive = p.name === activeProjectName;
            const expanded = isActive;
            return (
              <li key={p.name}>
                <div
                  className={`flex items-center gap-2 h-[26px] px-2 rounded-md text-[13px] cursor-default ${
                    expanded
                      ? "text-ink"
                      : "text-ink/85 hover:bg-ink/[0.04]"
                  }`}
                >
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`text-ink-faded transition-transform ${
                      expanded ? "rotate-90" : ""
                    }`}
                  >
                    <path d="M6 4l4 4-4 4" />
                  </svg>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    className="text-ink-faded flex-shrink-0"
                  >
                    <path d="M2 4.5C2 3.948 2.448 3.5 3 3.5h3l1.5 1.5H13c.552 0 1 .448 1 1V12c0 .552-.448 1-1 1H3c-.552 0-1-.448-1-1V4.5Z" />
                  </svg>
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="font-mono text-[10.5px] text-ink-faded tabular-nums">
                    {p.sessions.length}
                  </span>
                </div>
                {expanded && (
                  <ul className="ml-[26px] mt-0.5 space-y-0">
                    {p.sessions.map((s) => {
                      const sessionActive = s === activeSessionTitle;
                      return (
                        <li
                          key={s}
                          className={`flex items-center gap-2 h-[26px] px-2 rounded-md text-[12.5px] cursor-default ${
                            sessionActive
                              ? "bg-ivory text-ink"
                              : "text-ink/75 hover:bg-ink/[0.03]"
                          }`}
                        >
                          <span
                            className={`w-[6px] h-[6px] rounded-full border-[1.5px] flex-shrink-0 ${
                              sessionActive
                                ? "bg-ink border-ink"
                                : "border-ink-faded/60"
                            }`}
                          />
                          <span className="flex-1 truncate">{s}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {idx === 0 && (
                  <div
                    className="my-1.5 mx-2 border-t border-ink/[0.06]"
                    aria-hidden
                  />
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Footer — user avatar + Settings entrypoint */}
      <div className="border-t border-ink/[0.06] px-2 py-2 flex items-center gap-2">
        <span
          className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-semibold text-white"
          style={{ background: "#7d7d76" }}
        >
          D
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] text-ink leading-tight truncate">
            Dylan
          </div>
          <div className="text-[10.5px] text-ink-faded leading-tight truncate">
            Max
          </div>
        </div>
        <span className="font-mono text-[10px] text-ink-faded">⌃,</span>
      </div>
    </aside>
  );
}
