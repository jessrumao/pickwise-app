import { describe, it, expect } from "vitest";
import { generateRecommendations } from "@/lib/engine";
import { DEMO_PROFILES } from "@/lib/results/demo-profiles";
import { buildRecommendationContext } from "@/lib/results/build-recommendation-context";

// Regression test for a real product gap: the explain-mode chat on /results
// previously had NO structured knowledge of the user's own profile or what
// was actually recommended — only a semantic-search tool over evidence
// text — so it correctly (but uselessly) said it couldn't answer
// profile/recommendation questions. This context block is what fixes that;
// these tests check it actually surfaces the real data a user would ask
// about, not just that it doesn't throw.
describe("buildRecommendationContext", () => {
  const demo = DEMO_PROFILES.find((d) => d.id === "vegetarian-muscle-gain")!;
  const result = generateRecommendations(demo.profile);
  const context = buildRecommendationContext(demo.profile, result);

  it("includes real profile fields, not a generic placeholder", () => {
    expect(context).toContain(`Age: ${demo.profile.age}`);
    expect(context).toContain(`Body weight: ${demo.profile.bodyWeightKg}kg`);
    expect(context).toContain(`Diet: ${demo.profile.dietaryPattern}`);
    expect(context).toContain(demo.profile.primaryGoals[0]);
  });

  it("includes each visible recommendation's actual status and reasoning", () => {
    const recommended = result.recommendations.find((r) => r.status === "recommended");
    expect(recommended).toBeDefined();
    expect(context).toContain(recommended!.why);
  });

  it("includes real dose/product details for a funded recommendation", () => {
    const withPlan = result.recommendations.find((r) => r.servingPlan);
    expect(withPlan).toBeDefined();
    expect(context).toContain(`${withPlan!.servingPlan!.servings} serving`);
  });

  it("never fabricates a profile section for a global escalation — reports the real escalation message instead", () => {
    const escalated = DEMO_PROFILES.find((d) => d.id === "unparseable-medications")!;
    const escalatedResult = generateRecommendations(escalated.profile);
    expect(escalatedResult.globalEscalation).toBeDefined();
    const escalatedContext = buildRecommendationContext(escalated.profile, escalatedResult);
    expect(escalatedContext).toContain(escalatedResult.globalEscalation!.userMessage);
    expect(escalatedContext).toContain("USER PROFILE:");
  });
});
