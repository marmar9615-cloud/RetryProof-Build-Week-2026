import type { IngestedRepo } from "@workspace/db";

export const DEMO_REPO: IngestedRepo = {
  owner: "demo",
  repo: "sample-fullstack-app",
  defaultBranch: "main",
  fetchedAt: new Date(0).toISOString(),
  fileTree: [
    "package.json",
    "pnpm-lock.yaml",
    "README.md",
    "vite.config.ts",
    "drizzle.config.ts",
    "Dockerfile",
    ".env.example",
    "server/index.ts",
    "server/routes",
    "server/routes/users.ts",
    "server/routes/posts.ts",
    "server/db/schema.ts",
    "server/auth/replit.ts",
    "client/src/App.tsx",
    "client/src/pages/dashboard.tsx",
    "client/src/pages/login.tsx",
  ],
  files: [
    {
      path: "package.json",
      size: 512,
      content: JSON.stringify(
        {
          name: "sample-fullstack-app",
          private: true,
          packageManager: "pnpm@9.0.0",
          scripts: { dev: "vite", build: "vite build", start: "node server" },
          dependencies: {
            react: "^18.3.0",
            "react-dom": "^18.3.0",
            express: "^4.19.0",
            "drizzle-orm": "^0.30.0",
            "openid-client": "^5.6.0",
            wouter: "^3.0.0",
          },
          devDependencies: {
            vite: "^5.2.0",
            typescript: "^5.4.0",
            "drizzle-kit": "^0.21.0",
          },
        },
        null,
        2,
      ),
    },
    {
      path: "README.md",
      size: 180,
      content:
        "# Sample Fullstack App\n\nDemo project: React + Vite client, Express server, Drizzle ORM on Postgres, Replit Auth via openid-client.\n",
    },
    {
      path: "vite.config.ts",
      size: 120,
      content:
        "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()] });\n",
    },
    {
      path: "drizzle.config.ts",
      size: 90,
      content:
        "import { defineConfig } from 'drizzle-kit';\nexport default defineConfig({ schema: './server/db/schema.ts', dialect: 'postgresql' });\n",
    },
    {
      path: "Dockerfile",
      size: 60,
      content: "FROM node:20-alpine\nWORKDIR /app\nCOPY . .\nRUN npm ci\nCMD [\"npm\",\"start\"]\n",
    },
  ],
};
