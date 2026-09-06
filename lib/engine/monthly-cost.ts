// lib/engine/monthly-cost.ts
//
// The budget is a MONTHLY constraint, but a product is only ever purchased
// as a whole pack — you cannot buy 1.5 tubs of whey. This module is the one
// place that turns "N servings/day" into "how many packs must actually be
// bought this month, and what does that really cost" — shared by dosing.ts
// (so product selection ranks by real monthly cost, not flat pack price)
// and budget.ts (so the allocator's budget fit-check uses the same number).

// Approximation, not a calendar lookup — matches how the rest of this
// engine treats "a month" (a recurring purchase cadence), not a specific
// billing cycle. 30 was chosen over 30.44 (the precise average) to be
// mildly conservative: it slightly OVER-estimates packs/cost rather than
// under-estimating and leaving a user short mid-month.
export const DAYS_PER_MONTH = 30;

/**
 * Packs needed to cover `dailyServings` servings/day for a full month, given
 * a product's `servingsPerPack`. Always a whole number >= 1 (assuming
 * dailyServings > 0) — packs can't be fractional.
 */
export function packsNeededPerMonth(dailyServings: number, servingsPerPack: number): number {
  if (dailyServings <= 0 || servingsPerPack <= 0) return 0;
  return Math.ceil((dailyServings * DAYS_PER_MONTH) / servingsPerPack);
}

/** packsNeededPerMonth(...) * priceINR — the number that actually counts against a monthly budget. */
export function monthlyCostINR(dailyServings: number, servingsPerPack: number, priceINR: number): number {
  return packsNeededPerMonth(dailyServings, servingsPerPack) * priceINR;
}
