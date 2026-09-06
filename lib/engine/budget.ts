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
// and the search below picks whichever (product, quantity) combination
// covers the MOST of the month while still fitting the budget it's given,
// searching across every brand AND every quantity of each brand together,
// never just one axis alone.
//
// BREADTH BEFORE DEPTH (product decision, 2026-09-07): pure single-pass
// priority-greedy had a real failure mode — the top-priority item's own
// IDEAL (a full month, possibly several packs) often fits the budget ALL BY
// ITSELF, so it consumed nearly the whole thing before any other item was
// even considered, leaving a well-established, cheap, high-priority item
// (e.g. creatine) deferred to zero next to an almost-fully-spent budget.
// That's the opposite of "the best supplements that go well together" — a
// basket where everything shows up, even if not every item gets its full
// ideal quantity, beats one item maxed out and everything else dropped.
// So allocation runs in two passes:
//   Pass 1 (breadth) — in priority order, give every item its CHEAPEST
//     viable (brand, quantity) combination that fits what's left. This
//     deliberately minimizes each item's spend so later, lower-priority
//     items still get a real chance to appear at all.
//   Pass 2 (depth) — in priority order again, spend whatever's left
//     upgrading already-funded items toward their ideal, highest priority
//     first (and reverting to the original brand over a same-coverage
//     cheaper one, once there's room to do so without any coverage cost).
// An item that couldn't afford even 1 pack of its cheapest option in pass 1
// is deferred outright — pass 2 never rescues it, since by then the budget
// is already committed to items that DID get a foothold.

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
 * Best (product, quantity) combination that fits `budget` — maximizes
 * coverage first (more of the month covered beats a fatter margin under
 * budget), then prefers the original top-priority product over an
 * equally-covering alternative, then cheapest. Returns undefined when
 * nothing at all (not even 1 pack of the cheapest brand) fits.
 */
function bestFittingOption(candidate: BasketCandidate, budget: number): PurchaseOption | undefined {
  const fitting = allPurchaseOptions(candidate).filter((o) => o.monthlyCostINR <= budget);
  if (fitting.length === 0) return undefined;
  fitting.sort((a, b) => {
    if (b.coverageFraction !== a.coverageFraction) return b.coverageFraction - a.coverageFraction;
    if (a.isOriginalProduct !== b.isOriginalProduct) return a.isOriginalProduct ? -1 : 1;
    return a.monthlyCostINR - b.monthlyCostINR;
  });
  return fitting[0];
}

/**
 * Cheapest (product, quantity) combination that fits `budget` — the pass-1
 * pick, deliberately minimizing spend (not maximizing coverage) so later,
 * lower-priority items still have a real chance at some budget. Ties
 * (equal cost) prefer the original top-priority product. Returns undefined
 * when nothing at all fits — not even 1 pack of the cheapest brand.
 */
function cheapestFittingOption(candidate: BasketCandidate, budget: number): PurchaseOption | undefined {
  const fitting = allPurchaseOptions(candidate).filter((o) => o.monthlyCostINR <= budget);
  if (fitting.length === 0) return undefined;
  fitting.sort((a, b) => {
    if (a.monthlyCostINR !== b.monthlyCostINR) return a.monthlyCostINR - b.monthlyCostINR;
    if (a.isOriginalProduct !== b.isOriginalProduct) return a.isOriginalProduct ? -1 : 1;
    return 0;
  });
  return fitting[0];
}

function idealOption(candidate: BasketCandidate): PurchaseOption {
  return {
    productId: candidate.productId,
    priceINR: candidate.priceINR,
    packsPerMonth: candidate.packsPerMonth,
    monthlyCostINR: candidate.monthlyCostINR,
    coverageFraction: 1,
    isOriginalProduct: true,
  };
}

function itemFrom(candidate: BasketCandidate, option: PurchaseOption): BasketItem {
  return {
    recommendation: candidate.recommendation,
    productId: option.productId,
    priceINR: option.priceINR,
    packsPerMonth: option.packsPerMonth,
    monthlyCostINR: option.monthlyCostINR,
    coverageFraction: option.coverageFraction,
    priorityScore: candidate.recommendation.priorityScore ?? { gapTier: 0, evidenceTier: 0, goalAlignment: 0, total: 0 },
    downgradedFromProductId: option.isOriginalProduct ? undefined : candidate.productId,
  };
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

  // No budget at all -> nothing to ration; everyone gets their own ideal.
  if (effectiveBudgetINR == null) {
    const funded = byPriority.map((c) => itemFrom(c, idealOption(c)));
    const totalFundedCostINR = round2(funded.reduce((sum, f) => sum + f.monthlyCostINR, 0));
    return {
      budgetINR,
      budgetIsHardConstraint: hardConstraint,
      headroomINR: 0,
      funded,
      deferred: [],
      totalFundedCostINR,
      totalDeferredCostINR: 0,
    };
  }

  let spent = 0;
  const picks = new Map<BasketCandidate, PurchaseOption>();

  // Pass 1 — breadth: everyone gets their cheapest viable option first.
  for (const candidate of byPriority) {
    const remaining = effectiveBudgetINR - spent;
    const cheapest = cheapestFittingOption(candidate, remaining);
    if (cheapest) {
      picks.set(candidate, cheapest);
      spent += cheapest.monthlyCostINR;
    }
    // Not found: not even 1 pack of the cheapest brand fits what's left —
    // this item is deferred, and pass 2 never revisits it (see module note).
  }

  // Pass 2 — depth: spend whatever's left upgrading funded items toward
  // their ideal, highest priority first. "Upgrade" also covers reverting to
  // the original brand over a same-coverage cheaper one pass 1 picked,
  // whenever there's room to do that without spending more overall.
  for (const candidate of byPriority) {
    const current = picks.get(candidate);
    if (!current) continue;
    const remaining = effectiveBudgetINR - spent;
    // What this ONE item could have if we're willing to re-spend what it
    // already costs, plus whatever's genuinely left over.
    const budgetForThisItem = remaining + current.monthlyCostINR;
    const best = bestFittingOption(candidate, budgetForThisItem);
    if (!best) continue;
    const improvesCoverage = best.coverageFraction > current.coverageFraction;
    const revertsToPreferredBrandForFree =
      best.coverageFraction === current.coverageFraction &&
      best.isOriginalProduct &&
      !current.isOriginalProduct;
    if (improvesCoverage || revertsToPreferredBrandForFree) {
      spent += best.monthlyCostINR - current.monthlyCostINR;
      picks.set(candidate, best);
    }
  }

  const funded: BasketItem[] = [];
  const deferred: BasketItem[] = [];
  for (const candidate of byPriority) {
    const picked = picks.get(candidate);
    if (picked) {
      funded.push(itemFrom(candidate, picked));
    } else {
      deferred.push(itemFrom(candidate, idealOption(candidate))); // still shows its real (ideal) cost, never dropped
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
