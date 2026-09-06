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
import { generateRecommendations } from "@/lib/engine";

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
    heightCm: sample.heightCm ?? 170, // required in the form; the 5 real samples predate that
    dietaryPattern: sample.dietaryPattern,
    exerciseFrequencyPerWeek: sample.exerciseFrequencyPerWeek,
    exerciseType: sample.exerciseType ?? [],
    exerciseIntensityTypical: sample.exerciseIntensityTypical ?? "moderate", // required in the form; no sample predates this
    primaryGoals: sample.primaryGoals,
    monthlyBudgetINR: sample.monthlyBudgetINR,
    budgetIsHardConstraint: sample.budgetIsHardConstraint ?? true,
    sleepHoursTypical: sample.sleepHoursTypical,
    existingSupplementUseText: sample.existingSupplementUse.join(", "),
    dietaryProteinAdequacy: sample.dietaryProteinAdequacy,
    // required in the form; only vegetarian-muscle-gain's sample sets this
    estimatedDailyProteinG: sample.estimatedDailyProteinG ?? 60,
    proteinFoodDescription: "",
    // required in the form; every sample already sets this, ?? 0 is just a type-safe fallback
    dietaryOilyFishServingsPerWeek: sample.dietaryOilyFishServingsPerWeek ?? 0,
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

  it("ignores estimatedDailyProteinGConfidence when undefined (the default, manual-slider path)", () => {
    const flagged = fieldsNeedingConfirmation(
      {
        existingSupplementUse: [],
        existingSupplementUseConfidence: 1,
        allergies: [],
        allergiesConfidence: 1,
        medicationsParseConfidence: 1,
      },
      undefined
    );
    expect(flagged).toEqual([]);
  });

  it("flags estimatedDailyProteinG when the AI-estimate escape hatch returns low confidence", () => {
    const flagged = fieldsNeedingConfirmation(
      {
        existingSupplementUse: [],
        existingSupplementUseConfidence: 1,
        allergies: [],
        allergiesConfidence: 1,
        medicationsParseConfidence: 1,
      },
      0.4
    );
    expect(flagged).toContain("estimatedDailyProteinG");
  });
});

// Regression test for a real bug found via manual Package E browser testing:
// leaving the two optional free-text questions blank (relevantHealthContext,
// medicationsFreeText when hasAny is false) used to OMIT those fields from
// the assembled profile rather than sending "". predicate.ts's evaluator
// treats a genuinely MISSING field as UNKNOWN and fails closed to escalate,
// but treats an empty string as a definite non-match — so a routine "no,
// nothing else to report" answer was making five unrelated safety policies
// (kidney/renal, anticoagulant, immunocompromised, iron) all escalate for
// every such user. Verified end-to-end through the real engine, not just
// against the assembled object shape, since that's how the bug surfaced.
describe("blank optional free-text fields must not read as UNKNOWN to the safety gate", () => {
  const blankOptionalFieldsForm: IntakeFormValues = {
    age: 29,
    sex: "male",
    isPregnantOrBreastfeeding: undefined,
    bodyWeightKg: 72,
    heightCm: 175,
    dietaryPattern: "vegetarian",
    exerciseFrequencyPerWeek: 4,
    exerciseType: ["resistance_training"],
    exerciseIntensityTypical: "moderate",
    primaryGoals: ["muscle_gain"],
    monthlyBudgetINR: undefined,
    budgetIsHardConstraint: true,
    sleepHoursTypical: 7,
    existingSupplementUseText: "",
    dietaryProteinAdequacy: "likely_inadequate",
    estimatedDailyProteinG: 90,
    proteinFoodDescription: "",
    dietaryOilyFishServingsPerWeek: 0,
    allergiesText: "",
    relevantHealthContext: undefined, // left blank, as most users will
    medicationsHasAny: false,
    medicationsFreeText: "", // "No" answer's default
  };
  const noOpParsed = {
    existingSupplementUse: [],
    existingSupplementUseConfidence: 1,
    allergies: [],
    allergiesConfidence: 1,
    medicationsParseConfidence: 1,
  };

  it("assembles relevantHealthContext and medicationsOrConditionsFlag.freeText as empty strings, not undefined", () => {
    const profile = assembleUserProfile(blankOptionalFieldsForm, noOpParsed);
    expect(profile.relevantHealthContext).toBe("");
    expect(profile.medicationsOrConditionsFlag.freeText).toBe("");
  });

  it("produces no safety escalation of any kind for a profile with nothing to report", () => {
    const profile = assembleUserProfile(blankOptionalFieldsForm, noOpParsed);
    const result = generateRecommendations(profile);
    expect(result.globalEscalation).toBeUndefined();
    const escalated = result.recommendations.filter((r) => r.status === "escalate");
    expect(escalated).toEqual([]);
  });
});
