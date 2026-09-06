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
// The budget is a MONTHLY constraint, and every candidate/alternative here
// already carries `monthlyCostINR` — the real cost of buying however many
// whole packs cover this month's need (lib/engine/monthly-cost.ts) — so all
// fit-checks and totals below compare monthly cost, never the flat per-pack
// `priceINR` (which is kept only for display, e.g. "3 packs x ₹599").
//
// FLEXIBLE-BUDGET RULE (product decision, replacing the earlier "fund every
// overage no matter how large" reading of budgetIsHardConstraint=false, i.e.
// "show slightly over-budget options too" per user-profile.schema.json's
// questionnaireText): a flexible user gets a bounded extra headroom, min(15%
// of budgetINR, ₹1000), added to the total basket cap — enough to let ONE
// more genuinely-needed item squeeze in, not unlimited spending. It applies
// to the TOTAL basket, not per item: funded total <= budgetINR + headroomINR.

import type { UserProfile, Recommendation, BasketItem, BudgetOutcome, ProductId } from "@/types/engine";

export interface BasketCandidate {
  recommendation: Recommendation; // must already carry priorityScore and servingPlan
  productId: ProductId;
  priceINR: number; // per-pack price, display only
  packsPerMonth: number;
  monthlyCostINR: number; // the number this allocator actually budgets against
  // Other products that could deliver the same recommendation, cheapest-first
  // is NOT assumed — this module sorts them. Only ever populated with
  // products that already satisfy the quality floor (i.e. their serving plan
  // was computed the same way and still meets minEffectiveDose) — computing
  // that is dosing.ts's job, not this module's.
  alternativeProducts: Array<{ productId: ProductId; priceINR: number; packsPerMonth: number; monthlyCostINR: number }>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const FLEXIBLE_BUDGET_HEADROOM_PERCENT = 0.15;
const FLEXIBLE_BUDGET_HEADROOM_MAX_INR = 1000;

export function allocateBudget(candidates: BasketCandidate[], profile: UserProfile): BudgetOutcome {
  const budgetINR = profile.monthlyBudgetINR;
  const hardConstraint = profile.budgetIsHardConstraint ?? true;
  const headroomINR =
    budgetINR != null && !hardConstraint
      ? Math.min(budgetINR * FLEXIBLE_BUDGET_HEADROOM_PERCENT, FLEXIBLE_BUDGET_HEADROOM_MAX_INR)
      : 0;
  // The real cap fit-checks run against — plain budgetINR when hard (or
  // unset), budgetINR + headroomINR when flexible.
  const effectiveBudgetINR = budgetINR != null ? budgetINR + headroomINR : undefined;

  // Priority order preserved — NEVER re-sorted by price. Stable sort keeps
  // the original (eligibility-stage) order for ties.
  const byPriority = [...candidates].sort(
    (a, b) => (b.recommendation.priorityScore?.total ?? 0) - (a.recommendation.priorityScore?.total ?? 0)
  );

  const funded: BasketItem[] = [];
  const deferred: BasketItem[] = [];
  let spent = 0;

  for (const candidate of byPriority) {
    const remaining = effectiveBudgetINR != null ? effectiveBudgetINR - spent : Infinity;

    let productId = candidate.productId;
    let priceINR = candidate.priceINR;
    let packsPerMonth = candidate.packsPerMonth;
    let monthlyCostINR = candidate.monthlyCostINR;
    let downgradedFromProductId: ProductId | undefined;

    if (effectiveBudgetINR != null && monthlyCostINR > remaining) {
      const fits = candidate.alternativeProducts
        .filter((alt) => alt.monthlyCostINR <= remaining)
        .sort((a, b) => a.monthlyCostINR - b.monthlyCostINR)[0];
      if (fits) {
        downgradedFromProductId = productId;
        productId = fits.productId;
        priceINR = fits.priceINR;
        packsPerMonth = fits.packsPerMonth;
        monthlyCostINR = fits.monthlyCostINR;
      }
    }

    const item: BasketItem = {
      recommendation: candidate.recommendation,
      productId,
      priceINR,
      packsPerMonth,
      monthlyCostINR,
      priorityScore: candidate.recommendation.priorityScore ?? { gapTier: 0, evidenceTier: 0, goalAlignment: 0, total: 0 },
      downgradedFromProductId,
    };

    const fitsBudget = effectiveBudgetINR == null || monthlyCostINR <= remaining;
    if (fitsBudget) {
      funded.push(item);
      spent += monthlyCostINR;
    } else {
      deferred.push(item); // still carries its cost — never silently dropped
    }
  }

  return {
    budgetINR,
    budgetIsHardConstraint: hardConstraint,
    headroomINR: round2(headroomINR),
    funded,
    deferred,
    totalFundedCostINR: round2(spent),
    totalDeferredCostINR: round2(deferred.reduce((sum, d) => sum + d.monthlyCostINR, 0)),
  };
}
