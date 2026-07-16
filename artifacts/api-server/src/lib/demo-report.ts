import type {
  AcceptanceCriterion,
  AffectedArea,
  PromptPack,
  RiskyAssumption,
  TestPlan,
} from "@workspace/db";

export type DemoReportShape = {
  architectureSummary: string;
  mermaidGraph: string;
  riskyAssumptions: RiskyAssumption[];
  acceptanceCriteria: AcceptanceCriterion[];
  promptPack: PromptPack;
  rolloutNotes: string;
  testPlan?: TestPlan | null;
  // Optional: absent on reports generated before blast-radius shipped.
  affectedAreas?: AffectedArea[] | null;
};

export const DEMO_REPORT: DemoReportShape = {
  architectureSummary:
    "A typical Vite + React frontend served alongside an Express API. PostgreSQL is accessed via Drizzle ORM, and authentication is delegated to Replit Auth via openid-client. The change you requested touches the user-facing dashboard and the underlying audits route, so both client routing and server validation are in scope.",
  mermaidGraph: `graph LR
  Browser[Browser - Vite/React]
  API[Express API]
  DB[(Postgres - Drizzle)]
  Auth[Replit Auth - OIDC]
  Browser -->|fetch /api| API
  API -->|SQL| DB
  API -->|OIDC| Auth
  Browser -->|/login redirect| Auth`,
  riskyAssumptions: [
    {
      title: "Schema migration is reversible",
      severity: "high",
      detail:
        "Any new columns added for this change must be backfilled or made nullable; otherwise existing rows will fail validation on read.",
      // Evidence paths must exist in DEMO_REPO.fileTree (see demo-repo.ts) —
      // the demo report skips the server-side path check, so the fixture is
      // pre-stamped verified and kept honest by a test.
      evidence: [
        {
          path: "drizzle.config.ts",
          quote: "schema: './server/db/schema.ts', dialect: 'postgresql'",
          verified: true,
        },
        { path: "server/db/schema.ts", verified: true },
      ],
    },
    {
      title: "Auth session shape is unchanged",
      severity: "medium",
      detail:
        "The change should not silently mutate the session payload — downstream middleware assumes the existing user-id field stays stable.",
      evidence: [
        { path: "server/auth/replit.ts", verified: true },
        {
          path: "package.json",
          quote: '"openid-client": "^5.6.0"',
          verified: true,
        },
      ],
    },
    {
      title: "Background job runs at most once per audit",
      severity: "medium",
      detail:
        "Re-triggering ingestion for an existing audit could duplicate analysis rows or stomp existing reports.",
    },
    {
      title: "Frontend polling stops at terminal state",
      severity: "low",
      detail:
        "Confirm React Query refetchInterval returns false once the audit is `done` or `error`, otherwise users hammer the API.",
      evidence: [{ path: "client/src/pages/dashboard.tsx", verified: true }],
    },
  ],
  acceptanceCriteria: [
    {
      title: "No regression on existing audit list",
      detail:
        "Pre-change audits still load, render their status badge, and link to their detail view.",
    },
    {
      title: "New change is feature-flagged or behind auth",
      detail:
        "Anonymous visitors cannot trigger the new path; only the audit owner can request analysis.",
    },
    {
      title: "Errors are surfaced, not swallowed",
      detail:
        "Failures during the new flow set status=`error` and show a user-readable message in the UI.",
    },
    {
      title: "Type contracts updated end-to-end",
      detail:
        "OpenAPI, generated zod, generated React client, and DB schema all reflect the new fields.",
    },
  ],
  promptPack: {
    replit:
      "You are working on a Vite + React + Express + Drizzle + Replit Auth app.\n\nRequested change: <PASTE>.\n\nBefore writing code:\n1. Read the existing audit route and the audits Drizzle table.\n2. Update the OpenAPI spec first, then run codegen.\n3. Add a Drizzle migration only if a new column is required.\n4. Wire the change end-to-end: schema -> route -> generated client -> UI.\n5. Add a Skeleton (not a spinner) while data is loading.\n\nDo not silently fall back when an API call fails; surface the error in the UI.",
    cursor:
      "Stack: Vite + React + Express + Drizzle + Replit Auth.\n\nGoal: <PASTE>.\n\nConstraints:\n- Update the OpenAPI spec at lib/api-spec/openapi.yaml first.\n- Regenerate clients with: pnpm --filter @workspace/api-spec run codegen.\n- Use existing UI primitives in artifacts/neverguess/src/components/ui.\n- Preserve current auth middleware; do not bypass req.isAuthenticated.\n- Add a data-testid to any new interactive element.\n\nPlan, then diff, then apply.",
    copilot:
      "// Stack: Vite + React + Express + Drizzle + Replit Auth.\n// Change request: <PASTE>.\n// Steps:\n// 1) Update lib/api-spec/openapi.yaml.\n// 2) Run pnpm --filter @workspace/api-spec run codegen.\n// 3) Add the route in artifacts/api-server/src/routes.\n// 4) Wire it in the React page using the generated hook.\n// 5) Show a Skeleton while loading and an inline alert on error.\n// Avoid: silent fallbacks, hard-coded URLs, removing existing tests.",
    claudeCode:
      "Use Claude Code to implement this change in the existing repo.\n\nGoal: <PASTE>.\n\nBefore editing:\n1. Read CLAUDE.md if present, package.json scripts, lib/api-spec/openapi.yaml, the relevant Express route, and the React page that consumes it.\n2. Identify the smallest file set that needs to change and state the plan briefly.\n\nImplementation constraints:\n- Preserve Replit Auth and existing req.isAuthenticated checks.\n- Update OpenAPI first if the API contract changes, then run pnpm --filter @workspace/api-spec run codegen.\n- Use existing shadcn/ui primitives and add data-testid to any new interactive element.\n- Use Skeleton loading states, not spinners.\n\nVerification:\n- Run pnpm run typecheck.\n- Run the narrowest relevant Vitest test, then broaden if shared behavior changed.\n- For UI changes, take a browser screenshot and fix visible regressions before finishing.",
    codex:
      "Implement this as a scoped Codex task, like a GitHub issue.\n\nGoal: <PASTE>\n\nContext:\n- Stack: Vite + React + Express + Drizzle + Replit Auth.\n- API contract source: lib/api-spec/openapi.yaml.\n- Generated clients must not be edited by hand.\n\nAcceptance criteria:\n- Existing signed-in dashboard and report pages continue to work.\n- Any API contract change is reflected through codegen.\n- New UI controls use existing components and unique data-testid values.\n- Errors are surfaced in the UI instead of silently falling back.\n\nVerification commands:\n- pnpm run typecheck\n- pnpm --filter @workspace/api-server test\n- pnpm --filter @workspace/neverguess test\n\nKeep the diff surgical and report exactly which files changed.",
  },
  rolloutNotes:
    "Roll out in three steps: (1) deploy schema + API behind the existing auth check; (2) flip the UI route to use the new generated hook once the API is stable in production; (3) keep the previous code path for one release and remove it only after metrics confirm zero traffic.\n\nRollback: revert the UI hook to the previous version first; the API and schema are additive and safe to leave in place. If the schema change must be rolled back, drop only the new columns/tables — never the audits or users tables.",
  testPlan: {
    vitest: `import { describe, it, expect } from "vitest";
import { computeRiskScore } from "@/lib/risk-score";

describe("computeRiskScore", () => {
  it("returns safe for an empty list", () => {
    expect(computeRiskScore([]).verdict).toBe("safe");
  });
  it("blocks on two criticals", () => {
    const r = computeRiskScore([
      { title: "x", severity: "critical", detail: "d" },
      { title: "y", severity: "critical", detail: "d" },
    ]);
    expect(r.verdict).toBe("block");
  });
});
`,
    playwright: `import { test, expect } from "@playwright/test";

test("dashboard loads and shows the new audit card", async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByTestId("banner-demo-mode")).toBeVisible();
  await page.getByTestId("link-sample-audit-0").click();
  await expect(page.getByTestId("section-tldr-verdict")).toBeVisible();
});

test("report exposes the prompt pack and copies a Replit prompt", async ({ page }) => {
  await page.goto("/r/demo");
  await page.getByTestId("tab-replit").click();
  await expect(page.getByTestId("text-prompt-replit")).toContainText("Vite");
});
`,
  },
  // Blast radius for the demo audit's requested change (per-user rate limiting
  // on the POST endpoint). modify/read paths must exist in DEMO_REPO.fileTree;
  // create entries are new files and may not.
  affectedAreas: [
    {
      path: "server/middleware/rate-limit.ts",
      reason: "New per-user rate-limit middleware lives here.",
      action: "create",
    },
    {
      path: "server/index.ts",
      reason: "Express entry point where the middleware is registered.",
      action: "modify",
    },
    {
      path: "server/routes/posts.ts",
      reason:
        "Existing POST handlers the limiter must wrap without breaking dashboard polling.",
      action: "modify",
    },
    {
      path: "server/auth/replit.ts",
      reason: "Supplies the authenticated user id the limiter keys on.",
      action: "read",
    },
    {
      path: "package.json",
      reason: "Gains the rate-limiter dependency.",
      action: "modify",
    },
  ],
};
