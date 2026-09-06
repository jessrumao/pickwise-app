import { describe, it, expect } from "vitest";
import { packsNeededPerMonth, monthlyCostINR, DAYS_PER_MONTH } from "../monthly-cost";

describe("packsNeededPerMonth", () => {
  it("rounds UP to a whole pack — you cannot buy a fraction of a pack", () => {
    // 1.5 servings/day x 30 days = 45 servings needed; a 30-serving pack only
    // covers 30, so a second whole pack is required even though 15 of its
    // 30 servings won't be used this month.
    expect(packsNeededPerMonth(1.5, 30)).toBe(2);
  });

  it("needs exactly one pack when the pack's servings evenly cover the month", () => {
    expect(packsNeededPerMonth(1, 30)).toBe(1); // 30 servings/month, pack of 30
  });

  it("needs multiple packs for a small pack size relative to daily need", () => {
    expect(packsNeededPerMonth(3, 20)).toBe(5); // 90 servings/month / 20 per pack = 4.5 -> 5
  });

  it("is 0 when there is no real daily need or no valid pack size (nothing to buy)", () => {
    expect(packsNeededPerMonth(0, 30)).toBe(0);
    expect(packsNeededPerMonth(1, 0)).toBe(0);
  });

  it("DAYS_PER_MONTH is the shared approximation both dosing.ts and budget.ts key off", () => {
    expect(DAYS_PER_MONTH).toBe(30);
  });
});

describe("monthlyCostINR", () => {
  it("is packsNeededPerMonth(...) x priceINR", () => {
    expect(monthlyCostINR(1.5, 30, 1799)).toBe(2 * 1799);
  });

  it("a product with a worse per-pack price can still be the cheaper REAL monthly choice", () => {
    // Product A: ₹190/pack, 90 servings/pack -> exactly 1 pack covers the month -> ₹190/mo.
    // Product B: ₹100/pack (cheaper per unit delivered: ₹100/500 vs A's ₹190/900), but its
    // 50-serving pack forces buying 2 packs to cover 90 servings/month -> ₹200/mo — MORE
    // than A, despite A costing more per pack and per unit. This is exactly why product
    // selection must rank by real monthly cost, not flat per-pack (or per-unit) price.
    const monthlyA = monthlyCostINR(3, 90, 190);
    const monthlyB = monthlyCostINR(3, 50, 100);
    expect(monthlyA).toBe(190);
    expect(monthlyB).toBe(200);
    expect(monthlyA).toBeLessThan(monthlyB);
  });
});
