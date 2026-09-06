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
//
// PARTIAL-MONTH DOWNGRADE (product decision, 2026-09-07): the ideal quantity
// is a FULL month's supply — but when that doesn't fit, the old behavior was
// all-or-nothing: defer the item entirely, even if every brand was tried.
// That's wrong when a shorter runway of the SAME (or a cheaper) product
// would still fit and still deliver the correct per-serving dose. Every
// candidate/alternative below carries `quantityOptions` — every real,
// purchasable quantity from 1 pack up to the ideal (lib/engine/monthly-cost.ts) —
// and the downgrade search below picks whichever (product, quantity)
// combination covers the MOST of the month while still fitting the
// remaining budget, searching across every brand AND every quantity of each
// brand together, never just one axis alone.

import type { UserProfile, Recommendation, BasketItem, BudgetOutcome, ProductId } from "@/types/engine";
import type { QuantityOption } from "./monthly-cost";

interface CandidateProduct {
  productId: ProductId;
  priceINR: number; // per-pack price, display only
  packsPerMonth: number; // the IDEAL (full month) pack count
  monthlyCostINR: number; // the IDEAL cost — what fitsBudget checks against first
  // Every real purchasable quantity of THIS product, 1 pack up to the ideal
  // above (so it always includes an entry equal to {packsPerMonth, monthlyCostINR}
  // at coverageFraction 1). Never empty when packsPerMonth > 0.
  quantityOptions: QuantityOption[];
}

export interface BasketCandidate extends CandidateProduct {
  recommendation: Recommendation; // must already carry priorityScore and servingPlan
  // Other products that could deliver the same recommendation, cheapest-first
  // is NOT assumed — this module sorts them. Only ever populated with
  // products that already satisfy the quality floor (i.e. their serving plan
  // was computed the same way and still meets minEffectiveDose) — computing
  // that is dosing.ts's job, not this module's.
  alternativeProducts: CandidateProduct[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const FLEXIBLE_BUDGET_HEADROOM_PERCENT = 0.15;
const FLEXIBLE_BUDGET_HEADROOM_MAX_INR = 1000;

// One purchasable (product, quantity) combination, flattened out of a
// candidate's own quantityOptions plus every alternative's — the actual
// search space the downgrade step picks from.
interface PurchaseOption {
  productId: ProductId;
  priceINR: number;
  packsPerMonth: number;
  monthlyCostINR: number;
  coverageFraction: number;
  isOriginalProduct: boolean; // true only for the top-priority pick's own options
}

function allPurchaseOptions(candidate: BasketCandidate): PurchaseOption[] {
  const options: PurchaseOption[] = candidate.quantityOptions.map((q) => ({
    productId: candidate.productId,
    priceINR: candidate.priceINR,
    ...q,
    isOriginalProduct: true,
  }));
  for (const alt of candidate.alternativeProducts) {
    for (const q of alt.quantityOptions) {
      options.push({ productId: alt.productId, priceINR: alt.priceINR, ...q, isOriginalProduct: false });
    }
  }
  return options;
}

/**
 * Best (product, quantity) combination that fits `remaining` — maximizes
 * coverage first (more of the month covered beats a fatter margin under
 * budget), then prefers staying with the original top-priority product over
 * switching brands, then cheapest. Returns undefined when nothing at all
 * (not even 1 pack of the cheapest brand) fits.
 */
function bestFittingOption(candidate: BasketCandidate, remaining: number): PurchaseOption | undefined {
  const fitting = allPurchaseOptions(candidate).filter((o) => o.monthlyCostINR <= remaining);
  if (fitting.length === 0) return undefined;
  fitting.sort((a, b) => {
    if (b.coverageFraction !== a.coverageFraction) return b.coverageFraction - a.coverageFraction;
    if (a.isOriginalProduct !== b.isOriginalProduct) return a.isOriginalProduct ? -1 : 1;
    return a.monthlyCostINR - b.monthlyCostINR;
  });
  return fitting[0];
}

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
    let coverageFraction = 1;
    let downgradedFromProductId: ProductId | undefined;

    if (effectiveBudgetINR != null && monthlyCostINR > remaining) {
      // The ideal, full-month quantity of the top-priority product doesn't
      // fit — search every (brand, quantity) combination together, not just
      // "try a cheaper brand at ITS full month" or "try fewer packs of THIS
      // brand" in isolation.
      const best = bestFittingOption(candidate, remaining);
      if (best) {
        downgradedFromProductId = best.isOriginalProduct ? undefined : productId;
        productId = best.productId;
        priceINR = best.priceINR;
        packsPerMonth = best.packsPerMonth;
        monthlyCostINR = best.monthlyCostINR;
        coverageFraction = best.coverageFraction;
      }
    }

    const item: BasketItem = {
      recommendation: candidate.recommendation,
      productId,
      priceINR,
      packsPerMonth,
      monthlyCostINR,
      coverageFraction,
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
