import { describe, it, expect } from "vitest";
import { allocateBudget, type BasketCandidate } from "../budget";
import { generateRecommendations } from "../recommend";
import vegetarianMuscleGain from "@/data/tools/samples/vegetarian-muscle-gain.json";
import type { Recommendation, UserProfile } from "@/types/engine";

const P = (x: unknown) => x as UserProfile;

// Synthetic candidates with hand-chosen, round numbers — deliberately NOT
// derived from the real product catalogue, so every expected value here is
// exact arithmetic anyone can re-check by hand, independent of catalogue
// prices/pack sizes drifting over time. The real-catalogue integration test
// further below checks structural invariants instead of hardcoded totals,
// for the same reason.
function candidate(
  priorityTotal: number,
  productId: string,
  priceINR: number,
  packsPerMonth: number,
  alternativeProducts: BasketCandidate["alternativeProducts"] = []
): BasketCandidate {
  const recommendation = {
    policyId: `policy-${productId}`,
    status: "recommended",
    grade: "Strong",
    why: "test",
    eligibilityTrace: {} as never,
    priorityScore: { gapTier: 0, evidenceTier: 0, goalAlignment: 0, total: priorityTotal },
  } as unknown as Recommendation;

  return {
    recommendation,
    productId,
    priceINR,
    packsPerMonth,
    monthlyCostINR: priceINR * packsPerMonth,
    alternativeProducts,
  };
}

const profile = (overrides: Partial<UserProfile>): UserProfile =>
  P({ monthlyBudgetINR: undefined, budgetIsHardConstraint: true, ...overrides });

describe("allocateBudget: monthly-cost fit-check", () => {
  it("funds an item whose real monthly cost (packs x price) fits the budget", () => {
    // 2 packs x ₹500 = ₹1000/month, budget ₹1000 — fits exactly.
    const outcome = allocateBudget([candidate(1, "a", 500, 2)], profile({ monthlyBudgetINR: 1000 }));
    expect(outcome.funded.map((f) => f.productId)).toEqual(["a"]);
    expect(outcome.totalFundedCostINR).toBe(1000);
  });

  it("defers an item whose flat pack price looks affordable but real monthly cost (multiple packs) doesn't fit", () => {
    // ₹500/pack looks well within a ₹900 budget, but 2 packs/month = ₹1000
    // actually needed — this is exactly the bug the pack-aware fix corrects.
    const outcome = allocateBudget([candidate(1, "a", 500, 2)], profile({ monthlyBudgetINR: 900 }));
    expect(outcome.funded).toHaveLength(0);
    expect(outcome.deferred.map((d) => d.productId)).toEqual(["a"]);
    expect(outcome.deferred[0].monthlyCostINR).toBe(1000); // still carries its real cost, never dropped silently
  });

  it("preserves priority order, never re-sorts by price (a cheaper lower-priority item never jumps ahead)", () => {
    const cheaper = candidate(1, "cheap", 100, 1); // priority 1, ₹100/mo
    const pricier = candidate(5, "pricier", 900, 1); // priority 5, ₹900/mo
    const outcome = allocateBudget([cheaper, pricier], profile({ monthlyBudgetINR: 900 }));
    // Only enough budget for one item — must be the HIGHER-priority one, not the cheaper one.
    expect(outcome.funded.map((f) => f.productId)).toEqual(["pricier"]);
    expect(outcome.deferred.map((d) => d.productId)).toEqual(["cheap"]);
  });

  it("downgrades to an alternative by real monthly cost, not flat per-pack price", () => {
    // Top pick: ₹100/pack but needs 3 packs/month = ₹300/mo — doesn't fit a ₹250 budget.
    // Alternative: ₹120/pack (pricier per pack!) but only needs 1 pack/month = ₹120/mo — fits, and is the
    // real cheapest-by-monthly-cost option, even though it looks worse "per pack".
    const alt = { productId: "alt", priceINR: 120, packsPerMonth: 1, monthlyCostINR: 120 };
    const outcome = allocateBudget(
      [candidate(1, "top", 100, 3, [alt])],
      profile({ monthlyBudgetINR: 250 })
    );
    expect(outcome.funded).toHaveLength(1);
    expect(outcome.funded[0].productId).toBe("alt");
    expect(outcome.funded[0].downgradedFromProductId).toBe("top");
    expect(outcome.totalFundedCostINR).toBe(120);
  });
});

