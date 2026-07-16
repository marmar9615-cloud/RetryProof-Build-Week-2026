import type { DemoReportShape } from "./demo-report";

export type SampleSeed = {
  shareSlug: string;
  audit: {
    githubUrl: string | null;
    liveUrl: string | null;
    requestedChange: string;
    detectedFramework: string;
    detectedPackageManager: string;
    detectedDbLayer: string | null;
    detectedAuthLayer: string | null;
    routesFolder: string | null;
    deploymentClues: string[];
  };
  report: DemoReportShape;
};

export const SAMPLE_AUDITS: SampleSeed[] = [
  {
    shareSlug: "next-isr",
    audit: {
      githubUrl: "https://github.com/vercel/next.js",
      liveUrl: "https://next-isr-blog.example.com",
      requestedChange:
        "Switch the blog index from getServerSideProps to ISR with a 60s revalidate, while keeping the existing /api/preview route working.",
      detectedFramework: "Next.js (Pages Router)",
      detectedPackageManager: "pnpm",
      detectedDbLayer: "Prisma + Postgres",
      detectedAuthLayer: "next-auth",
      routesFolder: "pages/",
      deploymentClues: ["Vercel", "Edge functions"],
    },
    report: {
      architectureSummary:
        "A Next.js Pages Router blog backed by Prisma/Postgres and next-auth. The blog index currently uses getServerSideProps; switching to ISR with revalidate=60 affects render lifecycle and the preview-mode bypass.",
      mermaidGraph: `graph LR
  Visitor[Visitor]
  Edge[Vercel Edge]
  Next[Next.js Pages]
  DB[(Postgres - Prisma)]
  Visitor --> Edge --> Next
  Next -->|read posts| DB
  Next -->|/api/preview| Next`,
      riskyAssumptions: [
        {
          title: "Preview mode bypasses ISR cache",
          severity: "high",
          detail:
            "If preview cookies are not checked before serving the cached page, draft authors will see stale content.",
        },
        {
          title: "Stale-while-revalidate window covers spikes",
          severity: "medium",
          detail:
            "60s window may show outdated post lists during traffic spikes; verify acceptable.",
        },
        {
          title: "On-demand revalidation token still works",
          severity: "medium",
          detail:
            "Confirm the existing /api/revalidate handler validates the secret and triggers res.revalidate().",
        },
      ],
      acceptanceCriteria: [
        { title: "Blog index returns within 100ms cached", detail: "Measured via curl -o /dev/null -w %{time_total}." },
        { title: "Preview mode shows draft posts", detail: "Authenticated preview cookie bypasses cached HTML." },
        { title: "Revalidate API returns 200", detail: "POST /api/revalidate with the secret returns ok." },
      ],
      promptPack: {
        replit:
          "Convert pages/index.tsx from getServerSideProps to getStaticProps with revalidate=60. Keep preview mode by checking context.preview and short-circuiting cache.",
        cursor:
          "Refactor the blog index to ISR. Update next.config.js if needed. Preserve the /api/revalidate route.",
        copilot:
          "// Switch pages/index.tsx to ISR, revalidate every 60s, keep preview mode honored.",
        claudeCode:
          "Use Claude Code to convert the blog index to ISR. First inspect the existing data-loading path, preview-mode handling, and /api/revalidate route. Then plan the smallest change, implement getStaticProps with revalidate=60, and verify preview mode still bypasses cached output. Run the existing Next.js tests plus one focused regression for preview/revalidate behavior.",
        codex:
          "Implement ISR for the blog index as a scoped Codex task. Goal: replace getServerSideProps with getStaticProps using revalidate=60 while preserving preview mode and /api/revalidate. Search targets: pages/index.tsx, API preview/revalidate routes, and next.config.js. Verify with typecheck, existing tests, and a focused test that preview content is not served from the public cache.",
      },
      rolloutNotes:
        "Deploy in preview branch; verify cache headers and preview cookie bypass; promote to prod and watch p95 TTFB for 1h.\n\nRollback: revert to getServerSideProps in pages/index.tsx; no DB changes.",
      testPlan: {
        vitest: `import { describe, it, expect } from "vitest";\nimport { shouldBypassIsr } from "./isr";\n\ndescribe("shouldBypassIsr", () => {\n  it("bypasses when preview is true", () => {\n    expect(shouldBypassIsr({ preview: true })).toBe(true);\n  });\n  it("does not bypass otherwise", () => {\n    expect(shouldBypassIsr({ preview: false })).toBe(false);\n  });\n});\n`,
        playwright: `import { test, expect } from "@playwright/test";\n\ntest("blog index renders cached posts", async ({ page }) => {\n  await page.goto("/");\n  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();\n});\n`,
      },
    },
  },
  {
    shareSlug: "shadcn-dark",
    audit: {
      githubUrl: "https://github.com/shadcn-ui/ui",
      liveUrl: "https://shadcn-dark.example.com",
      requestedChange:
        "Add a fully accessible dark-mode toggle using next-themes, persist user choice, and update existing shadcn/ui colors to match WCAG AA contrast.",
      detectedFramework: "Next.js (App Router)",
      detectedPackageManager: "pnpm",
      detectedDbLayer: null,
      detectedAuthLayer: null,
      routesFolder: "app/",
      deploymentClues: ["Vercel"],
    },
    report: {
      architectureSummary:
        "Next.js App Router app using shadcn/ui. Adding next-themes touches the root layout, ThemeProvider boundary, and CSS variable definitions in globals.css.",
      mermaidGraph: `graph LR
  Layout[app/layout.tsx]
  Provider[ThemeProvider]
  Toggle[ThemeToggle]
  Tokens[globals.css tokens]
  Layout --> Provider --> Toggle
  Provider --> Tokens`,
      riskyAssumptions: [
        {
          title: "FOUC on first paint",
          severity: "medium",
          detail:
            "next-themes requires `suppressHydrationWarning` on <html> and a script tag before paint to avoid flash of light theme.",
        },
        {
          title: "Existing CSS vars cover both themes",
          severity: "low",
          detail:
            "Some legacy colors may not have a dark equivalent yet; audit globals.css before shipping.",
        },
      ],
      acceptanceCriteria: [
        { title: "Toggle switches theme without flash", detail: "Reload preserves selected theme." },
        { title: "All text passes WCAG AA contrast", detail: "Verified with axe-core." },
        { title: "Toggle is keyboard accessible", detail: "Tab + Enter operate the control." },
      ],
      promptPack: {
        replit:
          "Install next-themes. Wrap app/layout.tsx with ThemeProvider. Add a ThemeToggle component using shadcn/ui Switch. Add suppressHydrationWarning to the <html> tag.",
        cursor:
          "Add next-themes-based dark mode. Preserve existing shadcn/ui tokens. Add a Switch in the header.",
        copilot:
          "// Add ThemeProvider in layout, add ThemeToggle, persist with next-themes.",
        claudeCode:
          "Use Claude Code to add the dark-mode toggle. First inspect app/layout.tsx, the current shadcn/ui theme tokens, and any existing header/nav components. Then plan before editing. Implement next-themes with a keyboard-accessible toggle, preserve existing tokens, and verify no hydration warning appears. Run typecheck and a browser check for reload persistence.",
        codex:
          "Implement accessible dark mode as a Codex task. Goal: add next-themes, a shadcn/ui-based toggle, and WCAG-safe token updates without disrupting existing layout. Relevant files: app/layout.tsx, globals.css/theme tokens, header component. Acceptance: keyboard-operable toggle, persisted selection after reload, no hydration warning. Verify with typecheck and a Playwright flow for toggle persistence.",
      },
      rolloutNotes:
        "Ship behind a feature flag in staging; verify no hydration warnings; promote.\n\nRollback: remove ThemeProvider wrapper; toggle component is dead code.",
      testPlan: {
        vitest: `import { describe, it, expect } from "vitest";\nimport { resolveTheme } from "./theme";\n\ndescribe("resolveTheme", () => {\n  it("falls back to system", () => {\n    expect(resolveTheme(undefined, "dark")).toBe("dark");\n  });\n});\n`,
        playwright: `import { test, expect } from "@playwright/test";\n\ntest("toggle persists across reload", async ({ page }) => {\n  await page.goto("/");\n  await page.getByRole("switch", { name: /dark/i }).click();\n  await page.reload();\n  await expect(page.locator("html")).toHaveAttribute("class", /dark/);\n});\n`,
      },
    },
  },
  {
    shareSlug: "vite-lightning",
    audit: {
      githubUrl: "https://github.com/vitejs/vite",
      liveUrl: "https://vite-lightning.example.com",
      requestedChange:
        "Cut Vite cold-start build by half: enable dependency pre-bundling cache, lazy-load route components, and replace moment.js with date-fns.",
      detectedFramework: "Vite + React",
      detectedPackageManager: "pnpm",
      detectedDbLayer: null,
      detectedAuthLayer: null,
      routesFolder: "src/routes/",
      deploymentClues: ["Replit Deployments"],
    },
    report: {
      architectureSummary:
        "Vite + React SPA with eager route imports and a heavy moment.js dependency. The change touches vite.config.ts, every route entry, and any timestamp formatting helpers.",
      mermaidGraph: `graph LR
  Vite[Vite Dev]
  Routes[src/routes/*]
  Bundle[Bundle Output]
  Moment[moment.js -> date-fns]
  Vite --> Routes --> Bundle
  Routes --> Moment`,
      riskyAssumptions: [
        {
          title: "moment locale parity with date-fns",
          severity: "critical",
          detail:
            "moment locales differ from date-fns. Audit every formatter call before swap or you will silently change displayed dates.",
        },
        {
          title: "Lazy routes do not break SSR-style head tags",
          severity: "high",
          detail:
            "If document.title is set inside route components, ensure fallback Suspense renders a default title.",
        },
        {
          title: "optimizeDeps cache invalidates on lockfile change",
          severity: "low",
          detail: "Vite's depcache key includes the lockfile hash; CI must not strip it.",
        },
      ],
      acceptanceCriteria: [
        { title: "Cold-start dev under 4s", detail: "Measured locally on M1 with empty .vite cache." },
        { title: "Bundle size drops >150KB", detail: "Verified via vite build --report." },
        { title: "All date strings unchanged in snapshot tests", detail: "vitest snapshots green." },
      ],
      promptPack: {
        replit:
          "Migrate moment.js to date-fns across src/. Use lazy() + Suspense for every route in src/routes/. Update vite.config.ts to enable optimizeDeps.exclude where needed.",
        cursor:
          "Performance pass: lazy load routes, swap moment for date-fns, tune Vite optimizeDeps.",
        copilot:
          "// Replace moment with date-fns; lazy() routes; tune vite.config.ts optimizeDeps.",
        claudeCode:
          "Use Claude Code for a performance pass. First inspect route definitions, current moment.js usage, and vite.config.ts. Create a short plan that preserves visible date formatting and route behavior. Replace moment.js with date-fns, lazy-load route components with Suspense, tune optimizeDeps only where evidence supports it, and run snapshots plus a cold-start/build check.",
        codex:
          "Implement the Vite cold-start improvement as a scoped Codex issue. Goal: lazy-load routes, replace moment.js with date-fns, and tune Vite optimizeDeps without changing rendered date strings. Search targets: src/routes, date formatting utilities, vite.config.ts. Acceptance: snapshots unchanged, bundle smaller, cold start measured. Verify with typecheck, tests, and a build/perf note.",
      },
      rolloutNotes:
        "Land in a single PR; run snapshot tests; ship to prod after one staging pass.\n\nRollback: revert the PR; no schema/runtime side effects.",
      testPlan: {
        vitest: `import { describe, it, expect } from "vitest";\nimport { formatStamp } from "./time";\n\ndescribe("formatStamp", () => {\n  it("renders ISO date", () => {\n    expect(formatStamp("2025-01-02T03:04:05Z")).toMatch(/2025/);\n  });\n});\n`,
        playwright: `import { test, expect } from "@playwright/test";\n\ntest("home renders within budget", async ({ page }) => {\n  const start = Date.now();\n  await page.goto("/");\n  expect(Date.now() - start).toBeLessThan(4000);\n  await expect(page.getByRole("heading")).toBeVisible();\n});\n`,
      },
    },
  },
];
