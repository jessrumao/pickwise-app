// Regression test for a real bug, same category as protein's (fixed
// 2026-09-06): dose-epa-dha-general-health.json has subtractDietaryIntake:
// true, but dietaryOilyFishServingsPerWeek is a serving COUNT, not an
// amount — so the gap used to always fall back to the full 500mg target
// regardless of how much oily fish someone actually eats. dosing.ts now
// converts the serving count into an approximate daily mg estimate (a
// deliberately conservative constant, see its own comment) so 1+ servings a
// week measurably shrinks the gap, the same way estimatedDailyProteinG
// already does for protein.
import { describe, expect, it } from "vitest";
import { resolveDosing } from "@/lib/engine";
import type { UserProfile } from "@/types/engine";

function baseProfile(overrides: Partial<UserProfile>): UserProfile {
  return {
    age: 30,
    sex: "prefer_not_to_say",
    bodyWeightKg: 70,
    dietaryPattern: "omnivore",
    exerciseFrequencyPerWeek: 1,
    primaryGoals: ["general_wellness"],
    sleepHoursTypical: 7,
    existingSupplementUse: [],
    dietaryProteinAdequacy: "likely_adequate",
    estimatedDailyProteinG: 60,
    dietaryOilyFishServingsPerWeek: 0,
    allergies: [],
    isPregnantOrBreastfeeding: false,
    relevantHealthContext: "",
    medicationsOrConditionsFlag: { hasAny: false, freeText: "", parseConfidence: 1 },
    ...overrides,
  };
}

describe("omega-3's dietary gap is quantified from dietaryOilyFishServingsPerWeek (2026-09-06)", () => {
  it("gap is the full 500mg target at 0 servings/week", () => {
    const dosing = resolveDosing(baseProfile({ dietaryOilyFishServingsPerWeek: 0 }), "epa-dha");
    expect(dosing?.gapIsQuantified).toBe(true);
    expect(dosing?.resolvedTargetAmount).toBe(500);
    expect(dosing?.gapAmount).toBe(500);
  });

  it("gap shrinks measurably at 1 serving/week, not just an unquantified default", () => {
    const dosing = resolveDosing(baseProfile({ dietaryOilyFishServingsPerWeek: 1 }), "epa-dha");
    expect(dosing?.gapIsQuantified).toBe(true);
    // 1 serving/week * 500mg/serving / 7 days ~= 71mg/day estimated intake
    expect(dosing?.gapAmount).toBe(429);
    expect(dosing!.gapAmount!).toBeLessThan(dosing!.resolvedTargetAmount!);
  });
});
