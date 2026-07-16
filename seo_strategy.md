# SEO Strategy

## In scope
- Public marketing pages (`/`, `/neverguess`, `/stui`, `/signai`, `/pricing`, `/about`, `/contact`, `/privacy`, `/terms`, `/status`, `/changelog`)
- Public SignAI policy/support pages (`/signai/privacy`, `/signai/terms`, `/signai/support`)
- Public share pages (`/r/:slug`) only where crawlability, indexing, or social-preview behavior is determined by source code

## Out of scope
- Authenticated dashboard and flows (`/app/**`)
- Auth-required audit routes (`/audits/**`)
- Admin/internal-only surfaces if any exist outside the public route map

## Target audience
- Developers and technical buyers evaluating MarMar Labs products, especially NeverGuess
- Prospective users evaluating SignAI and stui

## Primary keywords
- MarMar Labs
- NeverGuess
- AI change preflight
- AI code change risk analysis
- stui terminal UI
- SignAI agreement signing

## Dismissed categories
- None yet

## Notes
- The app is a Vite + React + Wouter frontend, but public marketing routes are no longer plain JS-only SPA responses.
- `artifacts/neverguess/meta-inject-plugin.ts` now injects route-specific titles, descriptions, canonicals, OG/Twitter tags, and static fallback body HTML for the public marketing route map during build output generation.
- `/r/:slug` share pages get dynamic server-side metadata/body injection through Vite dev/preview middleware, so the previous generic-share-card limitation is no longer present in source.
- Client-side hooks in `src/lib/use-meta-tags.ts` still matter for hydrated navigation, but the initial HTML response is now the primary SEO surface to audit.
