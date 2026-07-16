import { describe, expect, it } from "vitest";
import { renderVerdictBadge } from "../badge-svg";

describe("renderVerdictBadge", () => {
  it("renders an SVG element with width/height", () => {
    const svg = renderVerdictBadge({ verdict: "safe", score: 22 });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toMatch(/width="\d+"/);
    expect(svg).toMatch(/height="22"/);
  });

  it("includes the verdict label and score", () => {
    const svg = renderVerdictBadge({ verdict: "block", score: 75 });
    expect(svg).toContain("BLOCK");
    expect(svg).toContain("75");
  });

  it("falls back to safe when verdict is unknown", () => {
    const svg = renderVerdictBadge({ verdict: "weird", score: 0 });
    expect(svg).toContain("SAFE");
  });

  it("clamps the score into [0,100]", () => {
    const negative = renderVerdictBadge({ verdict: "safe", score: -10 });
    expect(negative).toContain(">SAFE · 0<");
    const huge = renderVerdictBadge({ verdict: "block", score: 9000 });
    expect(huge).toContain(">BLOCK · 100<");
  });

  it("escapes XML to prevent SVG injection", () => {
    const svg = renderVerdictBadge({
      verdict: "<script>alert(1)</script>" as unknown as string,
      score: 0,
    });
    expect(svg).not.toContain("<script>");
    // Should fall back to SAFE since the bad verdict won't match
    expect(svg).toContain("SAFE");
  });

  it("renders the neverguess label on the left", () => {
    const svg = renderVerdictBadge({ verdict: "caution", score: 48 });
    expect(svg).toContain(">neverguess<");
    expect(svg).toContain("CAUTION");
  });
});
