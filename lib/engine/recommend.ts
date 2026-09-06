// lib/engine/recommend.ts
//
// Top-level orchestrator: profile in, full recommendation set + budget
// outcome out. Wires together every stage in the order Package B's brief
// specifies: safety gate -> eligibility/suppression -> substitution ->
// dosing/serving-plan -> priority scoring -> budget allocation.

import type {
  UserProfile,
  Recommendation,
  BudgetOutcome,
  SafetyEscalation,
  SafetyGateResult,
  ServingPlan,
  EvidenceTier,
} from "@/types/engine";
import { evaluateSafetyGate } from "./safety";
import { evaluateEligibility } from "./eligibility";
import { resolveDosing, pickTopCandidateProduct, buildServingPlan, dosingMinEffectiveDoseFor, amountPerServingFor } from "./dosing";
import { computeServingPlan } from "./serving-plan";
import { computeGoalAlignment, computeGapTier, computePriorityScore } from "./priority";
import { allocateBudget, type BasketCandidate } from "./budget";
import { packsNeededPerMonth } from "./monthly-cost";
import { products, pricingByProductId, eligibilityPolicyById, GRADE_RANK } from "./knowledge-base";
import type { Product } from "@/types/engine";

// Monthly cost for a candidate product against a real daily compound gap —
// simulates the exact serving plan that product would produce (rounding,
// splittability, minimum-effective-dose floor, same as buildServingPlan)
// and turns it into whole packs/month (you can't buy a fraction of a pack).
// Mirrors pickTopCandidateProduct's own internal ranking simulation exactly,
// so the product actually chosen and the monthly cost shown for it agree.
function monthlyCostForCompound(
  product: Product,
  compoundId: string,
  gapAmount: number,
  priceINR: number
): { packsPerMonth: number; monthlyCostINR: number } {
  const calc = computeServingPlan({
    gapAmount,
    amountPerServing: amountPerServingFor(product, compoundId),
    splittable: product.splittable,
    minEffectiveDose: dosingMinEffectiveDoseFor(compoundId),
  });
  const packsPerMonth = packsNeededPerMonth(calc.servings, product.servingsPerPack);
  return { packsPerMonth, monthlyCostINR: packsPerMonth * priceINR };
}

// Ingredient-scoped bundle products (e.g. a multivitamin) have no per-compound
// dose to close a gap against — rda_multiple can't resolve to a concrete
// amount (see the comment below), so there is no real daily-serving figure
// to compute. Assumes the standard one-serving-a-day label dosing these
// products are sold under, per product decision.
const BUNDLE_ASSUMED_DAILY_SERVINGS = 1;

function monthlyCostForBundle(product: Product, priceINR: number): { packsPerMonth: number; monthlyCostINR: number } {
  const packsPerMonth = packsNeededPerMonth(BUNDLE_ASSUMED_DAILY_SERVINGS, product.servingsPerPack);
  return { packsPerMonth, monthlyCostINR: packsPerMonth * priceINR };
}

export interface RecommendationResult {
  // Set when a GLOBAL safety policy fired (e.g. unparseable medications,
  // pregnancy). When set, `recommendations` and `budget` are empty/undefined
  // — matching demo.mjs's unparseable-medications case exactly: "no
  // automated recommendation is produced for this profile."
  globalEscalation?: SafetyEscalation;
  safety: SafetyGateResult;
  recommendations: Recommendation[];
  budget?: BudgetOutcome;
}

