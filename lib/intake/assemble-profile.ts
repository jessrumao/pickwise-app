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

// Below this g/kg-bodyweight threshold, dietary protein is treated as
// "likely_inadequate" for elig-protein-complete.json's eligibility check
// (`dietaryProteinAdequacy != "likely_adequate"`). Set at the CONSERVATIVE
// (lower) end of the "1.2–2.0g/kg depending on goal" range shown to the
// user on the intake question — a single goal-independent cutoff, not a
// per-goal target. This is a judgment call, not a domain-reviewed figure:
// a muscle-gain-focused user sitting at, say, 1.4g/kg would be classified
// "adequate" and made ineligible here even though 2.0g/kg might be more
// appropriate for their specific goal. Flagged for Package A review.
export const ADEQUATE_PROTEIN_G_PER_KG = 1.2;

// Replaces what used to be a separate self-reported "do you feel you get
// enough protein?" question. Once a real gram estimate is collected either
// way (manual slider or the AI describe-your-diet escape hatch), asking the
// user to ALSO subjectively judge their own adequacy was a redundant second
// question — this derives the same eligibility-relevant classification from
// the number itself. Never returns "unsure": the intake form always
// produces a real number now, so there's nothing left to be unsure about at
// this point (unlike UserProfile's own schema, which keeps "unsure" as a
// valid value for other profile sources — e.g. samples — that don't go
// through the intake form).
export function deriveDietaryProteinAdequacy(
  estimatedDailyProteinG: number,
  bodyWeightKg: number
): UserProfile["dietaryProteinAdequacy"] {
  const gramsPerKg = bodyWeightKg > 0 ? estimatedDailyProteinG / bodyWeightKg : 0;
  return gramsPerKg >= ADEQUATE_PROTEIN_G_PER_KG ? "likely_adequate" : "likely_inadequate";
}

export function assembleUserProfile(
  form: IntakeFormValues,
  parsed: ParsedFreeText,
  confirmedByUser: string[] = []
): UserProfile {
  const fieldConfidence: Record<string, number> = {
    existingSupplementUse: parsed.existingSupplementUseConfidence,
    allergies: parsed.allergiesConfidence,
    "medicationsOrConditionsFlag.freeText": parsed.medicationsParseConfidence,
    // Full confidence unless it came from the "describe what you eat"
    // AI-estimate escape hatch, which sets a real (always <1, see that
    // route's own prompt) confidence via form.setValue.
    estimatedDailyProteinG: form.estimatedDailyProteinGConfidence ?? 1,
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
    dietaryProteinAdequacy: deriveDietaryProteinAdequacy(
      form.estimatedDailyProteinG,
      form.bodyWeightKg
    ),
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
// the confidences the parse API returned. estimatedDailyProteinGConfidence
// is undefined whenever the slider was set manually (the default path) —
// only the AI-estimate escape hatch ever sets a real value there.
export function fieldsNeedingConfirmation(
  parsed: ParsedFreeText,
  estimatedDailyProteinGConfidence?: number
): string[] {
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
  if (
    estimatedDailyProteinGConfidence != null &&
    estimatedDailyProteinGConfidence < CONFIRMATION_THRESHOLD
  ) {
    needsConfirmation.push("estimatedDailyProteinG");
  }
  return needsConfirmation;
}
