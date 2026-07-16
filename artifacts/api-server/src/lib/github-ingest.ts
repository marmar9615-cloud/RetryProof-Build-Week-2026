import type { IngestedFile, IngestedRepo } from "@workspace/db";

const KEY_FILES = [
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "README.md",
  "vite.config.ts",
  "vite.config.js",
  "next.config.ts",
  "next.config.js",
  "next.config.mjs",
  "drizzle.config.ts",
  "drizzle.config.js",
  "prisma/schema.prisma",
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  ".env.example",
  "vercel.json",
  "netlify.toml",
  "fly.toml",
  "railway.json",
  "railway.toml",
  "render.yaml",
  ".replit",
  "replit.nix",
  "Procfile",
  "tsconfig.json",
  "pnpm-workspace.yaml",
];

const MAX_FILE_BYTES = 64 * 1024;
const GITHUB_API = "https://api.github.com";

export class GitHubIngestError extends Error {
  readonly reason?: unknown;
  constructor(message: string, reason?: unknown) {
    super(message);
    this.name = "GitHubIngestError";
    this.reason = reason;
  }
}

export class GitHubRateLimitError extends GitHubIngestError {
  constructor(message = "GitHub API rate-limited") {
    super(message);
    this.name = "GitHubRateLimitError";
  }
}

export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)github\.com$/i.test(u.hostname)) return null;
    const parts = u.pathname.replace(/^\/+|\/+$/g, "").split("/");
    if (parts.length < 2) return null;
    const [owner, repoRaw] = parts;
    if (!owner || !repoRaw) return null;
    const repo = repoRaw.replace(/\.git$/i, "");
    return { owner, repo };
  } catch {
    return null;
  }
}

const BASE_HEADERS: Record<string, string> = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "neverguess-ingest",
};

function authHeaders(userToken?: string | null): Record<string, string> {
  const h: Record<string, string> = { ...BASE_HEADERS };
  // Per-request user-supplied token takes precedence; otherwise fall back to
  // the optional server-wide GITHUB_TOKEN; otherwise call unauthenticated
  // (60 req/hr per IP — fine for low-traffic public usage of public repos).
  const token = (userToken ?? "").trim() || process.env.GITHUB_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

function isRateLimitResponse(res: Response): boolean {
  if (res.status !== 403 && res.status !== 429) return false;
  return res.headers.get("x-ratelimit-remaining") === "0";
}

async function ghFetch(url: string, userToken?: string | null): Promise<Response> {
  const res = await fetch(url, { headers: authHeaders(userToken) });
  if (isRateLimitResponse(res)) throw new GitHubRateLimitError();
  return res;
}

async function readPublicRepoDefaultBranch(res: Response): Promise<string> {
  if (!res.ok) {
    throw new GitHubIngestError("Repository is not publicly accessible.");
  }

  const meta = (await res.json()) as { private?: boolean; default_branch?: string };

  if (meta.private === true) {
    throw new GitHubIngestError("Repository is not publicly accessible.");
  }

  return meta.default_branch ?? "main";
}

/**
 * Verify the repository is publicly accessible without using the service token.
 *
 * We intentionally start without the Authorization header so that the service
 * token is never sent to an arbitrary user-supplied repository. If GitHub's
 * anonymous quota is exhausted and the user provided their own token for this
 * single audit, we retry the same public metadata check with that token and
 * still reject repos reported as private.
 *
 * An unauthenticated request will return 404 for both non-existent repos AND
 * private repos, so we can't distinguish between them — which is the correct
 * behaviour: we return the same generic error in both cases to avoid
 * information leakage.
 *
 * Returns the default_branch from the public API response on success.
 */
async function assertPublicRepo(
  owner: string,
  repo: string,
  userToken?: string | null,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
      headers: BASE_HEADERS,
    });
  } catch (err) {
    throw new GitHubIngestError(
      "Repository is not publicly accessible.",
      err,
    );
  }

  if (!res.ok && isRateLimitResponse(res)) {
    if (!userToken) throw new GitHubRateLimitError();
    const authedRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
      headers: authHeaders(userToken),
    });
    if (isRateLimitResponse(authedRes)) throw new GitHubRateLimitError();
    return readPublicRepoDefaultBranch(authedRes);
  }

  return readPublicRepoDefaultBranch(res);
}

export async function ingestGitHubRepo(
  githubUrl: string,
  userToken?: string | null,
): Promise<IngestedRepo> {
  const parsed = parseGitHubUrl(githubUrl);
  if (!parsed) throw new GitHubIngestError(`Not a valid GitHub URL: ${githubUrl}`);
  const { owner, repo } = parsed;

  // Step 1: confirm the repository is publicly accessible. Start without any
  // token so the service token never probes user-supplied repos; if anonymous
  // GitHub quota is exhausted, a per-request user token can rescue the check.
  const defaultBranch = await assertPublicRepo(owner, repo, userToken);

  // Step 2: fetch the file tree, preferring the per-request user token if
  // they supplied one, else the server-wide GITHUB_TOKEN, else unauthenticated.
  const treeRes = await ghFetch(
    `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
    userToken,
  );
  if (!treeRes.ok) {
    throw new GitHubIngestError(`Tree lookup failed (${treeRes.status})`);
  }
  const treeBody = (await treeRes.json()) as {
    tree?: Array<{ path: string; type: string; size?: number }>;
  };
  const tree = treeBody.tree ?? [];
  const fileTree = tree.filter((t) => t.type === "blob").map((t) => t.path);

  const wanted = new Set(KEY_FILES);
  const toFetch = tree
    .filter((t) => t.type === "blob" && wanted.has(t.path))
    .slice(0, 30);

  const files: IngestedFile[] = [];
  for (const node of toFetch) {
    try {
      const rawRes = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${node.path}`,
        { headers: { "User-Agent": "neverguess-ingest" } },
      );
      if (!rawRes.ok) continue;
      const buf = Buffer.from(await rawRes.arrayBuffer());
      const truncated = buf.length > MAX_FILE_BYTES;
      const slice = truncated ? buf.subarray(0, MAX_FILE_BYTES) : buf;
      files.push({
        path: node.path,
        size: buf.length,
        truncated,
        content: slice.toString("utf8"),
      });
    } catch {
      // skip individual file failures
    }
  }

  return {
    owner,
    repo,
    defaultBranch,
    fileTree,
    files,
    fetchedAt: new Date().toISOString(),
  };
}
