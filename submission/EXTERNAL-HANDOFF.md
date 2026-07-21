# External submission handoff

Everything below changes external state. Do not perform an applicable step until the user has approved it. Never copy a credential into a log, commit, screenshot, video, or handoff.

## Current release state

- Integrated personal-account remote main is at `14064a7` (`marmar9615-cloud/Copilot-Checker`) and contains judge-readable evidence feature commit `d2f04b6`: Proof Flight Recorder, mobile containment, data-derived Black Box Replay, accessible live-status/focus handoff, and the reproducibility capsule API. The three commits after verified source tree `13cc94d` are Replit publish-only commits with no file-tree difference. The guarded public-app release and clean anonymous production red-to-green journey were verified on July 20; the private worker was not republished.
- The public app readiness endpoint reports live GPT-5.6 and live Codex configured, and the hosted anonymous red-to-green path passed with a fresh Codex thread.
- The public judge snapshot is `https://github.com/marmar9615-cloud/RetryProof-Build-Week-2026`; the final judge-readable evidence package is commit `2b245758796096a960619dde1b51b35276f85307`, with earlier immutable feature commits recorded in `submission/VERIFICATION.md`.
- The final 1:59.300 demo is public at `https://youtu.be/4Oaie-WLKAc`.
- Majority-core Codex `/feedback` Session ID: `019f5e19-b54f-7862-8023-f0f4251a5a0f`.
- Devpost submission `1092862` is **Submitted** at `https://devpost.com/software/retryproof`; project version 5 contains the final Black Box Replay/capsule description, verified video, personal public repository, hosted judge path, and required Build Week answers.

## Prepared production topology

```text
Public browser
  -> https://marmarlabs.com/retryproof/lab
  -> existing Copilot Checker API
  -> Replit production External Access Token + RetryProof HMAC signature
  -> private RetryProof Codex worker deployment
  -> one fresh Codex SDK thread in a bounded temporary workspace
  -> signed candidate and progress stream
  -> public API deterministic validators and identical-suite replay
```

The worker is infrastructure for the same RetryProof product, not a second user-facing product. Its separate Replit project gives it a separate app-secret set and deployment lifecycle. It must receive no MarMar Labs database, Stripe, GitHub, session, authentication, or unrelated product credentials.

## Exact worker deployment inputs

- Replit project: existing blank `RetryProof-Codex-Worker` project.
- Public judge snapshot: `https://github.com/marmar9615-cloud/RetryProof-Build-Week-2026`.
- Package: `artifacts/retryproof-codex-worker`.
- Deployment type: Reserved VM, **Web server**, Private access set to **Only you**, one exposed port.
- Build command:

  ```sh
  pnpm install --frozen-lockfile && pnpm --filter @workspace/retryproof-codex-worker run build
  ```

- Run command:

  ```sh
  pnpm --filter @workspace/retryproof-codex-worker run start
  ```

- Worker secrets only:
  - `OPENAI_API_KEY`
  - `OPENAI_ORGANIZATION_ID`
  - `OPENAI_PROJECT_ID`
  - `CODEX_MODEL=gpt-5.6-sol`
  - `RETRYPROOF_CODEX_WORKER_SECRET` — a new random value of at least 32 bytes
- Replit supplies `PORT`; do not hard-code it.

## Exact public-app configuration

After the private worker publishes successfully:

1. Verify the private worker deployment shows healthy logs and that direct anonymous access is rejected.
2. Create a **Production External Access Token** in the worker deployment’s Security settings. Store it immediately; Replit reveals it once.
3. Configure these masked secrets in the existing Copilot Checker project:
   - `RETRYPROOF_CODEX_WORKER_URL=https://<private-worker-domain>`
   - `RETRYPROOF_CODEX_WORKER_ACCESS_TOKEN=<production external access token>`
   - `RETRYPROOF_CODEX_WORKER_SECRET=<same HMAC secret as worker>`
4. Pull the merged source commit into the existing Replit project.
5. Republish the existing MarMar Labs deployment.
6. Verify `GET https://marmarlabs.com/api/retryproof/v1/ready` returns `ready=true` and `liveCodexConfigured=true` without returning any secret or private worker URL.

Replit production External Access Tokens are tied to a published deployment. Every later worker republish requires this rotation order: publish worker, create replacement token, update the main-app secret, republish main app, revoke the old token if it remains listed, then repeat the smoke test.

## Production acceptance sequence

1. Open `https://marmarlabs.com/retryproof/lab` in a clean private browser window.
2. Load the seeded workflow and confirm the supported sanitized graph renders.
3. Analyze and approve the at-most-once refund invariant.
4. Run the four-scenario suite and confirm the timeout trace is red with two mock effects.
5. Select **Repair with live Codex** and verify the UI shows elapsed time, progress bar, five stages, and signed event-feed updates for the entire run (typically one to three minutes, up to about six within the enforced budget) without appearing frozen.
6. Confirm the accepted repair provenance says **Fresh Codex**, contains a truncated thread ID and attempt count, and links to the submitted baseline commit.
7. Replay the identical suite and confirm the same event, seed, scenario, and two deliveries are green with one mock effect.
8. Download the evidence artifact and verify its analysis, repair, and deterministic-validation provenance.
9. Repeat the entire flow once in a second clean private window and inspect Replit logs for crashes, credential output, unhandled rejections, or timeouts.
10. Test the clearly labeled validated fallback separately; it must never claim a fresh Codex run.

## Future public-app release order

1. Run the repository's pnpm 9.x test/typecheck/build commands, a redacted secret scan, URL checks, and production health checks.
2. Pull the reviewed personal-account commit into the public Copilot Checker Replit workspace and verify the intended artifact selection before publishing.
3. Republish only the public app. Monitor `marmarlabs.com`, `/api/healthz`, `/api/retryproof/v1/ready`, and `/retryproof/lab/` through the rollout and roll back immediately if any route stops returning healthy responses.
4. Re-run the anonymous no-account judge path and verify provenance labels, responsive containment, and the evidence receipt.
5. Update the existing Devpost project and public judge package only after production evidence is current.

Do not republish the private worker for an ordinary public-app release. If the private worker itself must be republished, follow the deployment-token rotation sequence above before calling live repair healthy.

## Deadline controls

- Hard deadline: **July 21, 2026 at 5:00 PM PDT / 7:00 PM CDT**.
- Internal target: **July 21 at 5:00 PM CDT**, preserving two hours for deployment, token rotation, video processing, or access failures.
- Keep both public app and private worker available through at least the published winner announcement on **August 12, 2026**.
