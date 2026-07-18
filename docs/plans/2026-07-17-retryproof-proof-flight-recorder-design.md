# RetryProof Proof Flight Recorder design

## Goal

Make the judged red-to-green proof understandable in one scan without changing RetryProof's execution, model, repair, security, or verdict boundaries. The page should show what changed in the workflow, how the same four declared scenarios behaved before and after the repair, and which hashes bind the evidence.

## Product truth

- RetryProof verifies a user-approved invariant under a declared deterministic fault model. It does not prove exactly-once execution or production safety.
- GPT-5.6 proposes a grounded contract; a human approves it; Codex proposes a bounded repair; the deterministic simulator and validators own every verdict.
- Workflow content is untrusted data and must render only as escaped text.
- Cached or deterministic fallback artifacts must never be labeled as freshly generated model output.
- The private worker, deployment token chain, prompts, repair schema, validator, and timeout ladder are unchanged by this release.

## Experience

The existing five-step journey remains intact. After the repaired workflow passes, the evidence stage becomes a compact Proof Flight Recorder:

1. A concrete stake reminds the judge that the seeded event is a synthetic $42 refund.
2. A before/after workflow view is derived from the canonical source graph and the validated patched graph. The after view highlights the inserted reservation path and duplicate-delivery diversion.
3. A four-row scenario matrix compares the actual before and after `scenarioResults` for the same declared scenarios.
4. Proof references show the source workflow hash, approved plan hash, repaired workflow hash, and evidence receipt hash from the returned resources. The UI does not imply that fields absent from the signed receipt are cryptographically chained.
5. A short human summary explains the repair. Raw JSON remains available as a secondary disclosure.

No diagram or verdict is hard-coded independently of returned workflow, repair, execution, or receipt data. Graph traversal is bounded and cycle-safe because uploaded connections are untrusted. The visualization is a view of already validated resources, not a second source of truth.

## Accessibility and responsiveness

- The recorder includes a text/table alternative; color is never the only verdict signal.
- Node names and untrusted strings render as React text, never HTML.
- Small screens use stacked cards and horizontally scrollable graph lanes without hiding content.
- Existing focus/auto-scroll behavior is retained. Motion continues to respect `prefers-reduced-motion`.
- Copy and receipt actions expose accessible labels and visible success feedback.

## Provenance and copy corrections

- Build Week baseline provenance points to the submitted integrated merge commit `2dd084ccae57f54300e959ff444ba976f5d1b78f`; it is not described as the perpetually current implementation commit.
- The internal validator check ID `source_fixture_failed` remains unchanged but is displayed as `Red confirmed on source`.
- Deterministic fallback repair is displayed as `Validated fallback · not a fresh Codex run`.

## Verification

- Add focused engine coverage for the corrected source commit.
- Add focused UI tests for stage behavior and pure derivation/label helpers.
- Run the NeverGuess tests, typecheck, and build plus API engine/route tests.
- Have an independent technical reviewer inspect data derivation, security boundaries, accessibility, and the final diff.
- Have an independent judge reviewer inspect desktop/mobile live output and submission story.
- Only after both reviews pass: commit and push personal GitHub main, guard the public Replit republish, verify health and the no-account red-to-green journey, then update the existing Devpost submission.
