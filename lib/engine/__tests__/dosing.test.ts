import { describe, it, expect } from "vitest";
import { buildServingPlan, amountPerServingFor, pickTopCandidateProduct } from "../dosing";
import { productById, products } from "../knowledge-base";
import type { Product } from "@/types/engine";

describe("buildServingPlan unit resolution", () => {
  it("uses the compound's own unit for a plain compound (protein-complete, g)", () => {
    const product = productById.get("on-gold-standard-whey-1lb")!;
    const plan = buildServingPlan("protein-complete", product, 40, undefined);
    expect(plan.unit).toBe("g");
  });

  it("uses the compound's own unit for a GROUP compound (epa-dha), not a deliversPerServing lookup", () => {
    // algal-omega3-vegan-60's deliversPerServing has entries for "epa" and
    // "dha" individually, never one keyed "epa-dha" itself — a lookup keyed
    // on the group id directly used to silently resolve to "" here.
    const product = productById.get("algal-omega3-vegan-60")!;
    expect(amountPerServingFor(product, "epa-dha")).toBe(300); // 100mg epa + 200mg dha
    const plan = buildServingPlan("epa-dha", product, 300, undefined);
    expect(plan.unit).toBe("mg");
  });
});

describe("pickTopCandidateProduct ranks by price per unit delivered, not catalogue order (2026-09-06)", () => {
  it("picks muscleblaze-biozyme-whey-1kg over on-gold-standard-whey-1lb for protein-complete", () => {
    // on-gold-standard-whey-1lb is listed first in products.json and is well
    // within most budgets on its own — catalogue-order selection picked it
    // every time even though muscleblaze-biozyme-whey-1kg delivers protein
    // at under half the price per gram (~Rs2.40/g vs ~Rs5.55/g).
    const picked = pickTopCandidateProduct(["whey-protein"], products, "protein-complete");
    expect(picked?.id).toBe("muscleblaze-biozyme-whey-1kg");
  });

  it("falls back to catalogue order when no candidate has any pricing at all", () => {
    // Every ingredient in the real catalogue has at least one priced
    // product, so this exercises the no-pricing fallback with a synthetic
    // product that isn't in pricingByProductId.
    const unpriced: Product = {
      id: "test-unpriced-product",
      ingredientId: "whey-protein",
      productName: "Test unpriced product",
      brand: "Test",
      servingSize: { amount: 30, unit: "g" },
      servingsPerPack: 10,
      deliversPerServing: [{ compoundId: "protein-complete", amount: 20, unit: "g" }],
      splittable: true,
      review: { status: "draft_needs_expert_review", reviewedBy: null, reviewedOn: null },
    };
    const picked = pickTopCandidateProduct(["whey-protein"], [unpriced], "protein-complete");
    expect(picked?.id).toBe("test-unpriced-product");
  });

  it("returns undefined when no product matches the candidate ingredients at all", () => {
    const picked = pickTopCandidateProduct(["no-such-ingredient"], products, "protein-complete");
    expect(picked).toBeUndefined();
  });
});
