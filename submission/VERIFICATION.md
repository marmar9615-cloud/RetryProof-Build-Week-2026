# RetryProof submission verification

Verified on **July 17, 2026 CDT**. This file keeps local, source-control, production, and external-submission proof separate.

## Integrated production source

- Source repository: `marmar9615-cloud/Copilot-Checker`.
- Submitted baseline commit: `2dd084c` (`Merge pull request #10`).
- Proof Flight Recorder feature commit: `9f8a2d6`; integrated merge: `d4d6fb1`; mobile containment fix: `6a1640b`.
- The production Replit workspace included `6a1640b` with a clean tree before the final public-app publish.
- The public-app artifact manifests were checked before publishing: API server and NeverGuess declare production services; the private RetryProof worker does not claim the public app's production slot.

## Production health and live paths

- `https://marmarlabs.com/`, `/api/healthz`, `/api/retryproof/v1/ready`, and `/retryproof/lab/` returned HTTP 200 continuously during and after the final public-app publish.
- `GET /api/retryproof/v1/ready` returned `ready:true`, PostgreSQL storage, `cachedJudgePath:true`, `customWorkflowPath:true`, `liveAnalysisConfigured:true`, and `liveCodexConfigured:true`.
- A supported custom four-node workflow exercised the production live-analysis path. The returned provenance was `live`, model `gpt-5.6-sol`, with grounded workflow coverage and no model-owned verdict.
- The seeded production judge path was run from a clean anonymous session: analyze, human approval, deterministic red suite, one fresh live Codex repair, validator acceptance, identical replay, and evidence receipt.
- The live Codex repair completed within about 50 seconds. The UI showed fresh thread prefix `019f72ed-f2f…`, one attempt, five worker-side validator checks, and no fallback provenance.
- The identical deterministic replay changed the declared timeout scenario from two mock effects to one while keeping the event, fixture, seed, fault, and two deliveries fixed.
- Current production evidence receipt SHA-256: `f4270c8266a371e3f0015672d4484e77830a2945eea6ad236e6606ae89a02a02`.
- The released Proof Flight Recorder rendered the accepted before/after paths, all four scenario rows, changed-node summary, and evidence references from that same run.
- Responsive production checks passed at 390×844 with the raw patch disclosure both closed and open: the document remained 379px wide with no page-level horizontal overflow; graph, matrix, and raw patch overflow stayed inside their local scrollers. Desktop at 1366×768 also had no page-level horizontal overflow.

## Integrated test evidence

- NeverGuess frontend: **23/23 tests passed**, typecheck passed, production build passed.
- API server: **130 passed / 20 skipped**.
- RetryProof worker: **10 passed / 1 gated live spec skipped**, typecheck passed, build passed.
- The final production copy states that a live repair is typically one to three minutes and may take up to about six within the fail-closed budget.

## Security and publication boundary

- A fresh `gitleaks dir --redact` scan of the exact integrated source tree found **zero findings**.
- A targeted credential-pattern scan found only secret-name strings in tests, not credential values.
- Production credentials, prompts, request bodies, private worker URLs, HMAC material, and raw or unvalidated model output were never included in screenshots, video, documentation, or repository output. Screenshot 04 intentionally shows the accepted, validated Codex explanation as ordinary product UI text.
- Judges receive a new public single-history snapshot rather than the older integrated repository history.

## Submission media

- Final video: `submission/video/retryproof-demo-final.mp4`.
- Duration: **119.300 seconds (1:59.300)**, below the strict three-minute limit.
- Media: **1366×768 H.264 at 30 fps; 48 kHz mono AAC**.
- Normalized audio measured **-15.5 dB mean / -1.5 dB max**.
- SHA-256: `48cc6e7b8ff50fe001aac253a804457759b8367faa28f387d634f77287650753`.
- The cut uses production UI only and compresses only the live-worker wait. The narration discloses that compression.
- One current 1355×762 production PNG shows the data-derived Proof Flight Recorder. Six earlier-production walkthrough captures remain in the package as explicitly archived context; their older labels and identifiers are not presented as current release proof.

## Public judge artifacts

- Public judge snapshot: `https://github.com/marmar9615-cloud/RetryProof-Build-Week-2026`.
- Feature snapshot commits: `999889e` (recorder) and `265b381` (mobile containment).
- The snapshot is a clean, single-history judge package under the personal `marmar9615-cloud` account; anonymous raw-file access returned HTTP 200 and a redacted gitleaks scan found zero findings.
- Public demo video: `https://youtu.be/4Oaie-WLKAc`.
- Anonymous YouTube page and oEmbed checks returned HTTP 200 with the expected title, MarMar Labs channel, and custom thumbnail.
- YouTube reported no copyright or Community Guidelines issues; English automatic captions are published.
- Majority-core Codex `/feedback` Session ID: `019f5e19-b54f-7862-8023-f0f4251a5a0f`.

## External submission proof

- Devpost project: `https://devpost.com/software/retryproof`, submitted to OpenAI Build Week and still editable until the deadline.
- The live project description, gallery, and contribution statement were rechecked after the Proof Flight Recorder update.
