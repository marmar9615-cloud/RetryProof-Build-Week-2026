import { describe, it, expect } from "vitest";
import { computeRiskScore } from "../risk-score";

describe("computeRiskScore", () => {
  it("returns safe/0 for an empty list", () => {
    expect(computeRiskScore([])).toEqual({ score: 0, verdict: "safe" });
  });

  it("blocks on any single critical (>= 70)", () => {
    const r = computeRiskScore([
      { title: "x", severity: "critical", detail: "d" },
    ]);
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.verdict).toBe("block");
  });

  it("cautions or blocks on any single high (>= 40)", () => {
    const r = computeRiskScore([
      { title: "x", severity: "high", detail: "d" },
    ]);
    expect(r.score).toBeGreaterThanOrEqual(40);
    expect(["caution", "block"]).toContain(r.verdict);
  });

  it("medium-only stays in 20–39 (caution or safe)", () => {
    const r = computeRiskScore([
      { title: "a", severity: "medium", detail: "d" },
      { title: "b", severity: "medium", detail: "d" },
    ]);
    expect(r.score).toBeGreaterThanOrEqual(20);
    expect(r.score).toBeLessThan(40);
  });

  it("low-only stays in 0–19 and is safe", () => {
    const r = computeRiskScore([
      { title: "a", severity: "low", detail: "d" },
      { title: "b", severity: "low", detail: "d" },
      { title: "c", severity: "low", detail: "d" },
    ]);
    expect(r.score).toBeLessThan(20);
    expect(r.verdict).toBe("safe");
  });

  it("caps at 100", () => {
    const many = Array.from({ length: 10 }, () => ({
      title: "x",
      severity: "critical" as const,
      detail: "d",
    }));
    expect(computeRiskScore(many).score).toBe(100);
  });
});
