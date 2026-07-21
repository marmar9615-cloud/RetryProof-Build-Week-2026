# RetryProof — Devpost submission copy

> Final submission copy for the verified private-worker production architecture. Live-worker claims are bound to the recorded production acceptance evidence in `submission/VERIFICATION.md`.

## Title

RetryProof

## Tagline

Break your automation before retries do.

## Track

Developer Tools

## Short description

RetryProof imports a sanitized n8n workflow, lets GPT-5.6 propose a user-approved reliability contract, deterministically exposes retry failures, and asks Codex for a bounded repair that must pass the identical fault fixture before it earns a green receipt.

## Approximately 100 words

The refund succeeds, but its response is lost, so the platform retries it and creates a duplicate effect. RetryProof turns that hidden failure into a reproducible flight test. GPT-5.6 proposes the side effect, business key, invariant, and relevant retry scenarios from a sanitized workflow. A human approves the contract before testing. Deterministic simulation records the red counterexample: two synthetic refunds for one event. Codex returns a bounded reservation patch. Validators replay the same event, seed, fault, and two deliveries to produce one effect. Black Box Replay exposes the decisive trace divergence, while a downloadable capsule preserves the approved contract, paired traces, repair, canonical receipt, and per-file SHA-256 manifest.

## Longer project description

### The problem

