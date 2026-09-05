import { describe, it, expect } from "vitest";
import { generateRecommendations } from "@/lib/engine";
import { DEMO_PROFILES } from "@/lib/results/demo-profiles";

describe("DEMO_PROFILES all run through the real engine without throwing", () => {
  for (const demo of DEMO_PROFILES) {
    it(`${demo.id} produces a result`, () => {
      expect(() => generateRecommendations(demo.profile)).not.toThrow();
    });
  }
});

describe("escalate-demo exercises a real targeted safety escalation", () => {
  it("epa-dha escalates due to the warfarin mention, while protein/creatine still recommend and bcaa is not_needed", () => {
    const demo = DEMO_PROFILES.find((d) => d.id === "escalate-demo")!;
    const result = generateRecommendations(demo.profile);
    expect(result.globalEscalation).toBeUndefined(); // must be a targeted escalation, not global
    const byCompound = Object.fromEntries(
      result.recommendations.map((r) => [r.compoundId ?? r.ingredientId, r])
    );
    expect(byCompound["epa-dha"].status).toBe("escalate");
    expect(byCompound["protein-complete"].status).toBe("recommended");
    expect(byCompound["creatine-monohydrate"].status).toBe("recommended");
    expect(byCompound["bcaa"].status).toBe("not_needed");

    const escalation = result.safety.escalations.find((e) => e.trace === byCompound["epa-dha"].safetyTrace);
    expect(escalation?.policyId).toBe("safety-epa-dha-anticoagulant");
    expect(escalation?.userMessage).toBeTruthy();
  });
});
