# RetryProof demo transcript — 1:59 production cut

## 0:00–0:10 — Hook

Retry bugs hide behind successful happy paths. RetryProof turns one into a controlled, repeatable flight test.

## 0:10–0:27 — Import

I start with a synthetic n8n refund workflow. RetryProof inspects only supported structure and synthetic data. It does not execute uploaded code, contact the network, or call a real payment service. Inline secrets are rejected before storage.

## 0:27–0:45 — GPT-5.6 contract

The seeded judge path uses an honestly labeled cached GPT-5.6 contract so anyone can reproduce the demo. The custom-workflow path is separately live-verified with GPT-5.6 Sol. In both paths, the model may propose a grounded effect, business key, invariant, and fault scenarios, but it cannot approve the contract or decide a verdict.

## 0:45–0:53 — Human approval

That decision belongs to a human. I approve one narrow invariant: for each event ID, create at most one refund effect across retries.

## 0:53–1:07 — Red counterexample

Now the deterministic simulator injects a timeout after the first mock refund commits. The response disappears, the platform retries, and the same event creates a second effect. Same event, one declared fault, two deliveries, two effects. The contract is red.

## 1:07–1:28 — Codex repair

I ask the private Codex worker for one bounded repair. A fresh Codex SDK thread runs with high reasoning in a read-only, network-disabled sandbox. It receives sanitized data and may return only the declared patch shape. Codex does not get to mark its own work correct.

The wait is compressed here. Worker-side validators bind the source hash and trusted fixture, reject undeclared paths or secrets, and replay the exact counterexample before accepting the candidate.

## 1:28–1:43 — Identical green rerun

The repair adds a durable reservation before the refund and binds idempotency to the event ID. The identical seed, fault, and two deliveries now produce one effect. Before: two and fail. After: one and pass.

## 1:43–1:54 — Evidence

The downloadable receipt binds the source, approved invariant, scenario, traces, repair, validation results, and limitations. This proves only the declared deterministic scenario, not production exactly-once safety.

## 1:54–1:59 — Close

GPT-5.6 proposes. A human approves. Codex repairs. Deterministic software proves. That is RetryProof.
