import { describe, it, expect } from "vitest";
import { buildDecisionRecordPayload } from "@/lib/decision-mapping";
import { generateRecommendations } from "@/lib/engine";
import { userProfileSchema } from "@/types/engine";
import vegetarianMuscleGain from "@/data/tools/samples/vegetarian-muscle-gain.json";
import unparseableMedications from "@/data/tools/samples/unparseable-medications.json";

describe("buildDecisionRecordPayload", () => {
  it("splits a normal RecommendationResult into trace/recommendation/budget/escalations", () => {
    const profile = userProfileSchema.parse(vegetarianMuscleGain);
    const result = generateRecommendations(profile);

    const payload = buildDecisionRecordPayload(result);

    expect(payload.escalations).toEqual([]);
    expect(payload.recommendation).toBe(result.recommendations);
    expect(payload.budgetOutcome).toBe(result.budget);
    expect(payload.trace.safety).toBe(result.safety);
    expect(payload.trace.perRecommendation).toHaveLength(result.recommendations.length);
    for (const [i, entry] of payload.trace.perRecommendation.entries()) {
      expect(entry.policyId).toBe(result.recommendations[i].policyId);
      expect(entry.eligibilityTrace).toBe(result.recommendations[i].eligibilityTrace);
    }
  });

  it("captures a global escalation and produces no recommendations/budget", () => {
    const profile = userProfileSchema.parse(unparseableMedications);
    const result = generateRecommendations(profile);

    const payload = buildDecisionRecordPayload(result);

    expect(result.globalEscalation).toBeDefined();
    expect(payload.escalations).toEqual([result.globalEscalation]);
    expect(payload.recommendation).toEqual([]);
    expect(payload.budgetOutcome).toBeNull();
  });
});
