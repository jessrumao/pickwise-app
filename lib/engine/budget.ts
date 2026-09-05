// lib/engine/budget.ts
//
// The budget allocator. Not implemented anywhere in data/tools/demo.mjs
// (its header comment lists stage 12 as "WORK PACKAGE B") — this is a fresh
// implementation against data-layer-decisions-v2.md's spec:
//
//   Runs strictly AFTER the recommendation set and priority order are fixed.
//   Price-blind: it funds in PRIORITY order, never cheapest-first. Anything
//   that doesn't fit is "deferred" with its price shown, never silently
//   dropped. A downgrade to a cheaper SKU is allowed only above the quality
//   floor (still meets the required effective dose — dose-met is the only
//   gate, there is no separate third-party-testing requirement).
//
// FLAGGED INTERPRETATION (the spec is silent on the exact mechanics, so this
// is Package B's own reasonable reading, not a re-litigation of a settled
// decision): when budgetIsHardConstraint is false ("show slightly over-budget
// options too" per user-profile.schema.json's questionnaireText), an item
// that doesn't fit even after a downgrade attempt is still funded rather than
// deferred, on the reading that the user explicitly opted out of a hard cap.
// Package E may want a distinct "near-miss" display state rather than lumping
// every soft-constraint overage into plain "funded" — that's a UI decision
// this engine output doesn't need to make for it.

import type { UserProfile, Recommendation, BasketItem, BudgetOutcome, ProductId } from "@/types/engine";

export interface BasketCandidate {
  recommendation: Recommendation; // must already carry priorityScore and servingPlan
  productId: ProductId;
  priceINR: number;
  // Other products that could deliver the same recommendation, cheapest-first
  // is NOT assumed — this module sorts them. Only ever populated with
  // products that already satisfy the quality floor (i.e. their serving plan
  // was computed the same way and still meets minEffectiveDose) — computing
  // that is dosing.ts's job, not this module's.
  alternativeProducts: Array<{ productId: ProductId; priceINR: number }>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function allocateBudget(candidates: BasketCandidate[], profile: UserProfile): BudgetOutcome {
  const budgetINR = profile.monthlyBudgetINR;
  const hardConstraint = profile.budgetIsHardConstraint ?? true;

  // Priority order preserved — NEVER re-sorted by price. Stable sort keeps
  // the original (eligibility-stage) order for ties.
  const byPriority = [...candidates].sort(
    (a, b) => (b.recommendation.priorityScore?.total ?? 0) - (a.recommendation.priorityScore?.total ?? 0)
  );

  const funded: BasketItem[] = [];
  const deferred: BasketItem[] = [];
  let spent = 0;

  for (const candidate of byPriority) {
    const remaining = budgetINR != null ? budgetINR - spent : Infinity;

    let productId = candidate.productId;
    let priceINR = candidate.priceINR;
    let downgradedFromProductId: ProductId | undefined;

    if (budgetINR != null && priceINR > remaining) {
      const fits = candidate.alternativeProducts
        .filter((alt) => alt.priceINR <= remaining)
        .sort((a, b) => a.priceINR - b.priceINR)[0];
      if (fits) {
        downgradedFromProductId = productId;
        productId = fits.productId;
        priceINR = fits.priceINR;
      }
    }

    const item: BasketItem = {
      recommendation: candidate.recommendation,
      productId,
      priceINR,
      priorityScore: candidate.recommendation.priorityScore ?? { gapTier: 0, evidenceTier: 0, goalAlignment: 0, total: 0 },
      downgradedFromProductId,
    };

    const fitsBudget = budgetINR == null || priceINR <= remaining;
    if (fitsBudget || !hardConstraint) {
      funded.push(item);
      spent += priceINR;
    } else {
      deferred.push(item); // still carries its price — never silently dropped
    }
  }

  return {
    budgetINR,
    budgetIsHardConstraint: hardConstraint,
    funded,
    deferred,
    totalFundedCostINR: round2(spent),
    totalDeferredCostINR: round2(deferred.reduce((sum, d) => sum + d.priceINR, 0)),
  };
}
