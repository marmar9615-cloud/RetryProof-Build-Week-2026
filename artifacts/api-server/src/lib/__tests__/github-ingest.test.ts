import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GitHubRateLimitError,
  ingestGitHubRepo,
  parseGitHubUrl,
} from "../github-ingest";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

describe("parseGitHubUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses a canonical https URL", () => {
    expect(parseGitHubUrl("https://github.com/replit/neverguess")).toEqual({
      owner: "replit",
      repo: "neverguess",
    });
  });

  it("strips a trailing .git", () => {
    expect(
      parseGitHubUrl("https://github.com/owner/repo.git"),
    ).toEqual({ owner: "owner", repo: "repo" });
  });

  it("handles trailing slash and extra path segments", () => {
    expect(
      parseGitHubUrl("https://github.com/owner/repo/tree/main/src"),
    ).toEqual({ owner: "owner", repo: "repo" });
  });

  it("accepts the www subdomain", () => {
    expect(parseGitHubUrl("https://www.github.com/a/b")).toEqual({
      owner: "a",
      repo: "b",
    });
  });

  it("rejects non-github hosts", () => {
    expect(parseGitHubUrl("https://gitlab.com/a/b")).toBeNull();
    expect(parseGitHubUrl("https://evil.example.com/a/b")).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(parseGitHubUrl("not a url")).toBeNull();
    expect(parseGitHubUrl("https://github.com/onlyowner")).toBeNull();
    expect(parseGitHubUrl("")).toBeNull();
  });

  it("surfaces anonymous public-probe rate limits as retryable GitHub rate limits", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("rate limited", {
          status: 403,
          headers: { "x-ratelimit-remaining": "0" },
        }),
      ),
    );

    await expect(
      ingestGitHubRepo("https://github.com/owner/repo"),
    ).rejects.toBeInstanceOf(GitHubRateLimitError);
  });

  it("uses a per-request token to rescue an anonymous public-probe rate limit", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("rate limited", {
          status: 403,
          headers: { "x-ratelimit-remaining": "0" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ private: false, default_branch: "main" }),
      )
      .mockResolvedValueOnce(jsonResponse({ tree: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      ingestGitHubRepo("https://github.com/owner/repo", "ghp_user_token"),
    ).resolves.toMatchObject({
      owner: "owner",
      repo: "repo",
      defaultBranch: "main",
      fileTree: [],
      files: [],
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.github.com/repos/owner/repo",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer ghp_user_token",
        }),
      }),
    );
  });
});
