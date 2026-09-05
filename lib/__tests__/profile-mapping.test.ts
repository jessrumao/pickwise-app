import { describe, it, expect } from "vitest";
import {
  rowToProfile,
  profileToInsertParams,
  PROFILE_INSERT_COLUMNS,
  type ProfileVersionRow,
} from "@/lib/profile-mapping";
import { userProfileSchema } from "@/types/engine";
import vegetarianMuscleGain from "@/data/tools/samples/vegetarian-muscle-gain.json";

describe("profileToInsertParams", () => {
  it("returns one param per PROFILE_INSERT_COLUMNS entry, in the same order", () => {
    const profile = userProfileSchema.parse(vegetarianMuscleGain);
    const params = profileToInsertParams(profile, "user-1");
    expect(params.length).toBe(PROFILE_INSERT_COLUMNS.length);
    expect(params[0]).toBe("user-1"); // user_id first
    expect(PROFILE_INSERT_COLUMNS[1]).toBe("age");
    expect(params[1]).toBe(profile.age);
  });
});

describe("rowToProfile", () => {
  it("round-trips a real sample profile through insert-params shape and back", () => {
    const profile = userProfileSchema.parse(vegetarianMuscleGain);

    // Simulate what Postgres would hand back: numeric columns as strings,
    // arrays/jsonb already parsed, matching node-postgres' actual behavior.
    const row: ProfileVersionRow = {
      id: "pv-1",
      user_id: "user-1",
      created_at: new Date("2026-09-05T00:00:00Z"),
      age: profile.age,
      sex: profile.sex,
      body_weight_kg: String(profile.bodyWeightKg),
      height_cm: profile.heightCm != null ? String(profile.heightCm) : null,
      dietary_pattern: profile.dietaryPattern,
      exercise_frequency_pw: profile.exerciseFrequencyPerWeek,
      exercise_type: profile.exerciseType ?? [],
      primary_goals: profile.primaryGoals,
      sleep_hours_typical: String(profile.sleepHoursTypical),
      existing_supplement_use: profile.existingSupplementUse,
      dietary_protein_adequacy: profile.dietaryProteinAdequacy,
      estimated_daily_protein_g:
        profile.estimatedDailyProteinG != null ? String(profile.estimatedDailyProteinG) : null,
      oily_fish_servings_pw: profile.dietaryOilyFishServingsPerWeek ?? null,
      allergies: profile.allergies,
      relevant_health_context: profile.relevantHealthContext ?? null,
      is_pregnant_or_bf: profile.isPregnantOrBreastfeeding ?? false,
      medications_has_any: profile.medicationsOrConditionsFlag.hasAny,
      medications_free_text: profile.medicationsOrConditionsFlag.freeText ?? null,
      medications_parse_conf:
        profile.medicationsOrConditionsFlag.parseConfidence != null
          ? String(profile.medicationsOrConditionsFlag.parseConfidence)
          : null,
      monthly_budget_inr: profile.monthlyBudgetINR ?? null,
      budget_is_hard_constraint: profile.budgetIsHardConstraint ?? true,
      field_confidence: profile._meta?.fieldConfidence ?? {},
      confirmed_by_user: profile._meta?.confirmedByUser ?? [],
    };

    const roundTripped = rowToProfile(row);
    expect(userProfileSchema.safeParse(roundTripped).success).toBe(true);
    expect(roundTripped.bodyWeightKg).toBe(profile.bodyWeightKg); // numeric string -> number
    expect(roundTripped.primaryGoals).toEqual(profile.primaryGoals);
    expect(roundTripped.medicationsOrConditionsFlag.hasAny).toBe(false);
  });
});
