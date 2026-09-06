// lib/engine/dosing.ts
//
// Resolves a dosing policy's target into a concrete amount for this user,
// computes the gap against dietary intake where applicable, picks a product,
// and produces a ServingPlan. demo.mjs only ever exercises this for protein
// (its header comment says stages 4/5 — requirement + gap — are explicitly
// "WORK PACKAGE B"); this generalises the same arithmetic to every dosing
// basis rather than special-casing protein, while still reproducing the
// protein worked example exactly: 72kg x 1.8 g/kg = 130 g/day target, minus
// 90 g from food = 40 g gap, 40 / 24 g-per-scoop = 1.667 -> 1.5 scoops (36 g).
//
// FIXED 2026-09-06 (was a known limitation): subtractDietaryIntake is also
// true for dose-epa-dha-general-health, but UserProfile has no numeric
// "estimated daily EPA/DHA from food" field — only dietaryOilyFishServingsPerWeek,
// a serving COUNT, not an amount. resolveDietaryIntake below converts that
// count into an approximate daily mg amount via a deliberately conservative
// average-per-serving constant, so the gap is quantified the same way
// protein's is instead of always falling back to the full target. See that
// function's own comment for the conversion's provenance and caveats.

import type { UserProfile, DosingPolicy, RecommendationDosing, ServingPlan, Product } from "@/types/engine";
import { TRUE } from "@/types/engine";
import { dosingPolicyForCompound, compoundById, productById, pricingByProductId } from "./knowledge-base";
import { run } from "./predicate";
import { computeServingPlan } from "./serving-plan";
import { packsNeededPerMonth } from "./monthly-cost";

/** Resolves a dosing policy's target amount and (where computable) dietary gap for this profile. */
export function resolveDosing(profile: UserProfile, compoundId: string): RecommendationDosing | undefined {
  const policy = dosingPolicyForCompound(compoundId);
  if (!policy) return undefined;

  const applies = run(policy.appliesWhen, profile);
  if (applies.value !== TRUE) return undefined;

  const resolvedTargetAmount = resolveTargetAmount(policy, profile);
  const dietaryIntake = policy.subtractDietaryIntake ? resolveDietaryIntake(compoundId, profile) : undefined;
  // Only true when subtractDietaryIntake is set AND a real numeric estimate
  // exists — i.e. gapAmount below reflects a genuine measured shortfall, not
  // a "no gap concept" or "unknown baseline" fallback (both of which just
  // reuse the full target so a serving plan can still be computed).
  const gapIsQuantified = policy.subtractDietaryIntake === true && dietaryIntake != null;

  let gapAmount: number | undefined;
  if (resolvedTargetAmount != null) {
    gapAmount = gapIsQuantified
      ? Math.max(0, resolvedTargetAmount - dietaryIntake!)
      : resolvedTargetAmount;
  }

  return {
    policyId: policy.id,
    target: policy.target,
    resolvedTargetAmount,
    gapAmount,
    gapIsQuantified,
    timing: policy.timing,
  };
}

/**
 * STOPGAP: UserProfile has exactly one numeric dietary-intake field today
 * (estimatedDailyProteinG). A generic mapping — e.g. a `dietaryIntakeField`
 * property on the dosing policy record itself — would let this generalize
 * without engine code knowing compound ids by name, matching the project's
 * "compounds are data, not branches in code" principle. Flagged for
 * Package A/D as the same category of schema gap as omega-3's missing
 * dietary-EPA/DHA estimate (there is currently no field to map it to even
 * if this function did look one up generically).
 */
// Average EPA+DHA content of a single typical "oily fish" serving (~100g),
// used only to convert dietaryOilyFishServingsPerWeek (a serving COUNT) into
// an approximate daily mg amount. Real content varies enormously by species
// (salmon ~1000-2000mg/100g, mackerel ~2500mg/100g, sardines ~1000-1500mg/100g)
// — 500mg is a deliberately conservative average so this estimate never
// OVERstates dietary intake and wrongly suppresses a real need. Draft
// constant, needs Package A/domain review to confirm or refine against
// actual population data rather than a generic figure.
const AVG_EPA_DHA_MG_PER_OILY_FISH_SERVING = 500;

function resolveDietaryIntake(compoundId: string, profile: UserProfile): number | undefined {
  if (compoundId === "protein-complete") return profile.estimatedDailyProteinG;
  if (compoundId === "epa-dha") {
    const servingsPerWeek = profile.dietaryOilyFishServingsPerWeek;
    if (servingsPerWeek == null) return undefined;
    return Math.round((servingsPerWeek * AVG_EPA_DHA_MG_PER_OILY_FISH_SERVING) / 7);
  }
  return undefined;
}

function resolveTargetAmount(policy: DosingPolicy, profile: UserProfile): number | undefined {
  switch (policy.basis) {
    case "per_kg_bodyweight":
      // Rounded to the nearest whole unit, matching demo.mjs and the
      // decisions doc's own worked example: 72kg x 1.8 g/kg = "130 g/day
      // target" (not 129.6) minus ~90g food = 40g gap.
      return Math.round(policy.target.target * profile.bodyWeightKg);
    case "absolute":
      return policy.target.target;
    case "rda_multiple":
      // Can't resolve "1x RDA" to a concrete unit amount without ICMR-NIN
      // reference values, which reference/nutrient-requirements.json
      // deliberately leaves near-empty for now (see data/README.md).
      return undefined;
  }
}

/**
 * How much of `compoundId` one serving of `product` delivers, summing group
 * members (e.g. epa-dha = epa + dha) the way entities/compounds.json's own
 * notes say the loader should. Assumes consistent units across a group's
 * members in today's data (true for epa/dha, both mg) — cross-unit
 * conversion via Compound.conversions is not applied here yet.
 */
