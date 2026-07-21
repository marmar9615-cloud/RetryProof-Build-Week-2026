# RetryProof submission verification

Production proof was refreshed on **July 20, 2026 CDT**. This file keeps local, source-control, production, artifact, and external-submission proof separate.

## July 20 judge-readable evidence release

- The five product/test files in this public package are byte-identical to integrated source commit `d2f04b6` in `marmar9615-cloud/Copilot-Checker`.
- The source adds a data-derived Black Box Replay, full-width completed-evidence layout, keyboard focus handoff and polite live-stage announcements, a session-bound canonical receipt download, and a reproducibility capsule with an approved contract plus deterministic per-file SHA-256 manifest.
- The manifest explicitly verifies byte consistency only; it does not verify signer identity, exactly-once execution, or production safety.
- Personal-account main `13cc94d` contains `d2f04b6`, and the guarded public-app publish was verified before the production proof below. The separate private worker was not republished.
- Devpost project version 5 was refreshed from the final reviewed release copy and re-submitted through the official plugin; submission `1092862` remained **Submitted**.

## Integrated production source

- Source repository: `marmar9615-cloud/Copilot-Checker`.
- Submitted baseline commit: `2dd084c` (`Merge pull request #10`).
- Proof Flight Recorder feature commit: `9f8a2d6`; integrated merge: `d4d6fb1`; mobile containment fix: `6a1640b`; judge-readable evidence source: `d2f04b6`.
- The deployed integrated main was `13cc94d`, containing the final judge-readable evidence source `d2f04b6`.
- The public-app artifact manifests were checked before publishing: API server and NeverGuess declare production services; the private RetryProof worker does not claim the public app's production slot.

## Production health and live paths

- `https://marmarlabs.com/`, `/api/healthz`, `/api/retryproof/v1/ready`, and `/retryproof/lab/` returned HTTP 200 continuously during and after the final public-app publish.
- `GET /api/retryproof/v1/ready` returned `ready:true`, PostgreSQL storage, `cachedJudgePath:true`, `customWorkflowPath:true`, `liveAnalysisConfigured:true`, and `liveCodexConfigured:true`.
- A supported custom four-node workflow exercised the production live-analysis path. The returned provenance was `live`, model `gpt-5.6-sol`, with grounded workflow coverage and no model-owned verdict.
- The seeded production judge path was run from a clean anonymous session: analyze, human approval, deterministic red suite, one fresh live Codex repair, validator acceptance, identical replay, and evidence receipt.
- The fresh Codex repair completed in about 34 seconds in the observed browser journey. The UI showed signed **Worker accepted**, fresh thread `019f81fb-777b-78e3-8158-783ace5d5734`, one attempt, validator acceptance, and no fallback provenance.
- The identical deterministic replay changed the declared timeout scenario from two mock effects to one while keeping the event, fixture, seed, fault, and two deliveries fixed.
- Current production canonical receipt SHA-256: `7443835dd9c79481b977e1a644f9ccc3b74f507faf7c3065f8d72a736b849817`.
- Current production capsule SHA-256: `3dba14b8cc2c160ebfdb41d12c519900035b157d068da7653e34f1ace5d37bab`.
- ZIP integrity passed. The capsule contains 10 files total: `manifest.json` plus nine path-sorted payload entries. Every listed byte length and SHA-256 digest matched, and the downloaded canonical receipt is byte-identical to `receipt.json` inside the capsule.
- The released Proof Flight Recorder rendered the accepted before/after paths, all four scenario rows, changed-node summary, and evidence references from that same run.
- Black Box Replay confirmed the first two events matched and isolated event 3 as `effect_replayed` before versus `reservation_conflict` after. The four scenario rows were `2→1`, `2→1`, `1→0`, and `2→1`.
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
- Screenshots 01–07 preserve earlier production evidence and are explicitly labeled as such. `submission/screenshots/08-black-box-replay-production.png` is the clean 1366×768 capture of the current live `2→1` evidence view, capsule control, accepted paths, and Black Box Replay.
- The exact current artifacts are preserved offline as `submission/evidence/production-receipt-7443835dd9c7.json` and `submission/evidence/production-capsule-7443835dd9c7.zip`.

## Public judge artifacts

- Public judge snapshot: `https://github.com/marmar9615-cloud/RetryProof-Build-Week-2026`.
- Final judge-readable evidence package commit: `2b245758796096a960619dde1b51b35276f85307`.
- Feature snapshot commits: `999889e` (recorder) and `265b381` (mobile containment).
- Documentation and media proof-package commit: `9d9fa71`.
- This snapshot has no GitHub Actions workflow; the focused frontend test/typecheck/build, API typecheck/build, source-byte parity, artifact verifier, and redacted secret scan were run locally before the package commit. The six database-backed API snapshot tests self-skipped because the standalone judge package has no test database.
- The snapshot is a clean, single-history judge package under the personal `marmar9615-cloud` account; anonymous raw-file access returned HTTP 200 and a redacted gitleaks scan found zero findings.
- Public demo video: `https://youtu.be/4Oaie-WLKAc`.
- Anonymous YouTube page and oEmbed checks returned HTTP 200 with the expected title, MarMar Labs channel, and custom thumbnail.
- YouTube reported no copyright or Community Guidelines issues; English automatic captions are published.
- Majority-core Codex `/feedback` Session ID: `019f5e19-b54f-7862-8023-f0f4251a5a0f`.

## External submission proof

- Devpost project: `https://devpost.com/software/retryproof`, submission `1092862`, status **Submitted**.
- The authenticated project updated at `2026-07-20T20:36:20.388-04:00` to version 5. Readback confirmed the final description includes Black Box Replay, the reproducibility capsule, and the explicit no-exactly-once/no-production-safety limitation; the public video and hosted judge URL remain attached.
