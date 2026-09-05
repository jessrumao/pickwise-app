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
import { resolveDosing, pickTopCandidateProduct, buildServingPlan, dosingMinEffectiveDoseFor } from "./dosing";
import { computeGoalAlignment, computeGapTier, computePriorityScore } from "./priority";
import { allocateBudget, type BasketCandidate } from "./budget";
import { products, pricingByProductId, eligibilityPolicyById, GRADE_RANK } from "./knowledge-base";

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
      const dosing = resolveDosing(profile, rec.compoundId);
      const candidateIds = (rec.candidateIngredients ?? []).map((c) => c.ingredientId);
      const topProduct = pickTopCandidateProduct(candidateIds, products);

      const priorityScore = computePriorityScore({
        gapTier: computeGapTier(dosing?.gapAmount, dosing?.resolvedTargetAmount, dosing?.gapIsQuantified ?? false),
        evidenceTier,
        goalAlignment,
      });

      let servingPlan: ServingPlan | undefined;
      if (topProduct && dosing?.gapAmount != null && dosing.gapAmount > 0) {
        servingPlan = buildServingPlan(
          rec.compoundId,
          topProduct,
          dosing.gapAmount,
          dosingMinEffectiveDoseFor(rec.compoundId)
        );
      }

      const updated: Recommendation = { ...rec, dosing, servingPlan, priorityScore };

      if (topProduct) {
        const price = pricingByProductId.get(topProduct.id)?.priceINR;
        if (price != null) {
          const alternativeProducts = products
            .filter((p) => candidateIds.includes(p.ingredientId) && p.id !== topProduct.id)
            .map((p) => ({ productId: p.id, priceINR: pricingByProductId.get(p.id)?.priceINR }))
            .filter((alt): alt is { productId: string; priceINR: number } => alt.priceINR != null);
          basketCandidates.push({
            recommendation: updated,
            productId: topProduct.id,
            priceINR: price,
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
        basketCandidates.push({ recommendation: updated, productId: product.id, priceINR: price, alternativeProducts: [] });
      }
    }

    return updated;
  });

  const budget = basketCandidates.length > 0 ? allocateBudget(basketCandidates, profile) : undefined;

  return { safety, recommendations, budget };
}
