import type { IngestedRepo } from "@workspace/db";

export type DetectionResult = {
  framework: string | null;
  packageManager: string | null;
  dbLayer: string | null;
  authLayer: string | null;
  routesFolder: string | null;
  deploymentClues: string[];
};

const ROUTE_CANDIDATES = [
  "app/api",
  "app/routes",
  "src/app/api",
  "src/app/routes",
  "src/routes",
  "src/pages/api",
  "pages/api",
  "server/routes",
  "src/server/routes",
  "api/routes",
  "routes",
  "api",
];

function detectRoutesFolder(tree: Set<string>): string | null {
  const dirs = new Set<string>();
  for (const path of tree) {
    const parts = path.split("/");
    for (let i = 1; i <= parts.length - 1; i++) {
      dirs.add(parts.slice(0, i).join("/"));
    }
  }
  for (const candidate of ROUTE_CANDIDATES) {
    if (dirs.has(candidate)) return candidate;
  }
  return null;
}

function fileByPath(repo: IngestedRepo, path: string) {
  return repo.files.find((f) => f.path === path);
}

function readJson(text: string | undefined): Record<string, unknown> | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function depsOf(pkg: Record<string, unknown> | null): Record<string, string> {
  if (!pkg) return {};
  const deps = (pkg.dependencies ?? {}) as Record<string, string>;
  const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
  return { ...deps, ...devDeps };
}

function detectPackageManager(repo: IngestedRepo, pkg: Record<string, unknown> | null): string | null {
  const tree = new Set(repo.fileTree);
  if (typeof pkg?.packageManager === "string") {
    const pm = pkg.packageManager.split("@")[0];
    if (pm) return pm;
  }
  if (tree.has("pnpm-lock.yaml") || tree.has("pnpm-workspace.yaml")) return "pnpm";
  if (tree.has("yarn.lock")) return "yarn";
  if (tree.has("bun.lockb") || tree.has("bun.lock")) return "bun";
  if (tree.has("package-lock.json")) return "npm";
  return null;
}

function detectFramework(deps: Record<string, string>, tree: Set<string>): string | null {
  if (deps["next"]) return "Next.js";
  if (deps["@remix-run/react"] || deps["@remix-run/node"]) return "Remix";
  if (deps["nuxt"]) return "Nuxt";
  if (deps["@sveltejs/kit"]) return "SvelteKit";
  if (deps["expo"]) return "Expo";
  if (deps["vite"] || tree.has("vite.config.ts") || tree.has("vite.config.js")) {
    if (deps["react"]) return "Vite + React";
    if (deps["vue"]) return "Vite + Vue";
    if (deps["svelte"]) return "Vite + Svelte";
    return "Vite";
  }
  if (deps["express"]) return "Express";
  if (deps["fastify"]) return "Fastify";
  if (deps["@nestjs/core"]) return "NestJS";
  if (deps["react"]) return "React";
  return null;
}

function detectDbLayer(deps: Record<string, string>, tree: Set<string>): string | null {
  if (deps["drizzle-orm"] || tree.has("drizzle.config.ts") || tree.has("drizzle.config.js")) {
    return "Drizzle";
  }
  if (deps["@prisma/client"] || deps["prisma"] || tree.has("prisma/schema.prisma")) return "Prisma";
  if (deps["mongoose"]) return "Mongoose";
  if (deps["typeorm"]) return "TypeORM";
  if (deps["sequelize"]) return "Sequelize";
  if (deps["kysely"]) return "Kysely";
  if (deps["pg"] || deps["postgres"]) return "raw pg";
  return null;
}

function detectAuthLayer(deps: Record<string, string>, tree: Set<string>, files: string): string | null {
  if (deps["@clerk/clerk-react"] || deps["@clerk/nextjs"] || deps["@clerk/clerk-sdk-node"]) return "Clerk";
  if (deps["@auth/core"] || deps["next-auth"]) return "Auth.js / NextAuth";
  if (deps["better-auth"]) return "Better Auth";
  if (deps["lucia"]) return "Lucia";
  if (deps["passport"]) return "Passport";
  if (deps["@supabase/supabase-js"] && /auth/i.test(files)) return "Supabase Auth";
  if (deps["openid-client"] || /replit-auth|replitAuth|REPL_ID/i.test(files)) {
    return "Replit Auth";
  }
  if (deps["firebase"] || deps["firebase-admin"]) return "Firebase Auth";
  return null;
}

function detectDeploymentClues(tree: Set<string>): string[] {
  const clues: string[] = [];
  if (tree.has("Dockerfile")) clues.push("Dockerfile");
  if (tree.has("docker-compose.yml") || tree.has("docker-compose.yaml")) clues.push("docker-compose");
  if (tree.has("vercel.json")) clues.push("Vercel");
  if (tree.has("netlify.toml")) clues.push("Netlify");
  if (tree.has("fly.toml")) clues.push("Fly.io");
  if (tree.has("railway.json") || tree.has("railway.toml")) clues.push("Railway");
  if (tree.has("render.yaml")) clues.push("Render");
  if (tree.has(".replit") || tree.has("replit.nix")) clues.push("Replit");
  if (tree.has("Procfile")) clues.push("Heroku/Procfile");
  if (tree.has(".env.example")) clues.push(".env.example");
  return clues;
}

export function detectTechStack(repo: IngestedRepo): DetectionResult {
  const tree = new Set(repo.fileTree);
  const pkg = readJson(fileByPath(repo, "package.json")?.content);
  const deps = depsOf(pkg);
  const filesBlob = repo.files.map((f) => `${f.path}\n${f.content ?? ""}`).join("\n");

  return {
    framework: detectFramework(deps, tree),
    packageManager: detectPackageManager(repo, pkg),
    dbLayer: detectDbLayer(deps, tree),
    authLayer: detectAuthLayer(deps, tree, filesBlob),
    routesFolder: detectRoutesFolder(tree),
    deploymentClues: detectDeploymentClues(tree),
  };
}
