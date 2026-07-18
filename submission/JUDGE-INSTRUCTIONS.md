# RetryProof judge instructions

## No-rebuild path

1. Open `https://marmarlabs.com/retryproof/lab/` in a current desktop browser. No account is required.
2. Select **Load seeded workflow**.
3. Confirm the import reports `5/5 nodes supported` and shows a sanitized five-node snapshot plus synthetic fixture `evt_refund_001`.
4. Select **Analyze retry risk** to derive the contract. The seeded proposal is intentionally labeled **GPT-5.6-informed seeded contract**; import, approval, simulator, validator, and evidence hashing run now.
5. Check **I approve this invariant and its declared scope**, then select **Approve contract**.
6. Select **Run four-scenario suite**.
7. Confirm the primary red trace shows event `evt_refund_001`, scenario `timeout_after_refund`, seed `demo-v1`, two deliveries, two refund effects, and **Fail**.
8. Select **Repair with live Codex**. Watch the elapsed timer, progress bar, five-stage status row, and signed event feed. A fresh run typically takes one to three minutes and can take up to about six; the timer and signed events keep updating the whole time.
9. Confirm the accepted artifact says **Fresh Codex**, shows a truncated thread identifier and attempt count, and lists the deterministic validator checks.
10. Select **Replay the identical suite** and confirm the same event, scenario, seed, and two deliveries now produce one refund effect and **Pass**.
11. Inspect the **Proof Flight Recorder**. Its before/after workflow paths, four-scenario matrix, changed nodes, and evidence references are derived from the accepted run data; the graph also has a text alternative and the raw JSON patch remains available as a disclosure.
12. Select **Download evidence ZIP** and inspect its patch, provenance, before/after hashes, and limitations.

Expected completion time: typically three to five minutes after the page loads, and up to about eight if the fresh Codex run uses its full budget.

## Supported platforms

- Hosted judge path: current Safari, Chrome, Edge, or Firefox with JavaScript enabled.
- Source development: Node.js 20.x and pnpm 9.x on macOS or Linux.
- Production persistence: PostgreSQL 15+.
- Input: pinned supported n8n declarative workflow JSON up to 1 MiB.

## Boundaries

- The judge path is entirely synthetic and makes zero real network side effects.
- The seeded analysis contract is cached and labeled; the repair is fresh only when its provenance says **Fresh Codex** and includes a live thread identifier.
- A green result applies only to the approved invariant, exact snapshot, fixture, and declared deterministic fault model.
- RetryProof does not prove exactly-once execution or production safety.

## If the hosted path is unavailable

Use the public video and current Proof Flight Recorder screenshot first. The source repository contains the product, API, worker, tests, and exact setup instructions. A local rebuild is optional and follows the root README; it requires Node.js 20.x, pnpm 9.x, and PostgreSQL. The judge path is designed so a local rebuild is not required.
