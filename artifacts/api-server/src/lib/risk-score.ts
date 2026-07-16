import type { RiskyAssumption, Verdict } from "@workspace/db";

// NOTE: the report view's risk gauge mirrors these bands (safe <25,
// caution 25–59, block >=60) and the critical-floor-at-70 rule — see
// artifacts/neverguess/src/components/report-view.tsx (RISK_ZONES).
// Keep both sides in sync when adjusting the scoring.
export function computeRiskScore(risks: RiskyAssumption[]): {
  score: number;
  verdict: Verdict;
} {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const r of risks) {
    const sev = r.severity as keyof typeof counts;
    if (counts[sev] !== undefined) counts[sev]++;
  }

  let score: number;
  if (counts.critical > 0) {
    // any critical => 70+
    const extra = (counts.critical - 1) * 8 + counts.high * 4 + counts.medium * 2 + counts.low;
    score = Math.min(100, 70 + extra);
  } else if (counts.high > 0) {
    // any high (no crit) => 40+ (capped just below the critical band)
    const extra = (counts.high - 1) * 8 + counts.medium * 4 + counts.low * 2;
    score = Math.min(69, 40 + extra);
  } else if (counts.medium > 0) {
    // medium-only => 20–39
    const extra = (counts.medium - 1) * 5 + counts.low * 2;
    score = Math.min(39, 20 + extra);
  } else {
    // low-only => 0–19
    score = Math.min(19, counts.low * 4);
  }

  const verdict: Verdict =
    score >= 60 ? "block" : score >= 25 ? "caution" : "safe";
  return { score, verdict };
}
