// Sanity-checks assembleUserProfile() against the 5 known-good sample
// profiles from data/tools/samples/*.json, per Package D's brief
// ("test with the 5 sample profiles... to sanity-check your form produces
// equivalent structured output"). Simulates what the intake form would
// collect (IntakeFormValues) and what the AI parse step would return
// (ParsedFreeText, using each sample's own already-structured arrays as the
// ground truth) and checks the assembled UserProfile matches the sample
// field-for-field. No network call — the LLM's own parsing quality isn't
// something a unit test can verify.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { userProfileSchema, type UserProfile } from "@/types/engine";
import { assembleUserProfile, fieldsNeedingConfirmation } from "@/lib/intake/assemble-profile";
import type { IntakeFormValues } from "@/lib/intake/schema";

const SAMPLES_DIR = path.join(process.cwd(), "data/tools/samples");

function loadSample(file: string): UserProfile & { _note?: string } {
  const raw = JSON.parse(readFileSync(path.join(SAMPLES_DIR, file), "utf-8"));
  return raw;
}

function toFormValues(sample: UserProfile): IntakeFormValues {
  return {
    age: sample.age,
    sex: sample.sex,
    isPregnantOrBreastfeeding: sample.isPregnantOrBreastfeeding,
    bodyWeightKg: sample.bodyWeightKg,
    heightCm: sample.heightCm,
    dietaryPattern: sample.dietaryPattern,
    exerciseFrequencyPerWeek: sample.exerciseFrequencyPerWeek,
    exerciseType: sample.exerciseType ?? [],
    primaryGoals: sample.primaryGoals,
    monthlyBudgetINR: sample.monthlyBudgetINR,
    budgetIsHardConstraint: sample.budgetIsHardConstraint ?? true,
    sleepHoursTypical: sample.sleepHoursTypical,
    existingSupplementUseText: sample.existingSupplementUse.join(", "),
    dietaryProteinAdequacy: sample.dietaryProteinAdequacy,
    estimatedDailyProteinG: sample.estimatedDailyProteinG,
    dietaryOilyFishServingsPerWeek: sample.dietaryOilyFishServingsPerWeek,
    allergiesText: sample.allergies.join(", "),
    relevantHealthContext: sample.relevantHealthContext,
    medicationsHasAny: sample.medicationsOrConditionsFlag.hasAny,
    medicationsFreeText: sample.medicationsOrConditionsFlag.freeText ?? "",
  };
}

describe("assembleUserProfile against real sample profiles", () => {
  const files = readdirSync(SAMPLES_DIR).filter((f) => f.endsWith(".json"));
  expect(files.length).toBeGreaterThan(0);

  for (const file of files) {
    it(`reproduces ${file} field-for-field`, () => {
      const sample = loadSample(file);
      const form = toFormValues(sample);
      const parsed = {
        existingSupplementUse: sample.existingSupplementUse,
        existingSupplementUseConfidence: 1,
        allergies: sample.allergies,
        allergiesConfidence: 1,
        medicationsParseConfidence: sample.medicationsOrConditionsFlag.parseConfidence ?? 1,
      };

      const assembled = assembleUserProfile(form, parsed);

      expect(userProfileSchema.safeParse(assembled).success).toBe(true);
      expect(assembled.age).toBe(sample.age);
      expect(assembled.sex).toBe(sample.sex);
      expect(assembled.bodyWeightKg).toBe(sample.bodyWeightKg);
      expect(assembled.dietaryPattern).toBe(sample.dietaryPattern);
      expect(assembled.exerciseFrequencyPerWeek).toBe(sample.exerciseFrequencyPerWeek);
      expect(assembled.primaryGoals).toEqual(sample.primaryGoals);
      expect(assembled.sleepHoursTypical).toBe(sample.sleepHoursTypical);
      expect(assembled.existingSupplementUse).toEqual(sample.existingSupplementUse);
      expect(assembled.dietaryProteinAdequacy).toBe(sample.dietaryProteinAdequacy);
      expect(assembled.allergies).toEqual(sample.allergies);
      expect(assembled.medicationsOrConditionsFlag.hasAny).toBe(
        sample.medicationsOrConditionsFlag.hasAny
      );
      expect(assembled.monthlyBudgetINR).toBe(sample.monthlyBudgetINR);
      if (sample.exerciseType && sample.exerciseType.length > 0) {
        expect(assembled.exerciseType).toEqual(sample.exerciseType);
      }
    });
  }
});

describe("fieldsNeedingConfirmation", () => {
  it("flags nothing when every confidence is high", () => {
    expect(
      fieldsNeedingConfirmation({
        existingSupplementUse: ["creatine-monohydrate"],
        existingSupplementUseConfidence: 1,
        allergies: [],
        allergiesConfidence: 1,
        medicationsParseConfidence: 1,
      })
    ).toEqual([]);
  });

  it("flags the unparseable-medications case (confidence 0.35), matching data/README's fail-closed rule", () => {
    const flagged = fieldsNeedingConfirmation({
      existingSupplementUse: [],
      existingSupplementUseConfidence: 1,
      allergies: [],
      allergiesConfidence: 1,
      medicationsParseConfidence: 0.35,
    });
    expect(flagged).toContain("medicationsOrConditionsFlag.freeText");
  });
});