Automation retries are necessary, but a response can disappear after a consequential write already succeeded. When the delivery is retried, an apparently healthy workflow can repeat a refund, notification, provisioning action, or back-office mutation. This is not hypothetical infrastructure trivia: [Stripe documents automatic webhook retries for up to three days, duplicate delivery, and no ordering guarantee](https://docs.stripe.com/webhooks), while [n8n lets operators retry failed workflow executions with the previous execution data](https://docs.n8n.io/workflows/executions/all-executions/). Happy-path testing rarely makes the dangerous gap visible, while broad claims such as “exactly once” are not defensible without system-specific assumptions.

### The solution

RetryProof is a mock-only reliability workbench for a pinned declarative slice of n8n. It imports workflow JSON in memory, strips credential references and non-executable metadata, rejects inline secrets, and reports exact compatibility coverage. GPT-5.6 receives only the canonical sanitized graph and proposes a structured risk contract: consequential effect, candidate business key, invariant, and supported fault scenarios. The model cannot run a test or issue a verdict. A human must approve the invariant first.

The deterministic simulator then executes only declared node semantics, mock HTTP routes, a logical clock, a reservation store, and a side-effect ledger. In the seeded refund scenario, delivery one records a mock refund and loses the response. The same event is delivered again. Before repair, the ledger records two refund effects for `evt_refund_001`, so the approved at-most-once invariant fails.

For a live repair, the public API sends only the sanitized graph, approved invariant, failing trace, and exact fixture to a separate private worker. Replit’s private-deployment gateway and a deployment-scoped access token restrict reachability; independent HMAC signatures bind the request, progress stream, and candidate and reject replay. The worker launches a fresh Codex SDK thread in a bounded temporary workspace with network and web search disabled. Codex may return only an explanation, exactly eight bounded RFC 6902 patch operations, and exactly five changed-node IDs. The worker then binds the trusted request fixture; the fixture is deliberately excluded from the model’s output schema. Deterministic validation checks the source hash, invariant ID, patch paths, graph structure, secret safety, change claims, and fixture identity. RetryProof translates the exact patched graph and reruns the same event, seed, scenario, and two deliveries. The repaired run records one mock refund and passes the declared invariant. If the worker is unavailable, the UI offers a clearly labeled validated fallback that is never represented as a fresh Codex run.

The downloadable reproducibility capsule contains the sanitized source, synthetic fixture, **approved** contract, before/after executions, bounded patch, repaired workflow, canonical receipt, explicit limitations, and a deterministic manifest. Every manifest entry records its path, byte length, and SHA-256 digest, and `receiptSha256` matches the canonical receipt digest. This proves byte consistency inside the downloaded capsule; it does not establish signer identity. A green receipt means only that the approved invariant passed the declared deterministic scenarios. RetryProof never claims exactly-once execution or production safety and never performs a real external action.

Unlike a webhook mock, RetryProof does not stop at replaying requests. It tracks business-keyed effects across multiple declared fault phases, binds an accepted repair to the exact failing fixture, and proves the same schedule turns green under a deterministic oracle.

### Why GPT-5.6 and Codex are central

GPT-5.6 performs the semantic work ordinary rule matching cannot do reliably across differently named and mapped workflows: it proposes which supported write is consequential, traces a plausible business key, cites exact graph evidence, and selects relevant supported faults. Grounding code rejects invented nodes and paths, and the user owns approval.

Codex performs constrained repository-like repair work rather than chat: it reads the sanitized workflow, failure trace, invariant, and a machine-readable repair contract; returns a minimal patch plus changed-node manifest; and is accepted only after the worker binds the trusted fixture and deterministic replay turns green. GPT-5.6 proposes, Codex repairs, deterministic software proves.

### What judges can run

The hosted judge path requires no account and no rebuild. Select **Load seeded workflow**, then **Analyze retry risk**. The seeded proposal is an explicitly labeled cached GPT-5.6-informed contract; a supported custom upload exercises live GPT-5.6 analysis. Inspect and approve the at-most-once invariant, run the four-scenario suite, review the red two-effect timeout trace, select **Repair with live Codex**, follow the signed five-stage progress feed, and replay the identical suite. The Proof Flight Recorder derives its before/after graph, four-scenario matrix, changed nodes, and evidence references from that run. Black Box Replay then finds the first unequal accepted trace event—duplicate effect before, reservation conflict after—without inventing data. Judges can download the canonical receipt alone or the complete reproducibility capsule with its per-file manifest.

## How we built it

RetryProof is a TypeScript/React application with strict schemas at every untrusted boundary. The importer canonicalizes a pinned n8n subset and fails closed on unsupported executable nodes. GPT-5.6 uses the OpenAI Responses API with structured output and no tools. The simulator is a deterministic state machine with mock adapters, explicit fault phases, logical time, a side-effect ledger, and an invariant oracle. The public API calls a separate private Replit worker using a deployment access token plus HMAC-bound requests. Codex uses the Codex SDK in a temporary workspace with disabled network/web search, no interactive approval, a bounded output contract, and a per-run ephemeral loopback credential proxy. PostgreSQL stores anonymous sanitized session state with operation and network rate limits. The product streams real, signature-verified progress events while a repair runs and does not accept a candidate until deterministic replay passes.

Codex accelerated scaffolding, implementation across import/simulator/platform/UI boundaries, test generation, repair-contract design, private-worker debugging, documentation, and production verification. For the final release, one agent owned the bounded feature implementation while separate agents independently reviewed technical/security correctness and the judge experience; their objections had to clear before merge. The key human decisions were to narrow the supported semantics, keep all effects mock-only, require approval before testing, bind repair to the exact failure fixture, and give verdict authority only to deterministic code.

## My contribution

I designed RetryProof’s product boundaries and built the end-to-end TypeScript/React system with Codex: sanitizer, deterministic simulator, GPT-5.6 grounding, private Codex worker, validation chain, judge UX, deployment, and release verification.

## Challenges we ran into

- Binding the green result to the exact graph shown to the user, rather than a pre-authored repaired simulator fixture.
- Preserving retry semantics while translating a reservation-plus-branch n8n graph into deterministic executable nodes.
- Letting Codex be useful without letting it execute untrusted workflow data, use the network, or broaden its patch surface.
- Keeping a deterministic fallback reliable without representing a cached artifact as newly generated.
- Keeping every claim bounded to a declared fault model instead of drifting into “exactly once” or production-certification language.

## Accomplishments

- A complete five-stage product journey from import through downloadable evidence.
- A reproducible red-to-green proof: two deliveries create two mock effects before repair and one after repair.
- Live GPT-5.6 structured analysis with grounded node evidence.
- Live Codex repair through a separately deployed private worker, accepted only by strict source, patch, fixture, secret, and deterministic replay validators.
- Exact source/fixture/scenario binding across before and after executions.
- A data-derived Proof Flight Recorder that turns the validated source graph, patched graph, all four scenario results, changed-node manifest, and run identifiers into an accessible before/after explanation.
- A data-derived Black Box Replay that isolates the exact accepted trace event where the unsafe and repaired executions diverge.
- A reproducibility capsule with the human-approved contract, paired traces, bounded repair, canonical receipt, and deterministic path/length/SHA-256 manifest.
- Secret rejection, credential-reference stripping, human approval, rate limits, expiring sessions, and mock-only execution.
- A production Replit topology with a public Autoscale app, PostgreSQL persistence, and a separately deployed private Reserved VM worker; the older non-root Docker image remains a tested standalone reference package.

## What we learned

Models are most valuable here when their authority is deliberately limited. GPT-5.6 is strong at proposing a semantic contract from a graph, and Codex is strong at producing a coherent multi-artifact repair. Neither should decide whether the system is correct. The memorable result comes from composing those capabilities with explicit approval, deterministic execution, strict validation, and honest evidence boundaries.

## What is next

- Expand the pinned declarative support matrix one node contract at a time.
- Add more invariant oracles beyond at-most-once effects.
- Publish a larger labeled semantic evaluation set before making production-quality inference metrics.
- Add provider-specific reservation setup assistants while keeping credentials and real effects outside RetryProof.
- Integrate evidence receipts into pull-request review and CI for supported workflows.

## Technology list

- OpenAI GPT-5.6 through the Responses API
- OpenAI Codex SDK
- TypeScript
- React and Express
- Strict structured schemas
- PostgreSQL
- Replit Autoscale and private Reserved VM deployments
- Vitest and Testing Library
- RFC 6902 JSON Patch
- n8n declarative workflow exports

## URLs and required identifiers

- Hosted demo: `https://marmarlabs.com/retryproof/lab/`
- Repository: `https://github.com/marmar9615-cloud/RetryProof-Build-Week-2026`
- Public YouTube video: `https://youtu.be/4Oaie-WLKAc`
- Majority-core Codex `/feedback` Session ID: `019f5e19-b54f-7862-8023-f0f4251a5a0f`

## Judging-criteria mapping

### Technological Implementation

GPT-5.6 and Codex each have a real, distinct, constrained role. The imported and repaired graphs are exact; deterministic code owns every verdict; and the Replit Autoscale/PostgreSQL/private-worker path is live and judge-accessible without a rebuild.

### Design

The product is a coherent five-stage workbench, not a chat surface or isolated proof of concept. It has first-run guidance, approval gates, loading/error states, signed repair progress, keyboard focus handoff, repair review, cached/live provenance, and judge-ready synthetic data. The Proof Flight Recorder gives dense validator output a responsive graph, text alternative, four-scenario table, human repair summary, and secondary raw-JSON disclosure. Black Box Replay makes the decisive trace change legible in one scan, and the reproducibility capsule lets a judge verify every listed evidence file without overstating what that verification means.

### Potential Impact

RetryProof addresses a specific expensive failure mode for automation builders: duplicated consequential side effects after retries. Stripe says webhook delivery can retry for up to three days, arrive out of order, and occasionally duplicate. n8n builders are actively asking how to [guarantee exactly-once side effects](https://community.n8n.io/t/guarantee-exactly-once-side-effects/270350) and [safely replay failed production steps](https://community.n8n.io/t/best-practice-for-centralized-error-handling-and-retry-from-failed-step-in-production-workflows/300785). RetryProof makes one narrow part of that risk testable before deployment: a bounded workflow snapshot, human-approved invariant, declared fault schedule, and reviewable repair.

### Quality of the Idea

The differentiated wedge is a model-assisted but deterministically adjudicated flight test. The same event, seed, fault, and deliveries are bound across red and green runs, while every screen repeats the evidence limitations.
