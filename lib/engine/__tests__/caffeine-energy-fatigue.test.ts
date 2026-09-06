// Regression test for a deliberate 2026-09-06 policy change: caffeine's
// eligibility widened to include the energy_fatigue goal, as the sanctioned
// goal-based alternative to a symptom question ("do you feel tired before
// the gym?") the questionnaire deliberately doesn't ask — see
// data/questionnaire.md's explicit non-goals and elig-caffeine.json's own
// review note. Confirms the widened gate actually fires, and that
// unrelated goals still correctly don't.
import { describe, expect, it } from "vitest";
import { generateRecommendations } from "@/lib/engine";
import type { UserProfile } from "@/types/engine";

function baseProfile(overrides: Partial<UserProfile>): UserProfile {
  return {
    age: 30,
    sex: "prefer_not_to_say",
    bodyWeightKg: 70,
    dietaryPattern: "omnivore",
    exerciseFrequencyPerWeek: 3,
    primaryGoals: ["general_wellness"],
    sleepHoursTypical: 7,
    existingSupplementUse: [],
    dietaryProteinAdequacy: "likely_adequate",
    allergies: [],
    isPregnantOrBreastfeeding: false,
    relevantHealthContext: "",
    medicationsOrConditionsFlag: { hasAny: false, freeText: "", parseConfidence: 1 },
    ...overrides,
  };
}

describe("caffeine eligibility includes energy_fatigue (2026-09-06 widening)", () => {
  it("fires for a low-energy goal + adequate exercise frequency, with no endurance/fitness goal at all", () => {
    const profile = baseProfile({ primaryGoals: ["energy_fatigue"], exerciseFrequencyPerWeek: 2 });
    const result = generateRecommendations(profile);
    const caffeine = result.recommendations.find((r) => r.compoundId === "caffeine");
    expect(caffeine?.status).toBe("recommended");
  });

  it("still does not fire for an unrelated goal (regression guard on the rest of the gate)", () => {
    const profile = baseProfile({ primaryGoals: ["digestive_health"], exerciseFrequencyPerWeek: 5 });
    const result = generateRecommendations(profile);
    const caffeine = result.recommendations.find((r) => r.compoundId === "caffeine");
    expect(caffeine?.status).toBe("not_shown");
  });
});