describe("allocateBudget: flexible-budget headroom (budgetIsHardConstraint: false)", () => {
  it("adds min(15% of budget, ₹1000) as extra headroom on the TOTAL basket, not unlimited overage", () => {
    // budget 1000, hard=false -> headroom = min(150, 1000) = 150 -> effective cap 1150.
    const outcome = allocateBudget(
      [candidate(1, "a", 1100, 1)],
      profile({ monthlyBudgetINR: 1000, budgetIsHardConstraint: false })
    );
    expect(outcome.headroomINR).toBe(150);
    expect(outcome.funded.map((f) => f.productId)).toEqual(["a"]); // 1100 <= 1150, fits within headroom
  });

  it("still defers an item beyond the headroom — flexible is bounded, not unlimited", () => {
    const outcome = allocateBudget(
      [candidate(1, "a", 1200, 1)],
      profile({ monthlyBudgetINR: 1000, budgetIsHardConstraint: false })
    );
    expect(outcome.funded).toHaveLength(0);
    expect(outcome.deferred.map((d) => d.productId)).toEqual(["a"]); // 1200 > 1150 effective cap
  });

  it("caps headroom at ₹1000 even when 15% of a large budget would be more", () => {
    // budget 20000 -> 15% = 3000, capped to 1000 -> effective cap 21000, not 23000.
    const outcome = allocateBudget(
      [candidate(1, "a", 21000, 1), candidate(0, "b", 23000, 1)],
      profile({ monthlyBudgetINR: 20000, budgetIsHardConstraint: false })
    );
    expect(outcome.headroomINR).toBe(1000);
    expect(outcome.funded.map((f) => f.productId)).toEqual(["a"]);
    expect(outcome.deferred.map((d) => d.productId)).toEqual(["b"]);
  });

  it("adds zero headroom when hard constraint is true, regardless of the flag's absence/presence elsewhere", () => {
    const outcome = allocateBudget([candidate(1, "a", 1100, 1)], profile({ monthlyBudgetINR: 1000 }));
    expect(outcome.headroomINR).toBe(0);
    expect(outcome.funded).toHaveLength(0);
    expect(outcome.deferred.map((d) => d.productId)).toEqual(["a"]);
  });

  it("adds zero headroom when no budget is set at all, even if flexible", () => {
    const outcome = allocateBudget(
      [candidate(1, "a", 999999, 1)],
      profile({ monthlyBudgetINR: undefined, budgetIsHardConstraint: false })
    );
    expect(outcome.headroomINR).toBe(0);
    expect(outcome.funded.map((f) => f.productId)).toEqual(["a"]); // no budget at all -> everything funded
  });
});

describe("budget allocator, end to end on vegetarian-muscle-gain (real catalogue, budget: 3000 INR, hard)", () => {
  it("funds in priority order (never cheapest-first), respects the monthly-cost budget cap, defers the rest with real cost shown", () => {
    const result = generateRecommendations(P(vegetarianMuscleGain));
    expect(result.budget).toBeDefined();
    const budget = result.budget!;

    // Structural invariants — real catalogue prices/pack sizes can drift, so
    // this deliberately does NOT hardcode which items end up funded or their
    // exact totals (see the synthetic-candidate tests above for that level
    // of precision against numbers this file controls).
    expect(budget.budgetIsHardConstraint).toBe(true);
    expect(budget.headroomINR).toBe(0); // hard constraint -> no headroom regardless of budget size

    // Never exceeds the (here, un-extended) budget.
    expect(budget.totalFundedCostINR).toBeLessThanOrEqual(budget.budgetINR!);
    // totalFundedCostINR is exactly the sum of what's actually in `funded`.
    expect(budget.totalFundedCostINR).toBe(
      Math.round(budget.funded.reduce((sum, f) => sum + f.monthlyCostINR, 0) * 100) / 100
    );
    expect(budget.totalDeferredCostINR).toBe(
      Math.round(budget.deferred.reduce((sum, d) => sum + d.monthlyCostINR, 0) * 100) / 100
    );

    // Priority order preserved WITHIN each list (never re-sorted by price) —
    // NOT across the two combined: a higher-priority item can legitimately
    // end up in `deferred` while a lower-priority one that's cheaper fits
    // and lands in `funded` (exactly what pack-aware pricing can now cause —
    // see the synthetic tests above for that behavior in isolation).
    for (const list of [budget.funded, budget.deferred]) {
      for (let i = 1; i < list.length; i++) {
        expect(list[i - 1].priorityScore.total).toBeGreaterThanOrEqual(list[i].priorityScore.total);
      }
    }

    // Deferred items still carry their real monthly cost — never silently dropped.
    expect(budget.deferred.every((d) => d.monthlyCostINR > 0)).toBe(true);
    // Every funded/deferred item reflects a whole number of packs — you can't buy half a pack.
    expect([...budget.funded, ...budget.deferred].every((i) => Number.isInteger(i.packsPerMonth) && i.packsPerMonth >= 1)).toBe(true);

    // Protein still resolves to muscleblaze-biozyme-whey-1kg (the real
    // cheapest-by-monthly-cost pick — see dosing.test.ts) regardless of
    // whether it ends up funded or deferred here. It is NOT asserted as
    // funded: at 1.5 servings/day it needs 2 packs/month (₹3598), which on
    // its own already exceeds this profile's ₹3000 budget — a real,
    // correct consequence of pack-aware monthly pricing (you can't buy 1.5
    // tubs), not a bug. Which items actually clear a given budget once
    // multiple real products compete for it is exactly what the structural
    // invariants above check, without hardcoding today's catalogue prices.
    const proteinItem = [...budget.funded, ...budget.deferred].find(
      (i) => i.recommendation.compoundId === "protein-complete"
    );
    expect(proteinItem?.productId).toBe("muscleblaze-biozyme-whey-1kg");
  });
});
