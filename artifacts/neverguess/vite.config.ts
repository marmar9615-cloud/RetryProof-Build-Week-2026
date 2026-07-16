import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { metaInjectPlugin } from "./meta-inject-plugin";

const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : undefined;

if (rawPort && (Number.isNaN(port) || (port ?? 0) <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";
const apiProxyTarget = process.env.API_PROXY_TARGET?.trim() || "http://127.0.0.1:8080";

if (!/^https?:\/\//.test(apiProxyTarget)) {
  throw new Error("API_PROXY_TARGET must be an absolute HTTP(S) URL.");
}

export default defineConfig({
  base: basePath,
  plugins: [
    metaInjectPlugin(),
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    // Vite's default <link rel="modulepreload"> emits hints for every
    // dynamically-imported chunk so the browser can fetch them in parallel
    // with the main bundle. That's normally a free perf win — but Mermaid
    // is a 2.7 MB chunk that 99% of marketing-site visitors will never
    // hit. Strip its preload hint so only consumers that actually mount
    // <MermaidGraph> pay the bandwidth. Wardley gets the same treatment.
    // Also suppress preload hints for app-only vendor chunks (query, auth,
    // radix, icons) so marketing visitors don't pay for code they never use.
    modulePreload: {
      resolveDependencies(_filename, deps) {
        return deps.filter(
          (dep) =>
            !dep.includes("mermaid") &&
            !dep.includes("wardley") &&
            !dep.includes("vendor-query") &&
            !dep.includes("vendor-auth") &&
            !dep.includes("vendor-radix") &&
            !dep.includes("vendor-icons"),
        );
      },
    },
    rollupOptions: {
      output: {
        // Explicit vendor splitting keeps shared heavy libraries out of the
        // main entry chunk. Without this, Rollup hoists commonly-shared deps
        // (react-dom, tanstack/query, radix primitives, lucide icons) into the
        // entry because they are referenced across many lazy chunks. Naming
        // them explicitly gives browsers a stable, long-lived cache key too.
        manualChunks(id) {
          // React runtime — always needed, small, stable cache target.
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/scheduler/")
          ) {
            return "vendor-react";
          }
          // TanStack Query — only loaded for authenticated app routes.
          if (id.includes("@tanstack/react-query")) {
            return "vendor-query";
          }
          // Workspace auth + API client — loaded alongside app-route-shell
          // and marketing-layout, but not needed in the bare entry.
          if (
            id.includes("replit-auth-web") ||
            id.includes("api-client-react")
          ) {
            return "vendor-auth";
          }
          // Radix UI primitives — used throughout the UI layer, large in
          // aggregate. Splitting keeps them out of the entry entirely.
          if (id.includes("@radix-ui/")) {
            return "vendor-radix";
          }
          // Lucide icon library — tree-shaken per-icon but the runtime module
          // is shared across most lazy chunks, so hoist it explicitly.
          if (id.includes("lucide-react")) {
            return "vendor-icons";
          }
        },
      },
    },
  },
  server: {
    ...(port ? { port, strictPort: true } : {}),
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: false,
      },
    },
    fs: {
      strict: true,
    },
  },
  preview: {
    ...(port ? { port } : {}),
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
