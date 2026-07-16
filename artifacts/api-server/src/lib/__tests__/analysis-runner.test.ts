import { describe, it, expect } from "vitest";
import { isValidReport } from "../report-validation";
import { DEMO_REPORT } from "../demo-report";
import { DEMO_REPO } from "../demo-repo";

describe("isValidReport", () => {
  it("accepts the bundled demo report", () => {
    expect(isValidReport(DEMO_REPORT)).toBe(true);
  });

  it("rejects nullish or non-object values", () => {
    expect(isValidReport(null)).toBe(false);
    expect(isValidReport(undefined)).toBe(false);
    expect(isValidReport("hello")).toBe(false);
  });

  it("rejects an unknown severity", () => {
    const bad = {
      ...DEMO_REPORT,
      riskyAssumptions: [
        { title: "x", detail: "y", severity: "catastrophic" },
      ],
    };
    expect(isValidReport(bad)).toBe(false);
  });

  it("rejects a missing prompt-pack tool", () => {
    const bad = {
      ...DEMO_REPORT,
      promptPack: { replit: "ok", cursor: "ok" },
    };
    expect(isValidReport(bad)).toBe(false);
  });

  it("rejects an acceptance criterion with a non-string detail", () => {
    const bad = {
      ...DEMO_REPORT,
      acceptanceCriteria: [{ title: "ok", detail: 42 }],
    };
    expect(isValidReport(bad)).toBe(false);
  });
});

// The demo report bypasses the server-side citation check (it never goes
// through the LLM path), so these tests keep the fixture honest against the
// demo repo it claims to describe.
describe("demo report fixture honesty", () => {
  const tree = new Set(DEMO_REPO.fileTree);

  it("cites only paths that exist in the demo repo tree, pre-stamped verified", () => {
    const evidence = DEMO_REPORT.riskyAssumptions.flatMap((r) => r.evidence ?? []);
    expect(evidence.length).toBeGreaterThanOrEqual(2);
    for (const e of evidence) {
      expect(tree.has(e.path), `evidence path missing from demo tree: ${e.path}`).toBe(true);
      expect(e.verified).toBe(true);
    }
  });

  it("quotes text that literally appears in the demo repo fixture", () => {
    for (const risk of DEMO_REPORT.riskyAssumptions) {
      for (const e of risk.evidence ?? []) {
        if (e.quote == null) continue;
        const file = DEMO_REPO.files.find((f) => f.path === e.path);
        expect(file?.content, `quoted file has no content: ${e.path}`).toBeTruthy();
        expect(file?.content).toContain(e.quote);
      }
    }
  });

  it("keeps affectedAreas modify/read paths inside the demo repo tree", () => {
    const areas = DEMO_REPORT.affectedAreas ?? [];
    expect(areas.length).toBeGreaterThanOrEqual(3);
    expect(areas.length).toBeLessThanOrEqual(10);
    for (const area of areas) {
      if (area.action === "create") continue;
      expect(tree.has(area.path), `affected area missing from demo tree: ${area.path}`).toBe(true);
    }
  });
});
