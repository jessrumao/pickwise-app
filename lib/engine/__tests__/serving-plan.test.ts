import { describe, it, expect } from "vitest";
import { computeServingPlan } from "../serving-plan";

describe("computeServingPlan", () => {
  it("reproduces the canonical protein worked example: 40g / 24g scoop -> 1.5 scoops (36g)", () => {
    const plan = computeServingPlan({ gapAmount: 40, amountPerServing: 24, splittable: true });
    expect(plan.raw).toBe(1.667);
    expect(plan.servings).toBe(1.5);
    expect(plan.delivered).toBe(36);
    expect(plan.flooredUpToMinEffective).toBe(false);
  });

  it("non-splittable product rounds down to whole units (fish oil softgel case)", () => {
    // hkvitals-omega3-1000mg: 300mg/softgel, splittable:false. A naive
    // nearest-half rule would prescribe 1.5 softgels -- data/README.md's
    // "this is the record that exercises the rounding fallback" case.
    const plan = computeServingPlan({ gapAmount: 450, amountPerServing: 300, splittable: false });
    expect(plan.increment).toBe(1);
    expect(plan.servings).toBe(2); // NOT 1.5
  });

  it("floors UP rather than down when rounding would drop below minEffectiveDose (2-capsule case)", () => {
    // data-layer-decisions-v2.md consequence #3: "a 2-capsule target must not
    // round down to 1" on a non-splittable product with a minEffectiveDose floor.
    const plan = computeServingPlan({
      gapAmount: 130, // raw = 1.3 -> naive nearest-whole rounds to 1
      amountPerServing: 100,
      splittable: false,
      minEffectiveDose: 200, // but 1 serving only delivers 100, below the floor
    });
    expect(plan.servings).toBe(2);
    expect(plan.delivered).toBe(200);
    expect(plan.flooredUpToMinEffective).toBe(true);
  });

  it("floors up on a splittable product too, respecting the 0.5 increment", () => {
    const plan = computeServingPlan({
      gapAmount: 5,
      amountPerServing: 20,
      splittable: true,
      minEffectiveDose: 15, // raw = 0.25 -> rounds to 0 -> must floor up to 0.5 (10) >= 15? no, needs 1 full serving
    });
    // 0.25 rounds to 0 servings (delivered 0) which is below minEffectiveDose 15,
    // so it must floor up to the smallest half-increment that clears 15: ceil(15/20/0.5)*0.5 = 1.0
    expect(plan.servings).toBe(1);
    expect(plan.delivered).toBe(20);
    expect(plan.flooredUpToMinEffective).toBe(true);
  });
});
