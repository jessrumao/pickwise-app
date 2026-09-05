import { describe, it, expect } from "vitest";
import { computePriorityScore, computeGoalAlignment } from "../priority";
import { generateRecommendations } from "../recommend";
import vegetarianMuscleGain from "@/data/tools/samples/vegetarian-muscle-gain.json";
import type { UserProfile } from "@/types/engine";

const P = (x: unknown) => x as UserProfile;

describe("priority scoring", () => {
  it("additive formula reproduces the decisions-doc worked example exactly", () => {
    expect(computePriorityScore({ gapTier: 3, evidenceTier: 3, goalAlignment: 2 }).total).toBe(8); // protein
    expect(computePriorityScore({ gapTier: 2, evidenceTier: 3, goalAlignment: 2 }).total).toBe(7); // creatine
    expect(computePriorityScore({ gapTier: 1, evidenceTier: 2, goalAlignment: 1 }).total).toBe(4); // omega-3
  });

  it("goalAlignment is derived from real goals->outcomes data, not hardcoded", () => {
    const profile = P(vegetarianMuscleGain); // primaryGoals: [muscle_gain, general_wellness]
    // protein cites lean_mass + muscle_strength claims, both under muscle_gain (index 0) -> primary
    expect(computeGoalAlignment(profile, ["protein-lean-mass-resistance-trained", "protein-strength-resistance-trained"])).toBe(2);
    // omega-3's general-population claim is cardiovascular_events, under general_wellness (index 1) -> secondary
    expect(computeGoalAlignment(profile, ["epa-dha-general-population-cv-prevention"])).toBe(1);
    // bcaa's claim (lean_mass) IS under muscle_gain even though bcaa is never recommended -- alignment is about the claim's outcome, independent of eligibility
    expect(computeGoalAlignment(profile, ["bcaa-no-incremental-benefit-over-complete-protein"])).toBe(2);
    // a claim whose outcome maps to no goal the user stated
    expect(computeGoalAlignment(profile, ["lgg-antibiotic-associated-diarrhoea"])).toBe(0);
  });

  it("end to end: recommendations carry a priorityScore once fully resolved", () => {
    const result = generateRecommendations(P(vegetarianMuscleGain));
    const protein = result.recommendations.find((r) => r.compoundId === "protein-complete")!;
    expect(protein.priorityScore).toEqual({ gapTier: 3, evidenceTier: 3, goalAlignment: 2, total: 8 });
  });
});
