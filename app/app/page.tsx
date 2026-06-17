/**
 * GET /app — Veronum Projects workspace.
 *
 * The desktop app loads this route. New Projects-first interface:
 * - Left sidebar: list of projects, create new
 * - Main area: project workspace with chat tabs
 * - Bottom: parallel composer (send to all chats at once)
 *
 * Uses actual MCPs (Claude Code, VSCode, Cursor, Codex) instead of API calls.
 */

import type { Metadata } from "next";
import { VeronumWorkspace } from "@/components/projects/VeronumWorkspace";

export const metadata: Metadata = {
  title: "Veronum — Projects",
  description: "Multi-project, multi-LLM workspace with MCPs.",
};

export const dynamic = "force-dynamic";

export default function AppPage() {
  return <VeronumWorkspace />;
}
