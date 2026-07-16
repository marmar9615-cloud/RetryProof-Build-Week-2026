## Project
MarMar Labs is an early-stage software lab. This monorepo hosts the marmarlabs.com marketing site and the company's first product, **NeverGuess** — an AI change-preflight tool that inspects architecture, risk, tests, and deployment readiness before another coding agent changes the code.

## Routing
- `/` — MarMar Labs marketing home
- `/neverguess` — NeverGuess product landing page (public marketing)
- `/about`, `/contact`, `/privacy`, `/terms` — marketing pages
- `/app` — the working NeverGuess dashboard (auth-aware)
- `/audits/new`, `/audits/:id` — auth-required app routes
- `/r/:slug` — public, unguessable share links for completed reports

## Stack
- Frontend: React + Vite + TypeScript + Tailwind v4 + shadcn/ui + wouter + TanStack Query
- Backend: Express + TypeScript
- Database: PostgreSQL with Drizzle
- Auth: Replit Auth (OIDC), `@workspace/replit-auth-web`
- API contract: OpenAPI in `lib/api-spec` with generated Zod and React Query clients
- Testing: Vitest for units, Playwright for live-app smoke tests

## Brand & UX
- Light "engineering paper + instrument panels" system: paper-grid backgrounds, editorial cards (`bg-card` + `border-card-border` + `rounded-2xl`), electric-iris primary accent, dark `.ink` panels reserved for terminal/diagram readouts.
- Brand assets live in `artifacts/neverguess/public/brand/`.
- Shared utilities (`.eyebrow`, `.paper-grid`, `.dot-grid`, `.ink`, `.ring-brand-glow`) live in `artifacts/neverguess/src/index.css`.
- Primary font: Geist (display). Mono font: JetBrains Mono.
- Product category language: NeverGuess is always "AI change preflight" — never "AI code review" or other variants.
- Every loading state needs a skeleton; every empty state should teach the user what to do next.
- Never invent fake metrics, testimonials, or traction.

## Product rules
- MVP scope: public GitHub repos and public live URLs only.
- If an integration is blocked or unconfigured, fall back to demo mode rather than stalling.
- Keep marketing pages factual — surface real product behavior, not aspirational claims.

## Coding style
- Keep functions small and typed.
- Never refactor unrelated files.
- Prefer explicit naming over clever abstractions.
- Add comments only when they reduce ambiguity.
- For paths to assets in `public/`, use the `asset()` helper in `src/lib/asset-url.ts` so Vite's BASE_URL is respected.

## Error handling
- API responses use `{ ok, data, error, traceId }`.
- Never expose secrets or raw tokens to the client.
- Time out external requests and mark them retryable when appropriate.

## Company
- Name: MarMar Labs
- Founder: Marcel Jiron
- Region: Minnesota, United States
- Founded: March 26, 2026
- Contact: contact@marmarlabs.com

## Agent collaboration
- Before major edits, explain the plan and files.
- After each milestone, run tests and summarize results.
