import { describe, expect, it } from "vitest";
import { computeProteinFromItems } from "@/lib/intake/compute-protein-from-items";

describe("computeProteinFromItems", () => {
  it("computes protein from a real database value, not an LLM guess", () => {
    // 150g dal at 9g/100g (PROTEIN_DATABASE's real value) = 13.5g, rounds to 14.
    const result = computeProteinFromItems([
      { matchedDatabaseId: "dal", quantityGrams: 150 },
    ]);
    expect(result.estimatedDailyProteinG).toBe(14);
    expect(result.matchedProteinFraction).toBe(1);
  });

  it("sums multiple matched items correctly", () => {
    // 2 eggs (~100g) at 13g/100g = 13g, + 100g chicken_breast at 31g/100g = 31g → 44g.
    const result = computeProteinFromItems([
      { matchedDatabaseId: "egg", quantityGrams: 100 },
      { matchedDatabaseId: "chicken_breast", quantityGrams: 100 },
    ]);
    expect(result.estimatedDailyProteinG).toBe(44);
    expect(result.matchedProteinFraction).toBe(1);
  });

  it("falls back to the self-estimated amount for an unmatched food", () => {
    const result = computeProteinFromItems([
      { matchedDatabaseId: null, quantityGrams: 100, selfEstimatedProteinG: 12 },
    ]);
    expect(result.estimatedDailyProteinG).toBe(12);
    expect(result.matchedProteinFraction).toBe(0);
  });

  it("reports a fractional matchedProteinFraction when both kinds are present", () => {
    // 100g paneer (real, 18g) + one unmatched item self-estimated at 6g → 24g total, 18/24 matched.
    const result = computeProteinFromItems([
      { matchedDatabaseId: "paneer", quantityGrams: 100 },
      { matchedDatabaseId: null, quantityGrams: 50, selfEstimatedProteinG: 6 },
    ]);
    expect(result.estimatedDailyProteinG).toBe(24);
    expect(result.matchedProteinFraction).toBeCloseTo(18 / 24, 5);
  });

  it("returns zero with full matched fraction for no items", () => {
    const result = computeProteinFromItems([]);
    expect(result.estimatedDailyProteinG).toBe(0);
    expect(result.matchedProteinFraction).toBe(1);
  });

  it("ignores an unmatched item with no selfEstimatedProteinG (treats as 0)", () => {
    const result = computeProteinFromItems([{ matchedDatabaseId: null, quantityGrams: 50 }]);
    expect(result.estimatedDailyProteinG).toBe(0);
  });
});