export function amountPerServingFor(product: Product, compoundId: string): number {
  const group = compoundById.get(compoundId);
  const memberIds = group?.members ?? [];
  return product.deliversPerServing
    .filter((d) => d.compoundId === compoundId || memberIds.includes(d.compoundId))
    .reduce((sum, d) => sum + d.amount, 0);
}

/**
 * Picks the product to plan a serving against: among every product whose
 * ingredientId is among the candidate ingredients, the one that actually
 * costs the LEAST per month for THIS user's real daily need — not, as
 * originally implemented, just the first match in products.json's catalogue
 * order.
 *
 * When `gapAmount` (the daily amount still needed) is known, this simulates
 * the real serving plan each candidate product would produce (rounding,
 * splittability, and the minimum-effective-dose floor all included, exactly
 * as buildServingPlan will later compute for whichever product wins), turns
 * that into whole packs/month (lib/engine/monthly-cost.ts — you can't buy a
 * fraction of a pack), and ranks by that true monthly cost. Two products
 * with near-identical price-per-gram can differ once pack-rounding is
 * applied: a slightly pricier product whose pack size divides the monthly
 * need evenly can beat a "cheaper per gram" one whose pack size forces
 * buying an extra, mostly-wasted pack.
 *
 * CHANGED 2026-09-06, at product's request: catalogue-order selection was
 * picking a premium 1lb SKU (on-gold-standard-whey-1lb, ~₹5.55/g protein)
 * over a cheaper, better-value 1kg SKU of the same ingredient
 * (muscleblaze-biozyme-whey-1kg, ~₹2.40/g) whenever the premium one
 * happened to be listed first and comfortably fit the budget — the budget
 * allocator's own downgrade-to-a-cheaper-alternative logic (budget.ts) only
 * ever fires when the top pick doesn't fit the remaining budget, so it
 * never corrected a merely-worse-value pick that was still affordable.
 * Ranking by value here means the affordable case is already the
 * best-value choice, not just budget.ts's overflow fallback.
 *
 * CHANGED 2026-09-07: ranking moved from "price per gram over the whole
 * pack" to "true monthly cost after pack-rounding", per the same request —
 * a budget is a monthly constraint, and packs are the only purchasable unit.
 * Falls back to the price-per-unit-over-the-pack heuristic when `gapAmount`
 * isn't supplied (e.g. no dosing concept for this recommendation), and
 * further to catalogue order (the original behavior) when no candidate has
 * a price at all, rather than picking arbitrarily among unpriced products
 * or returning nothing.
 */
export function pickTopCandidateProduct(
  candidateIngredientIds: string[],
  allProducts: Product[],
  compoundId: string,
  gapAmount?: number
): Product | undefined {
  const matches = allProducts.filter((p) => candidateIngredientIds.includes(p.ingredientId));
  if (matches.length === 0) return undefined;

  if (gapAmount != null && gapAmount > 0) {
    const minEffectiveDose = dosingMinEffectiveDoseFor(compoundId);
    const byMonthlyCost = matches
      .map((product) => {
        const priceINR = pricingByProductId.get(product.id)?.priceINR;
        const amountPerServing = amountPerServingFor(product, compoundId);
        if (priceINR == null || amountPerServing <= 0) return undefined;
        const calc = computeServingPlan({
          gapAmount,
          amountPerServing,
          splittable: product.splittable,
          minEffectiveDose,
        });
        const packs = packsNeededPerMonth(calc.servings, product.servingsPerPack);
        return { product, monthlyCost: packs * priceINR };
      })
      .filter((m): m is { product: Product; monthlyCost: number } => m != null);

    if (byMonthlyCost.length > 0) {
      // Stable sort: ties keep their original catalogue order.
      byMonthlyCost.sort((a, b) => a.monthlyCost - b.monthlyCost);
      return byMonthlyCost[0].product;
    }
    // No candidate had pricing — fall through to the pricing-agnostic path below.
  }

  const priced = matches
    .map((product) => {
      const priceINR = pricingByProductId.get(product.id)?.priceINR;
      const totalDelivered = amountPerServingFor(product, compoundId) * product.servingsPerPack;
      const pricePerUnit = priceINR != null && totalDelivered > 0 ? priceINR / totalDelivered : undefined;
      return { product, pricePerUnit };
    })
    .filter((m): m is { product: Product; pricePerUnit: number } => m.pricePerUnit != null);

  if (priced.length === 0) return matches[0]; // no pricing anywhere — keep the old, deterministic fallback

  // Stable sort: ties keep their original catalogue order.
  priced.sort((a, b) => a.pricePerUnit - b.pricePerUnit);
  return priced[0].product;
}

export function buildServingPlan(
  compoundId: string,
  product: Product,
  gapAmount: number,
  minEffectiveDose: number | undefined
): ServingPlan {
  const amountPerServing = amountPerServingFor(product, compoundId);
  const calc = computeServingPlan({
    gapAmount,
    amountPerServing,
    splittable: product.splittable,
    minEffectiveDose,
  });
  return {
    compoundId,
    productId: product.id,
    targetAmount: gapAmount,
    amountPerServing,
    // The compound's own declared unit, not a deliversPerServing lookup: a
    // group compound (epa-dha) never has an entry keyed by its own id, only
    // by its members (epa, dha) — see amountPerServingFor above — so that
    // lookup silently produced "" for every group-compound serving plan.
    unit: compoundById.get(compoundId)?.unit ?? "",
    ...calc,
  };
}

/** minEffectiveDose.amount for a compound's dosing policy, if one exists. */
export function dosingMinEffectiveDoseFor(compoundId: string): number | undefined {
  return dosingPolicyForCompound(compoundId)?.minEffectiveDose?.amount;
}

export { productById };
