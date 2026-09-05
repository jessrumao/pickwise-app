import { describe, it, expect } from "vitest";
import { generateRecommendations } from "../recommend";
import vegetarianMuscleGain from "@/data/tools/samples/vegetarian-muscle-gain.json";
import type { UserProfile } from "@/types/engine";

const P = (x: unknown) => x as UserProfile;

describe("budget allocator, end to end on vegetarian-muscle-gain (budget: 3000 INR, hard)", () => {
  it("funds in priority order (never cheapest-first) until the budget runs out, defers the rest with price shown", () => {
    const result = generateRecommendations(P(vegetarianMuscleGain));
    expect(result.budget).toBeDefined();
    const budget = result.budget!;

    // Priority order: protein (8) > creatine (7) > magnesium (5) > omega-3 (4) > multivitamin (4).
    // This profile (muscle_gain, trains 4x/week) now also qualifies for
    // magnesium under elig-magnesium's exercise-frequency clause, and it
    // resolves to its own dedicated product (hkvitals-magnesium-glycinate),
    // not the multivitamin bundle SKU that used to collide with it.
    // Naive total (1999 + 799 + 789 + 1200 + 525 = 5312) exceeds the 3000
    // budget, and none of magnesium/omega-3(algal-oil)/multivitamin has a
    // cheaper alternative SKU in the catalogue today, so all three defer
    // rather than bumping cheaper protein/creatine out of priority order.
    const fundedIds = budget.funded.map((b) => b.recommendation.compoundId ?? b.recommendation.ingredientId);
    const deferredIds = budget.deferred.map((b) => b.recommendation.compoundId ?? b.recommendation.ingredientId);

    expect(fundedIds).toEqual(["protein-complete", "creatine-monohydrate"]);
    expect(deferredIds).toEqual(["magnesium", "epa-dha", "multivitamin"]);
    expect(budget.totalFundedCostINR).toBe(2798);
    expect(budget.totalDeferredCostINR).toBe(2514);
    expect(budget.deferred.every((d) => d.priceINR > 0)).toBe(true); // deferred items still carry their price
    expect(budget.budgetIsHardConstraint).toBe(true);

    // Price-blind, priority order preserved -- creatine (799) is cheaper than
    // protein (1999) but is NOT funded first.
    expect(budget.funded[0].recommendation.compoundId).toBe("protein-complete");
  });
});
