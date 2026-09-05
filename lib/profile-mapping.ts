// Pure mapping between the camelCase UserProfile (types/engine.ts, what
// Package D's intake flow and Package B's engine both speak) and the
// snake_case profile_versions row (data/db/schema.sql). No `pg` import here
// on purpose -- keeps this testable without a live database.
import type { UserProfile } from "@/types/engine";

export interface ProfileVersionRow {
  id: string;
  user_id: string;
  created_at: Date;
  age: number;
  sex: string;
  body_weight_kg: string | number;
  height_cm: string | number | null;
  dietary_pattern: string;
  exercise_frequency_pw: number;
  exercise_type: string[];
  primary_goals: string[];
  sleep_hours_typical: string | number | null;
  existing_supplement_use: string[];
  dietary_protein_adequacy: string;
  estimated_daily_protein_g: string | number | null;
  oily_fish_servings_pw: number | null;
  allergies: string[];
  relevant_health_context: string | null;
  is_pregnant_or_bf: boolean;
  medications_has_any: boolean;
  medications_free_text: string | null;
  medications_parse_conf: string | number | null;
  monthly_budget_inr: number | null;
  budget_is_hard_constraint: boolean;
  field_confidence: Record<string, number>;
  confirmed_by_user: string[];
}

// node-postgres returns `numeric` columns as strings (to avoid float
// precision loss) but jsonb/int/boolean/array columns already parsed --
// this only needs to handle the numeric ones.
function toNumber(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  return typeof value === "number" ? value : parseFloat(value);
}

export function rowToProfile(row: ProfileVersionRow): UserProfile {
  return {
    age: row.age,
    sex: row.sex as UserProfile["sex"],
    bodyWeightKg: toNumber(row.body_weight_kg) as number,
    heightCm: toNumber(row.height_cm),
    monthlyBudgetINR: row.monthly_budget_inr ?? undefined,
    budgetIsHardConstraint: row.budget_is_hard_constraint,
    isPregnantOrBreastfeeding: row.is_pregnant_or_bf,
    dietaryPattern: row.dietary_pattern as UserProfile["dietaryPattern"],
    exerciseFrequencyPerWeek: row.exercise_frequency_pw,
    exerciseType: row.exercise_type as UserProfile["exerciseType"],
    primaryGoals: row.primary_goals as UserProfile["primaryGoals"],
    sleepHoursTypical: toNumber(row.sleep_hours_typical) as number,
    existingSupplementUse: row.existing_supplement_use,
    dietaryProteinAdequacy: row.dietary_protein_adequacy as UserProfile["dietaryProteinAdequacy"],
    estimatedDailyProteinG: toNumber(row.estimated_daily_protein_g),
    dietaryOilyFishServingsPerWeek: row.oily_fish_servings_pw ?? undefined,
    allergies: row.allergies,
    relevantHealthContext: row.relevant_health_context ?? undefined,
    medicationsOrConditionsFlag: {
      hasAny: row.medications_has_any,
      freeText: row.medications_free_text ?? undefined,
      parseConfidence: toNumber(row.medications_parse_conf),
    },
    _meta: {
      fieldConfidence: row.field_confidence,
      confirmedByUser: row.confirmed_by_user,
    },
  };
}

// Column order for the INSERT in lib/profile.ts. Keep this array and
// profileToInsertParams()'s return order in lockstep -- the smoke test
// (lib/__tests__/profile-mapping.test.ts) checks the lengths match.
export const PROFILE_INSERT_COLUMNS = [
  "user_id",
  "age",
  "sex",
  "body_weight_kg",
  "height_cm",
  "dietary_pattern",
  "exercise_frequency_pw",
  "exercise_type",
  "primary_goals",
  "sleep_hours_typical",
  "existing_supplement_use",
  "dietary_protein_adequacy",
  "estimated_daily_protein_g",
  "oily_fish_servings_pw",
  "allergies",
  "relevant_health_context",
  "is_pregnant_or_bf",
  "medications_has_any",
  "medications_free_text",
  "medications_parse_conf",
  "monthly_budget_inr",
  "budget_is_hard_constraint",
  "field_confidence",
  "confirmed_by_user",
] as const;

export function profileToInsertParams(profile: UserProfile, userId: string): unknown[] {
  return [
    userId,
    profile.age,
    profile.sex,
    profile.bodyWeightKg,
    profile.heightCm ?? null,
    profile.dietaryPattern,
    profile.exerciseFrequencyPerWeek,
    profile.exerciseType ?? [],
    profile.primaryGoals,
    profile.sleepHoursTypical,
    profile.existingSupplementUse,
    profile.dietaryProteinAdequacy,
    profile.estimatedDailyProteinG ?? null,
    profile.dietaryOilyFishServingsPerWeek ?? null,
    profile.allergies,
    profile.relevantHealthContext ?? null,
    profile.isPregnantOrBreastfeeding ?? false,
    profile.medicationsOrConditionsFlag.hasAny,
    profile.medicationsOrConditionsFlag.freeText ?? null,
    profile.medicationsOrConditionsFlag.parseConfidence ?? null,
    profile.monthlyBudgetINR ?? null,
    profile.budgetIsHardConstraint ?? true,
    profile._meta?.fieldConfidence ?? {},
    profile._meta?.confirmedByUser ?? [],
  ];
}
