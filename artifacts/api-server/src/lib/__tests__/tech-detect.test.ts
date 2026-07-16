import { describe, it, expect } from "vitest";
import type { IngestedRepo } from "@workspace/db";
import { detectTechStack } from "../tech-detect";

function repoOf(
  fileTree: string[],
  files: { path: string; content: string }[] = [],
): IngestedRepo {
  return {
    owner: "test",
    repo: "test",
    defaultBranch: "main",
    fetchedAt: new Date(0).toISOString(),
    fileTree,
    files: files.map((f) => ({ ...f, size: f.content.length })),
  };
}

describe("detectTechStack", () => {
  it("detects Vite + React + Drizzle + Replit Auth + pnpm", () => {
    const repo = repoOf(
      [
        "package.json",
        "pnpm-lock.yaml",
        "vite.config.ts",
        "drizzle.config.ts",
        "server/routes/users.ts",
      ],
      [
        {
          path: "package.json",
          content: JSON.stringify({
            dependencies: {
              react: "^18",
              vite: "^5",
              "drizzle-orm": "^0.30",
              "openid-client": "^6",
              express: "^5",
            },
          }),
        },
      ],
    );
    const r = detectTechStack(repo);
    expect(r.framework).toBe("Vite + React");
    expect(r.packageManager).toBe("pnpm");
    expect(r.dbLayer).toBe("Drizzle");
    expect(r.authLayer).toBe("Replit Auth");
    expect(r.routesFolder).toBe("server/routes");
  });

  it("detects Next.js + Prisma + NextAuth + npm", () => {
    const repo = repoOf(
      [
        "package.json",
        "package-lock.json",
        "next.config.js",
        "prisma/schema.prisma",
        "pages/api/users.ts",
      ],
      [
        {
          path: "package.json",
          content: JSON.stringify({
            dependencies: {
              next: "^14",
              "@prisma/client": "^5",
              "next-auth": "^4",
            },
          }),
        },
      ],
    );
    const r = detectTechStack(repo);
    expect(r.framework).toBe("Next.js");
    expect(r.packageManager).toBe("npm");
    expect(r.dbLayer).toBe("Prisma");
    expect(r.authLayer).toBe("Auth.js / NextAuth");
    expect(r.routesFolder).toBe("pages/api");
  });

  it("collects deployment clues", () => {
    const repo = repoOf([
      "package.json",
      "Dockerfile",
      "vercel.json",
      ".replit",
      ".env.example",
    ]);
    const r = detectTechStack(repo);
    expect(r.deploymentClues).toEqual(
      expect.arrayContaining(["Dockerfile", "Vercel", "Replit", ".env.example"]),
    );
  });

  it("returns nulls for an empty repo", () => {
    const r = detectTechStack(repoOf([]));
    expect(r.framework).toBeNull();
    expect(r.packageManager).toBeNull();
    expect(r.dbLayer).toBeNull();
    expect(r.authLayer).toBeNull();
    expect(r.routesFolder).toBeNull();
    expect(r.deploymentClues).toEqual([]);
  });
});
