// Regression test for a deliberate 2026-09-06 policy change: magnesium's
// eligibility now also fires directly off sleepHoursTypical < 7, not only
// the self-selected sleep_quality goal — magnesium-sleep-quality is exactly
// the claim being cited, so a real reported sleep-hours shortfall is at
// least as strong a signal as a self-picked goal. See
// elig-magnesium.json's own review note for the threshold's provenance.
import { describe, expect, it } from "vitest";
import { generateRecommendations } from "@/lib/engine";
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
    allergies: [],
    isPregnantOrBreastfeeding: false,
    relevantHealthContext: "",
    medicationsOrConditionsFlag: { hasAny: false, freeText: "", parseConfidence: 1 },
    ...overrides,
  };
}

describe("magnesium eligibility depends on actual reported sleep hours (2026-09-06)", () => {
  it("fires for short sleep alone, with no sleep_quality goal and low exercise frequency", () => {
    const profile = baseProfile({ sleepHoursTypical: 5.5, primaryGoals: ["general_wellness"] });
    const result = generateRecommendations(profile);
    const magnesium = result.recommendations.find((r) => r.compoundId === "magnesium");
    expect(magnesium?.status).toBe("potentially_useful"); // magnesium's claims are graded Limited
  });

  it("does not fire on sleep alone at exactly the 7-hour boundary", () => {
    const profile = baseProfile({ sleepHoursTypical: 7, primaryGoals: ["general_wellness"] });
    const result = generateRecommendations(profile);
    const magnesium = result.recommendations.find((r) => r.compoundId === "magnesium");
    expect(magnesium?.status).toBe("not_shown");
  });

  it("still fires off the sleep_quality goal alone, even with plenty of sleep (unchanged prior behavior)", () => {
    const profile = baseProfile({ sleepHoursTypical: 8, primaryGoals: ["sleep_quality"] });
    const result = generateRecommendations(profile);
    const magnesium = result.recommendations.find((r) => r.compoundId === "magnesium");
    expect(magnesium?.status).toBe("potentially_useful"); // magnesium's claims are graded Limited
  });
});
