/**
 * Task decomposer — the "Auto" planner.
 *
 * Takes ONE goal and asks Claude to split it into 2–5 INDEPENDENT,
 * parallel-safe sub-tasks, each assigned to the best model for that
 * kind of work. The client renders the result as confirmable agent
 * rows, then runs them simultaneously via the existing multi-agent
 * workflow (useCompareStream.startWorkflow → /api/compare).
 *
 * POST { goal: string } → { agents: [{ title, task, modelId }] }
 */

import { MODELS, providerKey } from "@/lib/compare/models";

export const runtime = "nodejs";

// The planner itself runs on a fast, reliable Claude.
const PLANNER_MODEL = "claude-sonnet-4-5";

// The menu the planner picks from. Perplexity is web-search, not a
// coding agent, so it's left out of the decomposition lineup.
const MODEL_MENU = MODELS.filter((m) => m.provider !== "perplexity")
  .map((m) => `- ${m.id} (${m.label}): ${m.blurb}`)
  .join("\n");

const VALID_IDS = new Set(MODELS.map((m) => m.id));
const FALLBACK_MODEL = "claude-sonnet-4-5";

const SYSTEM = `You are a planner for a parallel multi-agent coding tool. Given ONE goal, break it into 2–5 INDEPENDENT sub-tasks that can run AT THE SAME TIME — no shared state, no editing the same files, and no task depending on another's output. For each sub-task pick the single best model from the menu (deep reasoning/architecture → a top Claude or GPT; fast/mechanical → a mini or haiku; current-events/web → leave to the user).

Return ONLY valid JSON, no prose, no code fences, in EXACTLY this shape:
{"agents":[{"title":"short label","task":"a complete, self-contained instruction the agent can act on with no other context","modelId":"<exact id from the menu>"}]}

Rules:
- 2 to 5 agents; fewer is better for a small goal.
- Every task must be independent and parallel-safe.
- modelId MUST be one of the menu ids, copied exactly.
- title under 6 words.`;

type ProposedAgent = { title: string; task: string; modelId: string };

function parseAgents(text: string): ProposedAgent[] | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const agents = (obj as { agents?: unknown })?.agents;
  if (!Array.isArray(agents)) return null;
  const out: ProposedAgent[] = [];
  for (const a of agents.slice(0, 5)) {
    const task = typeof (a as { task?: unknown })?.task === "string" ? (a as { task: string }).task.trim() : "";
    if (!task) continue;
    const rawId = (a as { modelId?: unknown })?.modelId;
    const modelId = typeof rawId === "string" && VALID_IDS.has(rawId) ? rawId : FALLBACK_MODEL;
    const rawTitle = (a as { title?: unknown })?.title;
    const title = typeof rawTitle === "string" && rawTitle.trim() ? rawTitle.trim() : task.slice(0, 40);
    out.push({ title, task, modelId });
  }
  return out.length ? out : null;
}

export async function POST(req: Request) {
  let goal = "";
  try {
    const body = (await req.json()) as { goal?: unknown };
    goal = typeof body?.goal === "string" ? body.goal.trim() : "";
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (!goal) return Response.json({ error: "empty_goal" }, { status: 400 });

  const key = providerKey("anthropic");
  if (!key) return Response.json({ error: "no_anthropic_key" }, { status: 500 });

  let resp: Response;
  try {
    resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: PLANNER_MODEL,
        max_tokens: 1500,
        system: SYSTEM,
        messages: [{ role: "user", content: `Available models:\n${MODEL_MENU}\n\nGoal:\n${goal}` }],
      }),
    });
  } catch (e) {
    return Response.json({ error: "network", detail: String(e) }, { status: 502 });
  }
  if (!resp.ok) {
    const detail = (await resp.text()).slice(0, 300);
    return Response.json({ error: "anthropic", status: resp.status, detail }, { status: 502 });
  }

  const data = (await resp.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = (data.content ?? [])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("");

  const agents = parseAgents(text);
  if (!agents) return Response.json({ error: "parse", raw: text.slice(0, 400) }, { status: 502 });
  return Response.json({ agents });
}
