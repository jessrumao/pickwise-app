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

// A real, purchasable quantity of ONE product: some whole number of packs,
// what it costs this month, and what SHARE of the full month it actually
// covers (1 = the ideal, full 30 days; less than 1 = you'll need to restock
// before the month is out). The dose per serving is identical across every
// option here — only how many days it lasts changes. Never generated below
// 1 pack (there is no such thing as buying less than one whole pack).
export interface QuantityOption {
  packsPerMonth: number;
  monthlyCostINR: number;
  coverageFraction: number; // 0-1, capped at 1
}

/**
 * Every real purchase size for one product, from 1 pack up to the ideal
 * (packsNeededPerMonth) — the actual search space the budget allocator
 * chooses from when the ideal, full-month quantity doesn't fit. Letting a
 * lower-priority item eat the whole budget while a higher-priority one gets
 * dropped to zero, just because that one item's full month doesn't fit, was
 * the exact gap this closes: SOME of the highest-priority item (a shorter
 * runway) beats deferring it entirely, as long as it's still an honestly
 * labeled partial month, never a smaller-than-effective dose.
 */
export function quantityOptionsFor(
  dailyServings: number,
  servingsPerPack: number,
  priceINR: number
): QuantityOption[] {
  const idealPacks = packsNeededPerMonth(dailyServings, servingsPerPack);
  if (idealPacks <= 0) return [];
  const options: QuantityOption[] = [];
  for (let packs = 1; packs <= idealPacks; packs++) {
    const coverageFraction = Math.min(
      1,
      (packs * servingsPerPack) / (dailyServings * DAYS_PER_MONTH)
    );
    options.push({ packsPerMonth: packs, monthlyCostINR: packs * priceINR, coverageFraction });
  }
  return options;
}
