import Link from "next/link";

/**
 * Hero — banner-sized claim that matches the user's product positioning.
 *
 * Layout follows anthropic.com's `home_hero_grid`: 7-col display H1,
 * 5-col supporting paragraph, no buttons (CTAs live in Nav + Pricing).
 * Display size bumped to display-xxl so "code with anyone, on any
 * platform" reads as a banner statement.
 */
export function Hero() {
  return (
    <header
      id="main"
      className="u-container pt-12 sm:pt-16 lg:pt-24 pb-10 lg:pb-16"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-end">
        <div className="lg:col-span-8">
          <h1
            className="font-serif font-medium text-ink leading-[1.02]"
            style={{ fontSize: "var(--display-xxl)" }}
          >
            Code with anyone, on{" "}
            <Link href="#platforms">any platform</Link>.
          </h1>
        </div>

        <div className="lg:col-span-4">
          <p
            className="text-ink leading-[1.45] max-w-[40ch]"
            style={{ fontSize: "var(--paragraph-l)" }}
          >
            Veronum brings real-time shared Claude Code sessions, ten parallel
            agents, undo/redo, version history, and per-project group chat to{" "}
            <Link href="#platforms">Claude</Link>,{" "}
            <Link href="#platforms">Cursor</Link>,{" "}
            <Link href="#platforms">Warp</Link>,{" "}
            <Link href="#platforms">VS Code</Link>, and{" "}
            <Link href="#platforms">Zed</Link>.
          </p>
        </div>
      </div>
    </header>
  );
}
