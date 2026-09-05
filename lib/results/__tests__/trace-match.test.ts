// Regression test for a real bug found while wiring Package E to Package
// C's real /api/decisions: findMatchingEscalation used to compare
// `escalation.trace === rec.safetyTrace` by reference, which only ever
// worked because generateRecommendations() keeps everything in one
// in-memory call. Once a RecommendationResult is persisted to Postgres
// jsonb and read back as fresh JSON, that reference is gone even though the
// values are identical. Simulates that round trip directly.
import { describe, expect, it } from "vitest";
import { generateRecommendations } from "@/lib/engine";
import { DEMO_PROFILES } from "@/lib/results/demo-profiles";
import { findMatchingEscalation } from "@/lib/results/trace-match";

describe("findMatchingEscalation survives a JSON round trip (simulating jsonb persistence)", () => {
  it("still finds the right escalation after serializing and re-parsing the whole result", () => {
    const demo = DEMO_PROFILES.find((d) => d.id === "escalate-demo")!;
    const result = generateRecommendations(demo.profile);

    // Round-trip through JSON, same as Postgres jsonb storage + a later
    // fetch does — this is what breaks reference equality.
    const roundTripped = JSON.parse(JSON.stringify(result)) as typeof result;

    const epaDha = roundTripped.recommendations.find((r) => r.compoundId === "epa-dha")!;
    expect(epaDha.status).toBe("escalate");

    // Reference equality would fail here — these are different objects now.
    expect(epaDha.safetyTrace).not.toBe(
      result.recommendations.find((r) => r.compoundId === "epa-dha")!.safetyTrace
    );

    const escalation = findMatchingEscalation(epaDha, roundTripped.safety.escalations);
    expect(escalation?.policyId).toBe("safety-epa-dha-anticoagulant");
    expect(escalation?.userMessage).toBeTruthy();
  });

  it("returns undefined for a recommendation with no safetyTrace", () => {
    const demo = DEMO_PROFILES.find((d) => d.id === "vegetarian-muscle-gain")!;
    const result = generateRecommendations(demo.profile);
    const protein = result.recommendations.find((r) => r.compoundId === "protein-complete")!;
    expect(findMatchingEscalation(protein, result.safety.escalations)).toBeUndefined();
  });
});
