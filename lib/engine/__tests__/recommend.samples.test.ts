import { describe, it, expect } from "vitest";
import { generateRecommendations } from "../recommend";
import vegetarianMuscleGain from "@/data/tools/samples/vegetarian-muscle-gain.json";
import veganEndurance from "@/data/tools/samples/vegan-endurance.json";
import unparseableMedications from "@/data/tools/samples/unparseable-medications.json";
import sedentaryWellness from "@/data/tools/samples/sedentary-wellness.json";
import alreadyCovered from "@/data/tools/samples/already-covered.json";
import type { UserProfile } from "@/types/engine";

const P = (x: unknown) => x as UserProfile;

describe("generateRecommendations: reproduce demo.mjs exactly across the 5 sample profiles", () => {
  it("vegetarian-muscle-gain: protein 1.5 scoops, creatine recommended, bcaa not_needed", () => {
    const result = generateRecommendations(P(vegetarianMuscleGain));
    const byCompound = Object.fromEntries(result.recommendations.map((r) => [r.compoundId ?? r.ingredientId, r]));

    expect(byCompound["protein-complete"].status).toBe("recommended");
    expect(byCompound["protein-complete"].servingPlan?.servings).toBe(1.5);
    expect(byCompound["protein-complete"].servingPlan?.delivered).toBe(36);
    expect(byCompound["protein-complete"].servingPlan?.productId).toBe("on-gold-standard-whey-1lb");
    expect(byCompound["protein-complete"].dosing?.resolvedTargetAmount).toBe(130);
    expect(byCompound["protein-complete"].dosing?.gapAmount).toBe(40);

    expect(byCompound["creatine-monohydrate"].status).toBe("recommended");
    expect(byCompound["bcaa"].status).toBe("not_needed");
    expect(byCompound["epa-dha"].status).toBe("potentially_useful");
    expect(byCompound["epa-dha"].candidateIngredients?.map((c: { ingredientId: string }) => c.ingredientId)).toContain("algal-oil");
    expect(byCompound["multivitamin"].status).toBe("potentially_useful");
    expect(byCompound["lgg"].status).toBe("not_shown");
  });

  it("vegan-endurance: omega-3 resolves to algal-oil only, protein still gapped (known issue)", () => {
    const result = generateRecommendations(P(veganEndurance));
    const byCompound = Object.fromEntries(result.recommendations.map((r) => [r.compoundId ?? r.ingredientId, r]));
    expect(byCompound["epa-dha"].candidateIngredients?.map((c: { ingredientId: string }) => c.ingredientId)).toEqual(["algal-oil"]);
    expect(byCompound["creatine-monohydrate"].status).toBe("recommended");
    // Known data gap (data/README.md finding #1): endurance training isn't in
    // elig-protein-complete's goal list, so protein doesn't fire even though
    // this profile trains 5x/week. Reproduced, not silently fixed.
    expect(byCompound["protein-complete"].status).toBe("not_shown");
  });

  it("unparseable-medications: global escalation, no recommendations at all", () => {
    const result = generateRecommendations(P(unparseableMedications));
    expect(result.globalEscalation?.policyId).toBe("safety-global-unparseable-medications");
    expect(result.globalEscalation?.firedOnUnknown).toBe(false); // it's a direct TRUE match here, not an unknown fallback
    expect(result.recommendations).toHaveLength(0);
  });

  it("sedentary-wellness: protein already_covered (gets enough from food), most things suppressed", () => {
    const result = generateRecommendations(P(sedentaryWellness));
    const byCompound = Object.fromEntries(result.recommendations.map((r) => [r.compoundId ?? r.ingredientId, r]));
    expect(byCompound["protein-complete"].status).toBe("already_covered");
    expect(byCompound["epa-dha"].status).toBe("not_needed");
    expect(byCompound["creatine-monohydrate"].status).toBe("not_shown");
  });

  it("already-covered: suppression, not a duplicate recommendation", () => {
    const result = generateRecommendations(P(alreadyCovered));
    const byCompound = Object.fromEntries(result.recommendations.map((r) => [r.compoundId ?? r.ingredientId, r]));
    expect(byCompound["protein-complete"].status).toBe("already_covered");
    expect(byCompound["creatine-monohydrate"].status).toBe("already_covered");
  });
});
