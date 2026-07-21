# Submission asset checklist

## Required production screenshot set

- [x] `screenshots/01-import.png` is an archived earlier-production capture of the sanitized five-node demo, `5/5` support coverage, and source binding.
- [x] `screenshots/02-contract.png` is an archived earlier-production capture of the approval gate and effect/key/oracle contract.
- [x] `screenshots/03-red-counterexample.png` is an archived earlier-production capture of the primary timeout trace: same event, two deliveries, two effects, fail.
- [x] `screenshots/04-codex-repair.png` is an archived earlier-production capture of an accepted **Fresh Codex** artifact, validator checks, and truncated thread provenance.
- [x] `screenshots/05-green-comparison.png` is an archived earlier-production capture of the before `2/fail` and after `1/pass` comparison.
- [x] `screenshots/06-evidence-receipt.png` is an archived earlier-production capture of the evidence receipt and download control.
- [x] `screenshots/07-proof-flight-recorder.png` shows the prior deployed data-derived before/after workflow paths, accepted repair summary, and live/cached provenance labels. It predates the July 20 Black Box Replay and capsule controls and is not presented as proof of those additions.
- [x] `screenshots/08-black-box-replay-production.png` is the July 20 clean production capture of the current `2 → 1` result, reproducibility-capsule control, accepted before/after paths, and data-derived Black Box Replay.

Screenshots 01–06 preserve the earlier production walkthrough and are intentionally labeled archived; they contain older provenance labels and identifiers and are not the source of truth for the current release. Screenshot 07 captures the mobile-contained Proof Flight Recorder before the July 20 judge-readable evidence update. Screenshot 08, the byte-verified files under `submission/evidence/`, the hosted lab, and `submission/VERIFICATION.md` are authoritative for current behavior and run identifiers.

## Image rules

- 16:9 or a consistent wide crop; minimum 1280×720.
- No unrelated tabs, email address, account avatar, API-key page, notification, terminal, or private URL.
- Synthetic values only.
- Cached/live provenance visible wherever an agent artifact is shown.
- Keep the “not exactly-once or production safety” boundary visible in the green/evidence views or immediately adjacent submission copy. Screenshot 07 is recorder-focused and is paired with that boundary in the README.

## Thumbnail

- [x] `thumbnail/retryproof-thumbnail.png`
- Main copy: `ONE RETRY. TWO REFUNDS.`
- Proof copy: `2 effects → 1`
- Footer: `GPT-5.6 proposes · Codex repairs · deterministic proof`
- No OpenAI or n8n logo treatment that implies endorsement.

## Video package

- [x] Final production cut `video/retryproof-demo-final.mp4` is 1:59.300 and strictly under 3:00.
- [x] The final visibly shows the red trace, live repair action, fresh Codex acceptance, identical green replay, and receipt.
- [x] `video/transcript.md` and `video/captions.srt` match the final production recording.
- [x] `video/YOUTUBE.md`.
- [x] Final audio level, caption timing, codecs, resolution, and duration were re-verified after replacement.
- [x] Public YouTube playback verified anonymously at `https://youtu.be/4Oaie-WLKAc`; oEmbed identifies the expected title and MarMar Labs channel.

## External placeholders still requiring real values

- [x] Hosted HTTPS URL: `https://marmarlabs.com/retryproof/lab/`.
- [x] Public judge repository: `https://github.com/marmar9615-cloud/RetryProof-Build-Week-2026`.
- [x] Public YouTube URL: `https://youtu.be/4Oaie-WLKAc`.
- [x] `/feedback` Codex Session ID: `019f5e19-b54f-7862-8023-f0f4251a5a0f`.
