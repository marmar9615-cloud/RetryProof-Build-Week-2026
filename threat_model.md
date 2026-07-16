# Threat Model

## Project Overview

NeverGuess is a full-stack TypeScript application that helps users pre-review proposed changes to AI-built apps. It uses an Express API (`artifacts/api-server`), a React/Vite frontend (`artifacts/neverguess`), PostgreSQL via Drizzle (`lib/db`), generated OpenAPI/Zod clients, Replit OIDC authentication, GitHub ingestion, OpenRouter LLM analysis, and Playwright-based smoke checks against user-supplied live URLs.

The mockup sandbox (`artifacts/mockup-sandbox`) is a development-only artifact and is out of production scope unless a future deployment path makes it reachable in production. Production deployments are assumed to run with `NODE_ENV=production`, and platform TLS terminates HTTPS traffic.

## Assets

- **User accounts and sessions** -- Replit OIDC identity claims, session IDs in cookies or bearer headers, access tokens, and refresh tokens stored in the sessions table. Compromise allows account impersonation and access to private audits and reports.
- **Audit and report data** -- requested changes, repository metadata, fetched key file contents, generated analysis, prompt packs, smoke results, screenshots, and public share slugs. These may reveal project architecture or business-sensitive implementation details.
- **Application secrets** -- database connection strings, `GITHUB_TOKEN`, OpenRouter API key/base URL, Replit OIDC client identity, and any platform-provided environment secrets.
- **Compute and third-party quotas** -- authenticated audit creation can trigger GitHub API calls, OpenRouter LLM calls, and Playwright browser work. Abuse can consume money, rate limits, and server resources.
- **Public shared report links** -- unguessable `shareSlug` values intentionally expose selected report and audit fields without authentication. In the current product model, enabling a public share link also makes that report eligible for the public `/reports` gallery and related SEO surfaces; future scans should treat that broader publication model as intended unless the code introduces a distinct private/link-only sharing mode.

## Trust Boundaries

- **Browser/mobile client to API** -- all `/api` requests cross from untrusted clients into Express. The server must validate authentication, authorization, request bodies, route parameters, and origin-dependent behavior.
- **Public to authenticated surfaces** -- `/api/healthz`, `/api/login`, `/api/callback`, `/api/auth/user`, mobile auth exchange/logout, demo audit reads, and `/api/r/:slug` have unauthenticated behavior. Audit creation, private audit reads, report reads, and share/revoke actions must enforce ownership server-side.
- **API to PostgreSQL** -- Express reads and writes user sessions, audit records, ingested repository snapshots, and reports. Queries must remain parameterized and scoped by user ownership where appropriate.
- **API to GitHub/OpenRouter/OIDC** -- the server calls external services with tokens or client identity. Inputs must not let users redirect sensitive data to attacker-controlled services or leak secrets into logs/responses.
- **API to arbitrary live URLs via Playwright** -- `liveUrl` is user-controlled and can cause server-side browser navigation. The SSRF guard must block private/internal IPs, localhost, unsafe protocols, redirects, and subresources.
- **Generated content to frontend DOM** -- LLM-generated Mermaid diagrams, prompt text, risk text, screenshots, and public reports cross into React rendering. Generated HTML/SVG must be sanitized or rendered under safe settings.

## Scan Anchors

- Production backend entry points: `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/*`, `artifacts/api-server/src/lib/auth.ts`, `artifacts/api-server/src/middlewares/authMiddleware.ts`.
- High-risk backend workers: `artifacts/api-server/src/lib/ingest-runner.ts`, `github-ingest.ts`, `analysis-runner.ts`, `openrouter-client.ts`, `smoke-runner.ts`.
- Database schema and trust-relevant data: `lib/db/src/schema/auth.ts`, `audits.ts`, `reports.ts`.
- Production frontend surfaces: `artifacts/neverguess/src/pages/*`, `artifacts/neverguess/src/components/report-view.tsx`, `report-actions.tsx`, `live-app-health.tsx`, `lib/api-client-react/src/custom-fetch.ts`, `lib/replit-auth-web/src/use-auth.ts`.
- Public API surfaces: `/api/healthz`, `/api/auth/user`, `/api/login`, `/api/callback`, `/api/mobile-auth/token-exchange`, `/api/mobile-auth/logout`, demo audit reads, and `/api/r/:slug`.
- Dev-only area normally excluded: `artifacts/mockup-sandbox`, generated `dist`, `node_modules`, tests, and attached assets unless production reachability is demonstrated.

## Threat Categories

### Spoofing

Sessions are opaque IDs stored in PostgreSQL and sent through a Secure, HttpOnly, SameSite=Lax cookie for browsers or a bearer token for mobile clients. The application must only accept unpredictable, unexpired session IDs and must not let host/header manipulation alter OIDC redirect handling or logout destinations in production. OIDC state, nonce, and PKCE values must be validated for browser flows; mobile token exchange must rely on provider validation and PKCE and should not expose reusable session tokens to unintended clients.

### Tampering

Clients can submit audit inputs (`githubUrl`, `liveUrl`, `requestedChange`) and route IDs. The server must validate all request bodies and parameters, ignore client-supplied ownership fields, and scope writes such as report sharing/revocation to the authenticated owner. LLM output and ingested repository data are untrusted content and must not be treated as code or trusted HTML.

### Information Disclosure

Private audits and reports must only be visible to their owner, while demo and public share routes must intentionally return a reduced set of fields. API responses and logs must not expose raw OIDC tokens, refresh tokens, GitHub/OpenRouter secrets, raw stack traces, or full repository snapshots beyond intended report fields. Public share links must remain high entropy and revocable, but shared reports may be publicly listed and indexed as part of the current product behavior.

### Denial of Service

Audit creation can trigger expensive GitHub ingestion, LLM calls, DNS lookups, and headless browser navigation. The application must bound input sizes, request body sizes, file fetches, worker concurrency, navigation timeouts, screenshot size, rerun behavior, deletion semantics, and per-user or global audit creation rates so authenticated users cannot exhaust compute, browser processes, API quotas, or LLM budget.

### Elevation of Privilege

Authenticated users must not access or mutate audits and reports owned by other users by guessing UUIDs or report IDs. Public shared reports must not become a write capability. Database access must remain parameterized through Drizzle; user-controlled strings must not reach shell commands, dynamic imports, file paths, or browser automation without validation.

### SSRF and External Request Abuse

GitHub ingestion is intended only for public GitHub repositories and should only contact GitHub-controlled hosts. Smoke tests intentionally navigate to user-supplied public URLs but must prevent access to private networks, cloud metadata, localhost, link-local addresses, and redirect/subresource bypasses. External requests should use timeouts and should avoid sending application secrets to user-controlled domains.
