# RetryProof submission verification

Verified on **July 16, 2026 CDT**. This file keeps local, source-control, production, and external-submission proof separate.

## Integrated production source

- Source repository: `marmar9615-cloud/Copilot-Checker`.
- Submitted implementation commit: `2dd084c` (`Merge pull request #10`).
- The production Replit workspace was synced exactly to that commit with a clean tree.
- The public-app artifact manifests were checked before publishing: API server and NeverGuess declare production services; the private RetryProof worker does not claim the public app's production slot.

## Production health and live paths

- `https://marmarlabs.com/`, `https://marmarlabs.com/retryproof/lab/`, and both corresponding `copilot-checker.replit.app` URLs returned HTTP 200 after the final publish.
- `GET /api/retryproof/v1/ready` returned `ready:true`, PostgreSQL storage, `cachedJudgePath:true`, `customWorkflowPath:true`, `liveAnalysisConfigured:true`, and `liveCodexConfigured:true`.
- A supported custom four-node workflow exercised the production live-analysis path. The returned provenance was `live`, model `gpt-5.6-sol`, with grounded workflow coverage and no model-owned verdict.
- The seeded production judge path was run from a clean anonymous session: analyze, human approval, deterministic red suite, one fresh live Codex repair, validator acceptance, identical replay, and evidence receipt.
- The live Codex repair completed in about 45 seconds. The UI showed a fresh thread, one attempt, five worker-side validator checks, and no fallback provenance.
- The identical deterministic replay changed the declared timeout scenario from two mock effects to one while keeping the event, fixture, seed, fault, and two deliveries fixed.
- Current production evidence receipt SHA-256: `a19adb798c06d14e274dc55be275ec39939277c461d8d1a22e73d3516596568b`.

## Integrated test evidence

- NeverGuess frontend: **14/14 tests passed**, typecheck passed, production build passed.
- API server: **130 passed / 20 skipped**.
- RetryProof worker: **10 passed / 1 gated live spec skipped**, typecheck passed, build passed.
- The final production copy states that a live repair is typically one to three minutes and may take up to about six within the fail-closed budget.

## Security and publication boundary

- A fresh `gitleaks dir --redact` scan of the exact integrated source tree found **zero findings**.
- A targeted credential-pattern scan found only secret-name strings in tests, not credential values.
- Production credentials, model output, request bodies, private worker URLs, and HMAC material were never included in screenshots, video, documentation, or repository output.
- Judges receive a new public single-history snapshot rather than the older integrated repository history.

## Submission media

- Final video: `submission/video/retryproof-demo-final.mp4`.
- Duration: **119.300 seconds (1:59.300)**, below the strict three-minute limit.
- Media: **1366×768 H.264 at 30 fps; 48 kHz mono AAC**.
- Normalized audio measured **-15.5 dB mean / -1.5 dB max**.
- SHA-256: `48cc6e7b8ff50fe001aac253a804457759b8367faa28f387d634f77287650753`.
- The cut uses production UI only and compresses only the live-worker wait. The narration discloses that compression.
- Six current production screenshots are 1366×768 PNGs and cover import, contract, red counterexample, fresh Codex acceptance, green comparison, and evidence receipt.

## Public judge artifacts

- Public judge snapshot: `https://github.com/marmar9615-cloud/RetryProof-Build-Week-2026`.
- Snapshot commit: `14891f0666c72ace985351f3f8bdbfb32dc6fe3d`.
- The snapshot is a clean, single-history judge package under the personal `marmar9615-cloud` account; anonymous raw-file access returned HTTP 200 and a redacted gitleaks scan found zero findings.
- Public demo video: `https://youtu.be/4Oaie-WLKAc`.
- Anonymous YouTube page and oEmbed checks returned HTTP 200 with the expected title, MarMar Labs channel, and custom thumbnail.
- YouTube reported no copyright or Community Guidelines issues; English automatic captions are published.
- Majority-core Codex `/feedback` Session ID: `019f5e19-b54f-7862-8023-f0f4251a5a0f`.

## Remaining external proof

Only Devpost's submitted confirmation state remains false until the final submission completes and is checked live.
