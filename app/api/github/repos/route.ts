/**
 * POST /api/github/repos
 *
 * Lists the authenticated user's GitHub repositories. Takes a GitHub
 * access token (obtained client-side via supabase.auth.signInWithOAuth
 * with the 'repo' scope) and proxies a /user/repos call. The proxy is
 * required because GitHub rejects CORS requests with custom auth
 * headers from arbitrary origins — they want server-side calls.
 *
 * Request body: { accessToken: string, page?: number, perPage?: number }
 * Response:     { repos: RepoSummary[], hasMore: boolean }
 *
 * We sort by `updated` so the user's active work surfaces first, and
 * cap at 100 per page (GitHub's max). Repos return owner/repo plus
 * whether they're private and what the default branch is — both used
 * downstream by /api/github/ingest.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PER_PAGE_MAX = 100;

type RepoSummary = {
  full_name: string;          // "owner/repo" — the canonical id
  name: string;               // "repo" only — for display
  owner: string;              // "owner" only — for display
  private: boolean;
  default_branch: string;
  updated_at: string;         // ISO timestamp, useful for sub-ordering
  description: string | null;
};

export async function POST(req: Request) {
  let body: { accessToken?: string; page?: number; perPage?: number };
  try { body = await req.json(); }
  catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }

  const token = typeof body.accessToken === "string" ? body.accessToken : "";
  if (!token) {
    return Response.json({
      error: "missing_token",
      detail: "Provide accessToken — obtain it client-side from supabase.auth.signInWithOAuth({provider:'github'}).provider_token.",
    }, { status: 400 });
  }

  const page = Math.max(1, Math.min(100, Math.floor(Number(body.page) || 1)));
  const perPage = Math.max(1, Math.min(PER_PAGE_MAX, Math.floor(Number(body.perPage) || PER_PAGE_MAX)));

  const url = `https://api.github.com/user/repos?page=${page}&per_page=${perPage}&sort=updated&affiliation=owner,collaborator,organization_member`;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2022-11-28",
      },
    });
  } catch (e) {
    console.error("[/api/github/repos] network failure:", e instanceof Error ? e.message : String(e));
    return Response.json({
      error: "upstream_unreachable",
      detail: "Could not reach GitHub. Check your network and try again.",
    }, { status: 502 });
  }

  if (!upstream.ok) {
    const detail = upstream.status === 401
      ? "Access token rejected by GitHub. Sign in with GitHub again — your session may have expired or the OAuth scope is missing 'repo'."
      : upstream.status === 403
      ? "GitHub denied the request. The token may lack the 'repo' scope, or you've hit a rate limit."
      : `GitHub returned HTTP ${upstream.status}.`;
    return Response.json({ error: "github_error", status: upstream.status, detail }, { status: 502 });
  }

  const raw = (await upstream.json().catch(() => [])) as Array<{
    full_name: string;
    name: string;
    owner: { login: string };
    private: boolean;
    default_branch: string;
    updated_at: string;
    description: string | null;
  }>;

  const repos: RepoSummary[] = raw.map((r) => ({
    full_name: r.full_name,
    name: r.name,
    owner: r.owner?.login || "",
    private: !!r.private,
    default_branch: r.default_branch || "main",
    updated_at: r.updated_at,
    description: r.description,
  }));

  // GitHub doesn't return a total count; we infer "has more" from the
  // returned page size. If we got a full page, there's likely another.
  const hasMore = repos.length === perPage;

  return Response.json({ repos, hasMore, page, perPage });
}
