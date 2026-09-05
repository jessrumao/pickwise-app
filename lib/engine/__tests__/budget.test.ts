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

    // Priority order: protein (8) > creatine (7) > omega-3 (5) > multivitamin (4).
    // Naive total (1999 + 799 + 1200 + 525 = 4523) exceeds the 3000 budget,
    // and neither omega-3 (algal-oil) nor multivitamin has a cheaper
    // alternative SKU in the catalogue today, so both defer rather than
    // bumping cheaper protein/creatine out of priority order.
    const fundedIds = budget.funded.map((b) => b.recommendation.compoundId ?? b.recommendation.ingredientId);
    const deferredIds = budget.deferred.map((b) => b.recommendation.compoundId ?? b.recommendation.ingredientId);

    expect(fundedIds).toEqual(["protein-complete", "creatine-monohydrate"]);
    expect(deferredIds).toEqual(["epa-dha", "multivitamin"]);
    expect(budget.totalFundedCostINR).toBe(2798);
    expect(budget.totalDeferredCostINR).toBe(1725);
    expect(budget.deferred.every((d) => d.priceINR > 0)).toBe(true); // deferred items still carry their price
    expect(budget.budgetIsHardConstraint).toBe(true);

    // Price-blind, priority order preserved -- creatine (799) is cheaper than
    // protein (1999) but is NOT funded first.
    expect(budget.funded[0].recommendation.compoundId).toBe("protein-complete");
  });
});
