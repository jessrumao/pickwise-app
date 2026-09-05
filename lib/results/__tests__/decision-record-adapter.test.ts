// Verifies adaptDecisionRecord() against a REAL captured response from
// POST /api/decisions (fixtures/real-decision-response.json) — not a
// hand-built fixture — obtained by actually running the intake -> /api/profile
// -> /api/decisions chain against a live Neon database while wiring Package
// E to Package C's real persistence. Guards against the wire shape silently
// drifting from what buildDecisionRecordPayload (lib/decision-mapping.ts)
// actually produces once it round-trips through Postgres jsonb.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { adaptDecisionRecord } from "@/lib/results/decision-record-adapter";
import type { DecisionRecordPayload } from "@/lib/decision-mapping";

const fixture = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures/real-decision-response.json"), "utf-8")
) as { decisionRecord: DecisionRecordPayload };

describe("adaptDecisionRecord against a real captured /api/decisions response", () => {
  it("reshapes it back into a usable RecommendationResult", () => {
    const result = adaptDecisionRecord(fixture.decisionRecord);
    expect(result.globalEscalation).toBeUndefined(); // this profile had none
    expect(result.recommendations.length).toBe(6);
    expect(result.recommendations.map((r) => r.status)).toContain("recommended");
    expect(result.budget).toBeDefined();
    expect(result.budget!.funded.length).toBeGreaterThan(0);
    expect(result.safety.escalations).toEqual([]);
  });
});
