import { describe, it, expect } from "vitest";
import { validateReport, isValidReport } from "../report-validation";
import { DEMO_REPORT } from "../demo-report";

function reasonsOf(value: unknown): string[] {
  const result = validateReport(value);
  return result.ok ? [] : result.reasons;
}

describe("validateReport", () => {
  it("accepts the bundled demo report", () => {
    expect(validateReport(DEMO_REPORT)).toEqual({ ok: true });
  });

  it("rejects non-objects with a single top-level reason", () => {
    for (const value of [null, undefined, "hello", 42, ["a"]]) {
      expect(reasonsOf(value)).toEqual(["response must be a JSON object"]);
    }
  });

  it("names each missing top-level string field", () => {
    const { architectureSummary: _a, rolloutNotes: _r, ...rest } = DEMO_REPORT;
    const reasons = reasonsOf(rest);
    expect(reasons).toContain("architectureSummary must be a string");
    expect(reasons).toContain("rolloutNotes must be a string");
    expect(reasons).not.toContain("mermaidGraph must be a string");
  });

  it("reports an unknown severity with its index", () => {
    const bad = {
      ...DEMO_REPORT,
      riskyAssumptions: [{ title: "x", detail: "y", severity: "catastrophic" }],
    };
    const reasons = reasonsOf(bad);
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain("riskyAssumptions[0].severity");
  });

  it("rejects malformed evidence entries with pointed reasons", () => {
    const bad = {
      ...DEMO_REPORT,
      riskyAssumptions: [
        {
          title: "x",
          detail: "y",
          severity: "low",
          evidence: [{ path: 42 }, { path: "ok.ts", quote: 7 }],
        },
      ],
    };
    const reasons = reasonsOf(bad);
    expect(reasons).toContain(
      "riskyAssumptions[0].evidence[0].path must be a non-empty string",
    );
    expect(reasons).toContain(
      "riskyAssumptions[0].evidence[1].quote must be a string when present",
    );
  });

  it("rejects non-array evidence but tolerates absent evidence", () => {
    const bad = {
      ...DEMO_REPORT,
      riskyAssumptions: [
        { title: "x", detail: "y", severity: "low", evidence: "nope" },
      ],
    };
    expect(reasonsOf(bad)).toContain(
      "riskyAssumptions[0].evidence must be an array when present",
    );
    const fine = {
      ...DEMO_REPORT,
      riskyAssumptions: [{ title: "x", detail: "y", severity: "low" }],
    };
    expect(validateReport(fine).ok).toBe(true);
  });

  it("validates affectedAreas structure and action enum when present", () => {
    const bad = {
      ...DEMO_REPORT,
      affectedAreas: [
        { path: "a.ts", reason: "why", action: "delete" },
        { path: "", reason: 3, action: "modify" },
      ],
    };
    const reasons = reasonsOf(bad);
    expect(reasons.some((r) => r.startsWith("affectedAreas[0].action"))).toBe(true);
    expect(reasons).toContain("affectedAreas[1].path must be a non-empty string");
    expect(reasons).toContain("affectedAreas[1].reason must be a string");
  });

  it("tolerates null or absent affectedAreas (legacy reports)", () => {
    expect(validateReport({ ...DEMO_REPORT, affectedAreas: null }).ok).toBe(true);
    const { affectedAreas: _aa, ...withoutAreas } = DEMO_REPORT;
    expect(validateReport(withoutAreas).ok).toBe(true);
  });

  it("rejects a non-array affectedAreas", () => {
    const bad = { ...DEMO_REPORT, affectedAreas: "everything" };
    expect(reasonsOf(bad)).toContain("affectedAreas must be an array when present");
  });

  it("collects multiple reasons in one pass", () => {
    const bad = {
      ...DEMO_REPORT,
      mermaidGraph: 42,
      promptPack: { replit: "ok" },
      testPlan: { vitest: "", playwright: "ok" },
    };
    const reasons = reasonsOf(bad);
    expect(reasons.length).toBeGreaterThanOrEqual(3);
    expect(reasons).toContain("mermaidGraph must be a string");
    expect(reasons).toContain("promptPack.cursor must be a string");
    expect(reasons).toContain("testPlan.vitest must be a non-empty string");
  });
});

describe("isValidReport wrapper", () => {
  it("mirrors validateReport's verdict", () => {
    expect(isValidReport(DEMO_REPORT)).toBe(true);
    expect(isValidReport({})).toBe(false);
  });
});
