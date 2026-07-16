import {
  AFFECTED_AREA_ACTIONS,
  PROMPT_TOOLS,
  RISK_SEVERITIES,
} from "@workspace/db/schema";
import type { DemoReportShape } from "./demo-report";

export type ReportValidationResult =
  | { ok: true }
  | { ok: false; reasons: string[] };

/**
 * Structural validation of an LLM-produced report. Returns human-readable
 * reasons instead of a bare boolean so the retry path can tell the model
 * exactly what to fix instead of blindly re-sending the identical prompt.
 */
export function validateReport(value: unknown): ReportValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, reasons: ["response must be a JSON object"] };
  }
  const reasons: string[] = [];
  const r = value as Record<string, unknown>;

  for (const key of ["architectureSummary", "mermaidGraph", "rolloutNotes"]) {
    if (typeof r[key] !== "string") reasons.push(`${key} must be a string`);
  }

  if (!Array.isArray(r.riskyAssumptions)) {
    reasons.push("riskyAssumptions must be an array");
  } else {
    r.riskyAssumptions.forEach((risk, i) => {
      if (!risk || typeof risk !== "object") {
        reasons.push(`riskyAssumptions[${i}] must be an object`);
        return;
      }
      const item = risk as Record<string, unknown>;
      if (typeof item.title !== "string")
        reasons.push(`riskyAssumptions[${i}].title must be a string`);
      if (typeof item.detail !== "string")
        reasons.push(`riskyAssumptions[${i}].detail must be a string`);
      if (
        typeof item.severity !== "string" ||
        !RISK_SEVERITIES.includes(item.severity as never)
      ) {
        reasons.push(
          `riskyAssumptions[${i}].severity must be one of ${RISK_SEVERITIES.join(", ")}`,
        );
      }
      // evidence is optional — absent on reports from before citations shipped
      // and omitted when nothing concrete backs the risk.
      if (item.evidence !== undefined && item.evidence !== null) {
        if (!Array.isArray(item.evidence)) {
          reasons.push(`riskyAssumptions[${i}].evidence must be an array when present`);
        } else {
          item.evidence.forEach((ev, j) => {
            if (!ev || typeof ev !== "object") {
              reasons.push(`riskyAssumptions[${i}].evidence[${j}] must be an object`);
              return;
            }
            const e = ev as Record<string, unknown>;
            if (typeof e.path !== "string" || e.path.length === 0)
              reasons.push(
                `riskyAssumptions[${i}].evidence[${j}].path must be a non-empty string`,
              );
            if (e.quote !== undefined && e.quote !== null && typeof e.quote !== "string")
              reasons.push(
                `riskyAssumptions[${i}].evidence[${j}].quote must be a string when present`,
              );
            if (e.verified !== undefined && typeof e.verified !== "boolean")
              reasons.push(
                `riskyAssumptions[${i}].evidence[${j}].verified must be a boolean when present`,
              );
          });
        }
      }
    });
  }

  if (!Array.isArray(r.acceptanceCriteria)) {
    reasons.push("acceptanceCriteria must be an array");
  } else {
    r.acceptanceCriteria.forEach((crit, i) => {
      if (!crit || typeof crit !== "object") {
        reasons.push(`acceptanceCriteria[${i}] must be an object`);
        return;
      }
      const item = crit as Record<string, unknown>;
      if (typeof item.title !== "string")
        reasons.push(`acceptanceCriteria[${i}].title must be a string`);
      if (typeof item.detail !== "string")
        reasons.push(`acceptanceCriteria[${i}].detail must be a string`);
    });
  }

  if (!r.promptPack || typeof r.promptPack !== "object") {
    reasons.push("promptPack must be an object");
  } else {
    const pack = r.promptPack as Record<string, unknown>;
    for (const tool of PROMPT_TOOLS) {
      if (typeof pack[tool] !== "string")
        reasons.push(`promptPack.${tool} must be a string`);
    }
  }

  if (!r.testPlan || typeof r.testPlan !== "object") {
    reasons.push("testPlan must be an object with vitest and playwright strings");
  } else {
    const tp = r.testPlan as Record<string, unknown>;
    if (typeof tp.vitest !== "string" || tp.vitest.trim().length === 0)
      reasons.push("testPlan.vitest must be a non-empty string");
    if (typeof tp.playwright !== "string" || tp.playwright.trim().length === 0)
      reasons.push("testPlan.playwright must be a non-empty string");
  }

  // affectedAreas is optional — null/absent on reports from before the
  // blast-radius feature shipped.
  if (r.affectedAreas !== undefined && r.affectedAreas !== null) {
    if (!Array.isArray(r.affectedAreas)) {
      reasons.push("affectedAreas must be an array when present");
    } else {
      r.affectedAreas.forEach((area, i) => {
        if (!area || typeof area !== "object") {
          reasons.push(`affectedAreas[${i}] must be an object`);
          return;
        }
        const a = area as Record<string, unknown>;
        if (typeof a.path !== "string" || a.path.length === 0)
          reasons.push(`affectedAreas[${i}].path must be a non-empty string`);
        if (typeof a.reason !== "string")
          reasons.push(`affectedAreas[${i}].reason must be a string`);
        if (
          typeof a.action !== "string" ||
          !AFFECTED_AREA_ACTIONS.includes(a.action as never)
        ) {
          reasons.push(
            `affectedAreas[${i}].action must be one of ${AFFECTED_AREA_ACTIONS.join(", ")}`,
          );
        }
      });
    }
  }

  return reasons.length > 0 ? { ok: false, reasons } : { ok: true };
}

/** Thin boolean wrapper kept for callsites/tests that only need a type guard. */
export function isValidReport(value: unknown): value is DemoReportShape {
  return validateReport(value).ok;
}