export function generateRecommendations(profile: UserProfile): RecommendationResult {
  const safety = evaluateSafetyGate(profile);
  if (safety.globalEscalations.length > 0) {
    return { globalEscalation: safety.globalEscalations[0], safety, recommendations: [] };
  }

  const baseRecommendations = evaluateEligibility(profile, safety);
  const basketCandidates: BasketCandidate[] = [];

  const recommendations = baseRecommendations.map((rec) => {
    if (rec.status !== "recommended" && rec.status !== "potentially_useful") return rec;

    const policy = eligibilityPolicyById.get(rec.policyId);
    const evidenceTier = (GRADE_RANK[rec.grade] ?? 0) as EvidenceTier;
    const goalAlignment = policy ? computeGoalAlignment(profile, policy.citesClaims) : 0;

    // Compound-level recommendation: resolve dose, pick a product via the
    // substitution candidates, build a serving plan.
    if (rec.compoundId) {
      const compoundId = rec.compoundId;
      const dosing = resolveDosing(profile, compoundId);
      const candidateIds = (rec.candidateIngredients ?? []).map((c) => c.ingredientId);
      const topProduct = pickTopCandidateProduct(candidateIds, products, compoundId, dosing?.gapAmount);

      const priorityScore = computePriorityScore({
        gapTier: computeGapTier(dosing?.gapAmount, dosing?.resolvedTargetAmount, dosing?.gapIsQuantified ?? false),
        evidenceTier,
        goalAlignment,
      });

      let servingPlan: ServingPlan | undefined;
      const gapAmount = dosing?.gapAmount;
      if (topProduct && gapAmount != null && gapAmount > 0) {
        servingPlan = buildServingPlan(
          compoundId,
          topProduct,
          gapAmount,
          dosingMinEffectiveDoseFor(compoundId)
        );
      }

      const updated: Recommendation = { ...rec, dosing, servingPlan, priorityScore };

      // A real, quantified daily gap lets monthly cost be computed against
      // this compound's actual per-serving delivery (monthlyCostForCompound).
      // Without one (no dosing policy matched this profile at all — rare,
      // but the eligibility/dosing predicates are independent so it's not
      // impossible), fall back to the same one-serving-a-day assumption the
      // ingredient-scoped branch below uses, rather than dropping an
      // otherwise-eligible recommendation out of the basket entirely.
      const hasQuantifiedGap = gapAmount != null && gapAmount > 0;
      const costFor = (product: Product, price: number) =>
        hasQuantifiedGap
          ? monthlyCostForCompound(product, compoundId, gapAmount!, price)
          : monthlyCostForBundle(product, price);

      if (topProduct) {
        const price = pricingByProductId.get(topProduct.id)?.priceINR;
        if (price != null) {
          const { packsPerMonth, monthlyCostINR } = costFor(topProduct, price);
          const alternativeProducts = products
            .filter((p) => candidateIds.includes(p.ingredientId) && p.id !== topProduct.id)
            .map((p) => {
              const altPrice = pricingByProductId.get(p.id)?.priceINR;
              if (altPrice == null) return undefined;
              return { productId: p.id, priceINR: altPrice, ...costFor(p, altPrice) };
            })
            .filter((alt): alt is { productId: string; priceINR: number; packsPerMonth: number; monthlyCostINR: number } => alt != null);
          basketCandidates.push({
            recommendation: updated,
            productId: topProduct.id,
            priceINR: price,
            packsPerMonth,
            monthlyCostINR,
            alternativeProducts,
          });
        }
      }

      return updated;
    }

    // Ingredient-scoped recommendation (elig-multivitamin): the dosing basis
    // is rda_multiple, which can't resolve to a concrete serving amount
    // without ICMR-NIN reference values (deliberately near-empty for now —
    // see data/README.md finding #5), so no ServingPlan is computed. Still
    // gets a priority score and a basket entry at its labelled serving price.
    const priorityScore = computePriorityScore({
      gapTier: 2, // no dietary-gap concept for a bundle product — see priority.ts's flagged default
      evidenceTier,
      goalAlignment,
    });
    const updated: Recommendation = { ...rec, priorityScore };

    if (rec.ingredientId) {
      const product = products.find((p) => p.ingredientId === rec.ingredientId);
      const price = product ? pricingByProductId.get(product.id)?.priceINR : undefined;
      if (product && price != null) {
        const { packsPerMonth, monthlyCostINR } = monthlyCostForBundle(product, price);
        basketCandidates.push({
          recommendation: updated,
          productId: product.id,
          priceINR: price,
          packsPerMonth,
          monthlyCostINR,
          alternativeProducts: [],
        });
      }
    }

    return updated;
  });

  const budget = basketCandidates.length > 0 ? allocateBudget(basketCandidates, profile) : undefined;

  return { safety, recommendations, budget };
}
