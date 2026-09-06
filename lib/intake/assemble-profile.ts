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
    // freeText deliberately defaults to "" rather than being omitted: the
    // predicate evaluator treats a MISSING field as UNKNOWN (fails closed to
    // escalate, per predicate.ts's "fail-closed hinge"), but treats an empty
    // string as a definite no-match. Omitting this when the user answers "No"
    // to medications — the common case — was making several unrelated safety
    // policies escalate that check this field via `matches`.
    medicationsOrConditionsFlag: {
      hasAny: form.medicationsHasAny,
      freeText: form.medicationsFreeText || "",
      parseConfidence: parsed.medicationsParseConfidence,
    },
    _meta: {
      fieldConfidence,
      confirmedByUser,
    },
  };

  profile.heightCm = form.heightCm; // required in the intake form now
  if (form.monthlyBudgetINR !== undefined) profile.monthlyBudgetINR = form.monthlyBudgetINR;
  profile.budgetIsHardConstraint = form.budgetIsHardConstraint;
  // Always set, never omitted: user-profile.schema.json's own notes say this
  // "defaults to false otherwise" for non-female users — omitting it here
  // instead made it UNKNOWN, which fails closed to a GLOBAL escalation on
  // safety-global-pregnancy for every non-female submission (its onUnknown
  // is "true"). Caught via generateRecommendations() in the regression test
  // below, not by inspecting the assembled shape alone.
  profile.isPregnantOrBreastfeeding =
    form.sex === "female" ? (form.isPregnantOrBreastfeeding ?? false) : false;
  if (form.exerciseType && form.exerciseType.length > 0) {
    profile.exerciseType = form.exerciseType;
  }
  profile.exerciseIntensityTypical = form.exerciseIntensityTypical;
  // Both required in the intake form now (see schema.ts) — always set.
  profile.estimatedDailyProteinG = form.estimatedDailyProteinG;
  profile.dietaryOilyFishServingsPerWeek = form.dietaryOilyFishServingsPerWeek;
  // Same fail-closed trap as medicationsOrConditionsFlag.freeText above:
  // always set this (default ""), never omit it, or a blank answer to this
  // optional question reads as UNKNOWN instead of "nothing to report" to any
  // safety policy's `matches` check on this field.
  profile.relevantHealthContext = form.relevantHealthContext ?? "";

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
