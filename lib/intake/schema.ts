// Package D — intake form schema.
//
// Mirrors data/schema/user-profile.schema.json / types/engine.ts's
// userProfileSchema, but shaped for the form rather than the engine: the
// three free-text fields the AI normalizes (Q8/Q11/Q13) stay as raw strings
// here and are only turned into UserProfile's structured arrays/objects by
// assembleUserProfile() after the parse API call, right before submit.
import { z } from "zod";
import {
  dietaryPatternSchema,
  exerciseTypeSchema,
  primaryGoalSchema,
} from "@/types/engine";

// Deliberately no z.coerce: every numeric field is set via an explicit
// valueAsNumber onChange in the UI, so the form's values are real numbers
// end to end and useForm<IntakeFormValues> can type against this schema's
// input and output the same way (coerce schemas have a different, wider
// input type, which breaks that generic).
export const intakeFormSchema = z
  .object({
    age: z.number().int().min(18).max(100),
    sex: z.enum(["male", "female", "prefer_not_to_say"]),
    isPregnantOrBreastfeeding: z.boolean().optional(),
    bodyWeightKg: z.number().min(30).max(250),
    // Required in the intake form (unlike UserProfile's own schema, where
    // it stays optional — no MVP rule reads it yet). Product decision: ask
    // for it up front so it's never missing later if a rule needs it.
    heightCm: z.number().min(100).max(250),
    dietaryPattern: dietaryPatternSchema,
    exerciseFrequencyPerWeek: z.number().int().min(0).max(14),
    exerciseType: z.array(exerciseTypeSchema).optional(),
    primaryGoals: z
      .array(primaryGoalSchema)
      .min(1, "Pick at least one.")
      .max(3, "Pick up to 3."),
    monthlyBudgetINR: z.number().int().min(0).optional(),
    // No .default(): would give this field a wider "optional in input, required
    // in output" type than useForm<IntakeFormValues> expects. DEFAULT_VALUES in
    // intake-flow.tsx supplies the actual default (true).
    budgetIsHardConstraint: z.boolean(),
    sleepHoursTypical: z.number().min(0).max(14),
    existingSupplementUseText: z.string(),
    dietaryProteinAdequacy: z.enum(["likely_adequate", "likely_inadequate", "unsure"]),
    estimatedDailyProteinG: z.number().min(0).max(400).optional(),
    dietaryOilyFishServingsPerWeek: z.number().int().min(0).max(21).optional(),
    allergiesText: z.string(),
    relevantHealthContext: z.string().optional(),
    medicationsHasAny: z.boolean(),
    medicationsFreeText: z.string(),
  })
  .superRefine((val, ctx) => {
    if (val.sex === "female" && val.isPregnantOrBreastfeeding === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["isPregnantOrBreastfeeding"],
        message: "Please answer this question.",
      });
    }
    if (val.medicationsHasAny && val.medicationsFreeText.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["medicationsFreeText"],
        message: "Please list them, even briefly.",
      });
    }
  });

export type IntakeFormValues = z.infer<typeof intakeFormSchema>;

// Field groups validated together as the user advances one step at a time.
// Kept separate from the step *copy* (in intake-flow.tsx) so validation
// stays correct even if the visual grouping changes. Grouped by theme
// (about you / diet & activity / goals & budget / sleep & supplements /
// diet gaps / allergies & safety) rather than one question per screen —
// each screen mixes its required question(s) with the optional ones that
// belong to the same topic, so filling in an optional field never costs a
// separate screen of its own.
export const STEP_FIELDS: (keyof IntakeFormValues)[][] = [
  [], // 0: intro/framing, nothing to validate
  ["age", "sex", "isPregnantOrBreastfeeding", "bodyWeightKg", "heightCm"], // 1: about you
  ["dietaryPattern", "exerciseFrequencyPerWeek", "exerciseType"], // 2: diet & activity
  ["primaryGoals", "monthlyBudgetINR", "budgetIsHardConstraint"], // 3: goals & budget
  ["sleepHoursTypical", "existingSupplementUseText"], // 4: sleep & current supplements
  ["dietaryProteinAdequacy", "estimatedDailyProteinG", "dietaryOilyFishServingsPerWeek"], // 5: diet gaps
  ["allergiesText", "relevantHealthContext", "medicationsHasAny", "medicationsFreeText"], // 6: allergies & safety
  [], // 7: review & submit
];

export const TOTAL_STEPS = STEP_FIELDS.length;

// Human-readable section titles for the review screen's "Edit" links,
// indexed the same way as STEP_FIELDS (skips 0 and the last/review step).
export const STEP_TITLES: Record<number, string> = {
  1: "About you",
  2: "Diet & activity",
  3: "Goals & budget",
  4: "Sleep & current supplements",
  5: "Diet gaps",
  6: "Allergies & safety",
};
