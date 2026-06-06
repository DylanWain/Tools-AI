"use client";

/**
 * FileIcon — VS Code's seti icon theme rendered as a webfont glyph.
 * Port of veronum-overlay/renderer/src/components/FileIcon.tsx.
 *
 * The font lives at /public/seti/seti.woff (37 KB, ~387 glyphs) and
 * the theme JSON maps file names / extensions / language IDs to a
 * Private-Use codepoint + per-icon color. Globals.css registers the
 * `seti` font family and the `.seti-icon` class.
 *
 * Folder rendering is the caller's job — the seti theme intentionally
 * has no folder glyphs (VS Code uses a generic chevron + folder icon).
 */

import { useEffect, useState } from "react";
import {
  fetchSetiTheme,
  resolveSetiIcon,
  type ResolvedIcon,
} from "@/lib/compare/setiIcons";

const SIZE_MAP = { xs: 14, sm: 16, md: 20 } as const;

export function FileIcon({
  filePath,
  size = 16,
}: {
  filePath: string;
  size?: number | keyof typeof SIZE_MAP;
}) {
  const px = typeof size === "number" ? size : SIZE_MAP[size] ?? 16;
  const [icon, setIcon] = useState<ResolvedIcon | null>(() =>
    resolveSetiIcon(filePath),
  );

  // Seti theme is async-loaded once at startup. If unresolved on first
  // render (theme still loading), wait for fetch then resolve.
  useEffect(() => {
    if (icon) return;
    let cancelled = false;
    fetchSetiTheme().then(() => {
      if (cancelled) return;
      setIcon(resolveSetiIcon(filePath));
    });
    return () => { cancelled = true; };
    // Re-resolve when filePath changes too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath]);

  return (
    <span
      className="seti-icon flex-shrink-0 inline-flex items-center justify-center"
      style={{
        fontSize: px,
        width: px,
        height: px,
        lineHeight: 1,
        color: icon?.color || "rgba(255,255,255,0.55)",
      }}
      aria-hidden
    >
      {icon?.char ?? ""}
    </span>
  );
}
