import { describe, it, expect } from "vitest";
import { buildServingPlan, amountPerServingFor } from "../dosing";
import { productById } from "../knowledge-base";

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
