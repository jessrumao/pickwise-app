// lib/engine/serving-plan.ts
//
// Direct port of predicate.mjs's servingPlan(): nearest-half rounding, with
// the settled fallback for products that cannot be split. Field names match
// the reference implementation's return shape exactly (raw, increment,
// servings, delivered, flooredUpToMinEffective) — see
// types/engine.ts's ServingPlan for why.

import type { ServingPlanInput } from "@/types/engine";

export interface ServingPlanCalc {
  raw: number;
  increment: 0.5 | 1;
  servings: number;
  delivered: number;
  flooredUpToMinEffective: boolean;
}

export function computeServingPlan({
  gapAmount,
  amountPerServing,
  splittable,
  minEffectiveDose,
}: ServingPlanInput): ServingPlanCalc {
  const raw = gapAmount / amountPerServing;
  const inc: 0.5 | 1 = splittable ? 0.5 : 1;
  let servings = Math.round(raw / inc) * inc;
  const delivered = () => servings * amountPerServing;
  let flooredUp = false;
  if (minEffectiveDose != null && delivered() < minEffectiveDose) {
    // Rounding down would have gone below the useful dose (data-layer-decisions-v2.md
    // consequence #3: a 2-capsule target must never round down to 1) — floor UP
    // to the minimum instead.
    servings = Math.ceil(minEffectiveDose / amountPerServing / inc) * inc;
    flooredUp = true;
  }
  return {
    raw: +raw.toFixed(3),
    increment: inc,
    servings,
    delivered: +delivered().toFixed(1),
    flooredUpToMinEffective: flooredUp,
  };
}
