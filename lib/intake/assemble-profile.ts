// Package D — turns validated form state + the AI free-text parse result
// into the exact UserProfile shape lib/engine expects. Kept as a pure
// function (no fetch, no React) so it can be unit-tested against the known
// sample profiles without a network call.
import type { IntakeFormValues } from "@/lib/intake/schema";
import type { UserProfile } from "@/types/engine";

export interface ParsedFreeText {
  existingSupplementUse: string[];
  existingSupplementUseConfidence: number;
  allergies: string[];
  allergiesConfidence: number;
  medicationsParseConfidence: number;
}

// Fields below this confidence must be confirmed by the user before the
// profile version is written (per user-profile.schema.json's _meta notes).
export const CONFIRMATION_THRESHOLD = 0.7;

export function assembleUserProfile(
  form: IntakeFormValues,
  parsed: ParsedFreeText,
  confirmedByUser: string[] = []
): UserProfile {
  const fieldConfidence: Record<string, number> = {
    existingSupplementUse: parsed.existingSupplementUseConfidence,
    allergies: parsed.allergiesConfidence,
    "medicationsOrConditionsFlag.freeText": parsed.medicationsParseConfidence,
  };

  const profile: UserProfile = {
    age: form.age,
    sex: form.sex,
    bodyWeightKg: form.bodyWeightKg,
    dietaryPattern: form.dietaryPattern,
    exerciseFrequencyPerWeek: form.exerciseFrequencyPerWeek,
    primaryGoals: form.primaryGoals,
    sleepHoursTypical: form.sleepHoursTypical,
    existingSupplementUse: parsed.existingSupplementUse,
    dietaryProteinAdequacy: form.dietaryProteinAdequacy,
    allergies: parsed.allergies,
    medicationsOrConditionsFlag: {
      hasAny: form.medicationsHasAny,
      freeText: form.medicationsFreeText || undefined,
      parseConfidence: parsed.medicationsParseConfidence,
    },
    _meta: {
      fieldConfidence,
      confirmedByUser,
    },
  };

  if (form.heightCm !== undefined) profile.heightCm = form.heightCm;
  if (form.monthlyBudgetINR !== undefined) profile.monthlyBudgetINR = form.monthlyBudgetINR;
  profile.budgetIsHardConstraint = form.budgetIsHardConstraint;
  if (form.sex === "female") {
    profile.isPregnantOrBreastfeeding = form.isPregnantOrBreastfeeding ?? false;
  }
  if (form.exerciseType && form.exerciseType.length > 0) {
    profile.exerciseType = form.exerciseType;
  }
  if (form.estimatedDailyProteinG !== undefined) {
    profile.estimatedDailyProteinG = form.estimatedDailyProteinG;
  }
  if (form.dietaryOilyFishServingsPerWeek !== undefined) {
    profile.dietaryOilyFishServingsPerWeek = form.dietaryOilyFishServingsPerWeek;
  }
  if (form.relevantHealthContext) {
    profile.relevantHealthContext = form.relevantHealthContext;
  }

  return profile;
}

// Which parsed fields need explicit user confirmation before submit, given
// the confidences the parse API returned.
export function fieldsNeedingConfirmation(parsed: ParsedFreeText): string[] {
  const needsConfirmation: string[] = [];
  if (parsed.existingSupplementUseConfidence < CONFIRMATION_THRESHOLD) {
    needsConfirmation.push("existingSupplementUse");
  }
  if (parsed.allergiesConfidence < CONFIRMATION_THRESHOLD) {
    needsConfirmation.push("allergies");
  }
  if (parsed.medicationsParseConfidence < CONFIRMATION_THRESHOLD) {
    needsConfirmation.push("medicationsOrConditionsFlag.freeText");
  }
  return needsConfirmation;
}
