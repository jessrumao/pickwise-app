// types/engine.ts
//
// Shared TypeScript contracts for the recommendation engine, published by
// Package B0 (tasks/B0-bootstrap-and-types.md) so Packages B, D, E and G can
// build against real types instead of mocks. Nothing in this file is engine
// LOGIC — it is the shape of the data the engine reads and produces. Logic
// lives in lib/engine/ (Package B).
//
// Source of truth for every shape here is data/schema/*.json (the JSON
// Schema contracts — read their `description` fields, they carry the
// reasoning) plus the runtime behaviour in data/tools/predicate.mjs and
// data/tools/demo.mjs (the reference implementation this gets ported from).
// If a schema file changes, this file must change with it — nothing enforces
// that automatically yet.
//
// Convention: zod schemas (+ z.infer types) for shapes that come from
// data/**/*.json or from user input — the same pattern types/data.ts already
// uses, and it means Package A's JSON records can be runtime-validated
// against these at load time, not just type-checked. Plain TypeScript types
// for shapes the engine only ever *produces* at runtime (Trace, ServingPlan,
// Recommendation, BudgetOutcome) — nothing untrusted flows into those, so a
// zod schema would just be ceremony.

import { z } from "zod";

// ---------------------------------------------------------------------------
// Kleene (three-valued) logic
// ---------------------------------------------------------------------------

// Matches the literal string constants exported as T/F/U from
// data/tools/predicate.mjs. A missing/null field evaluates to UNKNOWN, never
// FALSE — each policy then declares what UNKNOWN means for it via onUnknown.
export const TRUE = "true" as const;
export const FALSE = "false" as const;
export const UNKNOWN = "unknown" as const;
export type TriState = typeof TRUE | typeof FALSE | typeof UNKNOWN;

// ---------------------------------------------------------------------------
// Predicate AST — data/schema/predicate.schema.json
//
// Boolean expression over a UserProfile, stored as data rather than an
// eval'd string. Modelled here as a discriminated union on operator key
// (rather than "one object, all keys optional" the way the JSON Schema's
// `additionalProperties: false` + prose describes it) so "exactly one
// operator" is enforced by the type system, not just by convention.
// ---------------------------------------------------------------------------

// Dot path into UserProfile, e.g. "primaryGoals" or
// "medicationsOrConditionsFlag.hasAny". Validated against
// user-profile.schema.json at build time by tools/validate.mjs.
export type FieldPath = string;

export type FieldScalar = string | number | boolean;

export interface FieldValueArg {
  field: FieldPath;
  value: FieldScalar;
}
export interface FieldNumberArg {
  field: FieldPath;
  value: number;
}
export interface FieldValuesArg {
  field: FieldPath;
  values: FieldScalar[];
}
export interface ExistsArg {
  field: FieldPath;
}
export interface MatchesArg {
  field: FieldPath;
  patterns: string[];
}

export type PredicateNode =
  | { label?: string; all: PredicateNode[] }
  | { label?: string; any: PredicateNode[] }
  | { label?: string; not: PredicateNode }
  | { label?: string; const: boolean }
  | { label?: string; eq: FieldValueArg }
  | { label?: string; neq: FieldValueArg }
  | { label?: string; lt: FieldNumberArg }
  | { label?: string; lte: FieldNumberArg }
  | { label?: string; gt: FieldNumberArg }
  | { label?: string; gte: FieldNumberArg }
  | { label?: string; in: FieldValuesArg }
  | { label?: string; contains_any: FieldValuesArg }
  | { label?: string; contains_all: FieldValuesArg }
  | { label?: string; contains_none: FieldValuesArg }
  | { label?: string; exists: ExistsArg }
  // matches: case-insensitive substring match against free text. Used ONLY
  // by safety rules, never eligibility — see predicate.schema.json's
  // description for why (free-text matching is too blunt to justify a
  // positive recommendation but is exactly the right instrument to escalate).
  | { label?: string; matches: MatchesArg };

const fieldScalarSchema = z.union([z.string(), z.number(), z.boolean()]);
const fieldValueArgSchema = z.object({ field: z.string(), value: fieldScalarSchema });
const fieldNumberArgSchema = z.object({ field: z.string(), value: z.number() });
const fieldValuesArgSchema = z.object({
  field: z.string(),
  values: z.array(fieldScalarSchema).min(1),
});
const existsArgSchema = z.object({ field: z.string() });
const matchesArgSchema = z.object({
  field: z.string(),
  patterns: z.array(z.string()).min(1),
});

// Recursive schema: needs the manual z.ZodType<PredicateNode> annotation
// because zod can't infer a recursive type from z.lazy alone.
export const predicateNodeSchema: z.ZodType<PredicateNode> = z.lazy(() =>
  z.union([
    z.object({ label: z.string().optional(), all: z.array(predicateNodeSchema).min(1) }),
    z.object({ label: z.string().optional(), any: z.array(predicateNodeSchema).min(1) }),
    z.object({ label: z.string().optional(), not: predicateNodeSchema }),
    z.object({ label: z.string().optional(), const: z.boolean() }),
    z.object({ label: z.string().optional(), eq: fieldValueArgSchema }),
    z.object({ label: z.string().optional(), neq: fieldValueArgSchema }),
    z.object({ label: z.string().optional(), lt: fieldNumberArgSchema }),
    z.object({ label: z.string().optional(), lte: fieldNumberArgSchema }),
    z.object({ label: z.string().optional(), gt: fieldNumberArgSchema }),
    z.object({ label: z.string().optional(), gte: fieldNumberArgSchema }),
    z.object({ label: z.string().optional(), in: fieldValuesArgSchema }),
    z.object({ label: z.string().optional(), contains_any: fieldValuesArgSchema }),
    z.object({ label: z.string().optional(), contains_all: fieldValuesArgSchema }),
    z.object({ label: z.string().optional(), contains_none: fieldValuesArgSchema }),
    z.object({ label: z.string().optional(), exists: existsArgSchema }),
    z.object({ label: z.string().optional(), matches: matchesArgSchema }),
  ])
);

// ---------------------------------------------------------------------------
// Evaluation trace — what predicate.mjs's evaluate()/run() return.
//
// This is what the LLM is allowed to phrase (never invent) an explanation
// from. decisive()/explain() in predicate.mjs derive the user-facing "why"
// text from exactly this structure — port those alongside, don't rebuild
// the trace shape differently.
// ---------------------------------------------------------------------------

export type PredicateOp =
  | "all"
  | "any"
  | "not"
  | "const"
  | "eq"
  | "neq"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "in"
  | "contains_any"
  | "contains_all"
  | "contains_none"
  | "exists"
  | "matches";

export interface TraceEntry {
  path: string; // e.g. "$.all[0].any[1]" — position in the predicate tree
  op: PredicateOp;
  field: FieldPath | null; // null for all/any/not/const, which have no field of their own
  expected: unknown; // the value/values/patterns the clause compared against
  actual: unknown; // what was actually read off the profile (undefined/null collapses to UNKNOWN before this point)
  value: TriState;
  label?: string; // human-readable phrase for this clause, when the predicate author gave one
}

export interface EvaluationResult {
  value: TriState;
  trace: TraceEntry[];
}

// ---------------------------------------------------------------------------
// Expert review block — data/schema/review.schema.json
//
// Attached to every individually reviewable judgment, not to whole files: an
// evidence grade, a dosing target and a contraindication are three separate
// sign-offs.
// ---------------------------------------------------------------------------

export const reviewBlockSchema = z.object({
  status: z.enum(["draft_needs_expert_review", "expert_reviewed"]),
  reviewedBy: z.string().nullable().optional(),
  reviewedOn: z.string().nullable().optional(),
  note: z.string().optional(),
});
export type ReviewBlock = z.infer<typeof reviewBlockSchema>;

// ---------------------------------------------------------------------------
// Compound — data/schema/compound.schema.json (L1)
//
// The thing with a physiological effect and a dose. Distinct from an
// Ingredient (a delivery vehicle) and a Product (a SKU). IDs are plain
// strings, not enums: the whole point of the compound/ingredient split is
// that adding a new one is a data change, never a type or rule-code change.
// ---------------------------------------------------------------------------

export type CompoundId = string;

export const compoundSchema = z.object({
  id: z.string(),
  name: z.string(),
  unit: z.enum(["g", "mg", "mcg", "mcg_rae", "mcg_dfe", "iu", "cfu"]),
  class: z.enum([
    "macronutrient",
    "amino_acid",
    "fatty_acid",
    "vitamin",
    "mineral",
    "ergogenic",
    "probiotic_strain",
    "other",
  ]),
  aliases: z.array(z.string()).optional(),
  conversions: z.record(z.string(), z.number()).optional(),
  // Present only on GROUP compounds (e.g. epa-dha, bcaa) — a group's amount
  // is the sum of its members.
  members: z.array(z.string()).optional(),
  // True for probiotic strains, where "the category" isn't a valid unit of
  // recommendation — forces product-level rather than ingredient-level reasoning.
  strainSpecific: z.boolean().optional(),
  notes: z.string().optional(),
});
export type Compound = z.infer<typeof compoundSchema>;

// ---------------------------------------------------------------------------
// Ingredient — data/schema/ingredient.schema.json (L1)
//
// A delivery vehicle for one or more compounds. Fish oil and algal oil are
// two ingredients delivering the same compound (epa-dha) — that's what makes
// vegan substitution a query over delivers[] + suitableFor, never a branch
// in a rule.
// ---------------------------------------------------------------------------

export type IngredientId = string;

export const dietaryPatternSchema = z.enum([
  "omnivore",
  "vegetarian",
  "eggetarian",
  "vegan",
  "pescatarian",
  "other",
]);
export type DietaryPattern = z.infer<typeof dietaryPatternSchema>;

export const ingredientDeliversEntrySchema = z.object({
  compoundId: z.string(),
  // Fraction of the ingredient by mass that is this compound, e.g. 0.78 for
  // whey concentrate protein. Indicative only — the authoritative
  // per-serving number lives on the Product.
  typicalConcentration: z.number().optional(),
});

export const ingredientSchema = z.object({
  id: z.string(),
  name: z.string(),
  // UI grouping only. Never read by the rules engine.
  category: z.enum([
    "protein",
    "performance",
    "micronutrient",
    "gut_health",
    "food_based",
    "recovery_joint",
  ]),
  forms: z.array(z.string()).optional(),
  delivers: z.array(ingredientDeliversEntrySchema).min(1),
  suitableFor: z.array(dietaryPatternSchema),
  allergens: z.array(z.string()).optional(),
  review: reviewBlockSchema,
  notes: z.string().optional(),
});
export type Ingredient = z.infer<typeof ingredientSchema>;

// ---------------------------------------------------------------------------
// Claim — data/schema/claim.schema.json (L2, evidence)
//
// One claim = one (subject x outcome x population) finding, with its grade
// and citations. A claim may legitimately say a compound does NOT work
// (direction: "no_effect") — bcaa is exactly that case.
// ---------------------------------------------------------------------------

export type ClaimId = string;

export const evidenceGradeSchema = z.enum(["Strong", "Moderate", "Limited", "Insufficient"]);
export type EvidenceGrade = z.infer<typeof evidenceGradeSchema>;

export const claimCitationSchema = z.object({
  title: z.string(),
  source: z.string(),
  year: z.number().int().optional(),
  url: z.string(),
  // Optional exact span from the source that supports the statement. When
  // present, the UI shows this rather than a semantically-retrieved chunk.
  pinnedQuote: z.string().optional(),
});

export const claimSchema = z.object({
  id: z.string(),
  subject: z.object({
    type: z.enum(["compound", "ingredient"]),
    id: z.string(),
  }),
  outcomeId: z.string(), // FK into data/entities/outcomes.json
  population: z.object({
    description: z.string(),
    // Optional machine-readable description of the studied population —
    // lets the engine check whether THIS user is inside the population the
    // evidence was drawn from. A directness check, not an eligibility rule.
    predicate: predicateNodeSchema.optional(),
  }),
  direction: z.enum(["increases", "decreases", "no_effect", "unclear"]),
  magnitude: z
    .enum(["trivial", "small", "small_to_moderate", "moderate", "large", "not_applicable"])
    .optional(),
  grade: evidenceGradeSchema,
  gradeRationale: z
    .object({
      designs: z
        .array(
          z.enum([
            "meta_analysis_of_rcts",
            "systematic_review",
            "rct",
            "cohort",
            "case_control",
            "mechanistic",
            "expert_consensus",
            "guideline",
          ])
        )
        .optional(),
      consistency: z.enum(["consistent", "mostly_consistent", "mixed", "inconsistent"]).optional(),
      directness: z.enum(["direct", "indirect"]).optional(),
      note: z.string().optional(),
    })
    .optional(),
  doseResponse: z
    .object({
      summary: z.string().optional(),
      threshold: z.object({ amount: z.number().optional(), unit: z.string().optional() }).optional(),
      plateau: z.object({ amount: z.number().optional(), unit: z.string().optional() }).optional(),
    })
    .optional(),
  // One sentence, plain language — this is the sentence shown under
  // "Why am I seeing this".
  statement: z.string(),
  citations: z.array(claimCitationSchema).min(1).max(6),
  // Pinecone chunk ids carrying this claim's supporting text (Package F).
  // Retrieval for display is a metadata filter on claim id, never an open
  // semantic search.
  vectorRefs: z.array(z.string()).optional(),
  review: reviewBlockSchema,
  version: z.number().int().min(1).optional(),
});
export type Claim = z.infer<typeof claimSchema>;

// ---------------------------------------------------------------------------
// Policy — data/schema/policy.schema.json (L3, expert-governed decisions)
//
// Three kinds, discriminated by `kind`: eligibility (should we surface this
// at all), dosing (how much, how split, when), safety (what forces
// escalation). Every record carries its own review block.
// ---------------------------------------------------------------------------

export type PolicyId = string;

// NOTE: the JSON Schema also requires "exactly one of compoundId /
// ingredientId" (anyOf) on eligibility policies — not encoded below because
// zod's discriminatedUnion needs plain ZodObjects per branch (a .refine()
// wraps it in ZodEffects and breaks that). tools/validate.mjs is the
// enforcement point for that constraint; this type documents it but doesn't
// enforce it.
export const eligibilityPolicySchema = z.object({
  id: z.string(),
  kind: z.literal("eligibility"),
  // Preferred key: eligibility answers "does this person need this
  // COMPOUND", and which ingredient delivers it is a downstream query.
  compoundId: z.string().optional(),
  // Use only where the policy is genuinely about the vehicle rather than a
  // compound — a multivitamin bundle, or a named probiotic product.
  ingredientId: z.string().optional(),
  // FKs into claims/. A policy citing no claim is an opinion — validate.mjs rejects it.
  citesClaims: z.array(z.string()).min(1),
  recommendWhen: predicateNodeSchema,
  // Wins over recommendWhen. This is what implements "the engine visibly
  // does not recommend things".
  suppressWhen: predicateNodeSchema.optional(),
  suppressOutcome: z.enum(["not_needed", "already_covered"]).optional(), // default "not_needed"
  onUnknown: z.literal("false"), // eligibility fails closed towards NOT recommending
  // Render an explicit "not recommended, here's why" card rather than
  // silently omitting. Trust comes from the visible no. Default true.
  showWhenSuppressed: z.boolean().optional(),
  review: reviewBlockSchema,
});
export type EligibilityPolicy = z.infer<typeof eligibilityPolicySchema>;

export const dosingBasisSchema = z.enum(["absolute", "per_kg_bodyweight", "rda_multiple"]);
export type DosingBasis = z.infer<typeof dosingBasisSchema>;

export const dosingTargetSchema = z.object({
  min: z.number().optional(),
  target: z.number(),
  max: z.number().optional(),
  unit: z.string(),
});
export type DosingTarget = z.infer<typeof dosingTargetSchema>;

export const timingConstraintSchema = z.enum([
  "any",
  "with_food",
  "empty_stomach",
  "post_exercise_2h",
  "evening",
  "morning",
]);
export type TimingConstraint = z.infer<typeof timingConstraintSchema>;

// THE FENCE. The LLM (Package G, routine builder) writes the routine
// sentence, but only inside this constraint — it may not invent or relax it.
export const dosingTimingSchema = z.object({
  constraint: timingConstraintSchema,
  // Hard separation, e.g. iron away from calcium.
  separateFromCompoundIds: z.array(z.string()).optional(),
  separationHours: z.number().optional(),
  note: z.string().optional(),
  citesClaims: z.array(z.string()).optional(),
});
export type DosingTiming = z.infer<typeof dosingTimingSchema>;

export const dosingPolicySchema = z.object({
  id: z.string(),
  kind: z.literal("dosing"),
  compoundId: z.string(),
  // True on the one dosing record (dose-multivitamin-rda) where compoundId
  // is actually an ingredient id, because a multivitamin is a bundle, not a
  // compound — flagged in that record's own review note as a placeholder
  // shape, not hidden. Not in the original policy.schema.json draft; added
  // here because real data uses it and an unflagged field would silently
  // vanish through zod's default "strip unknown keys" behavior.
  ingredientScoped: z.boolean().optional(),
  citesClaims: z.array(z.string()).optional(),
  appliesWhen: predicateNodeSchema,
  basis: dosingBasisSchema,
  target: dosingTargetSchema,
  // True where the supplement closes a gap against food intake (protein,
  // EPA+DHA). False where the target IS the supplement dose (creatine).
  subtractDietaryIntake: z.boolean().optional(), // default false
  // Floor below which the supplement isn't worth taking. Guards the
  // rounding rule from rounding DOWN past usefulness.
  minEffectiveDose: z.object({ amount: z.number().optional(), unit: z.string().optional() }).optional(),
  split: z.object({ maxPerServing: z.number().optional(), unit: z.string().optional() }).optional(),
  rounding: z.object({
    mode: z.literal("nearest"), // settled: round to the closest increment, no per-compound tolerance bands
    increment: z.literal(0.5), // half-servings, where splittable
    fallbackIncrementIfNotSplittable: z.number().optional(), // default 1
  }),
  timing: dosingTimingSchema,
  review: reviewBlockSchema,
});
export type DosingPolicy = z.infer<typeof dosingPolicySchema>;

export const safetyPolicySchema = z.object({
  id: z.string(),
  kind: z.literal("safety"),
  appliesTo: z.object({
    compoundIds: z.array(z.string()).optional(),
    ingredientIds: z.array(z.string()).optional(),
    all: z.boolean().optional(), // global rule, e.g. pregnancy
  }),
  trigger: predicateNodeSchema,
  action: z.literal("escalate"), // MVP implements escalate only
  severity: z.enum(["high", "moderate"]).optional(),
  onUnknown: z.literal("true"), // safety fails closed towards escalation
  userMessage: z.string().optional(),
  review: reviewBlockSchema,
});
export type SafetyPolicy = z.infer<typeof safetyPolicySchema>;

export const policySchema = z.discriminatedUnion("kind", [
  eligibilityPolicySchema,
  dosingPolicySchema,
  safetyPolicySchema,
]);
export type Policy = z.infer<typeof policySchema>;

// ---------------------------------------------------------------------------
// Product & pricing — data/schema/product.schema.json + pricing.schema.json (L4)
//
// Deliberately split: composition (Product) is expert-signed and changes
// rarely; price (PricingEntry) is volatile and changes daily. Composition is
// numeric in compound units, which is what makes the UL ledger and
// cost-per-effective-dose computable.
// ---------------------------------------------------------------------------

export type ProductId = string;

export const servingUnitSchema = z.enum([
  "g",
  "ml",
  "scoop",
  "capsule",
  "tablet",
  "softgel",
  "sachet",
]);
export type ServingUnit = z.infer<typeof servingUnitSchema>;

export const deliversPerServingEntrySchema = z.object({
  compoundId: z.string(),
  amount: z.number(),
  unit: z.string(),
  strain: z.string().optional(), // required where the compound is strainSpecific
});

export const productSchema = z.object({
  id: z.string(),
  ingredientId: z.string(),
  productName: z.string(),
  brand: z.string(),
  form: z.string().optional(),
  servingSize: z.object({ amount: z.number(), unit: servingUnitSchema }),
  servingsPerPack: z.number(),
  deliversPerServing: z.array(deliversPerServingEntrySchema).min(1),
  // Can one serving be halved in practice? A scoop with a half-mark or a
  // scored tablet can; a sealed softgel or gummy cannot. The nearest-half
  // rounding rule falls back to whole units when this is false.
  splittable: z.boolean(),
  // NOT a gate in the MVP — the quality floor is effective-dose-met only.
  qualitySignal: z
    .object({
      thirdPartyTested: z.boolean().optional(),
      certifications: z.array(z.string()).optional(),
      note: z.string().optional(),
    })
    .optional(),
  allergens: z.array(z.string()).optional(),
  // Overrides the ingredient's list where a specific SKU differs (e.g. a
  // gelatin capsule on an otherwise vegan ingredient).
  suitableFor: z.array(dietaryPatternSchema).optional(),
  review: reviewBlockSchema,
});
export type Product = z.infer<typeof productSchema>;

export const marketplaceSchema = z.enum(["Amazon.in", "HealthKart", "Flipkart", "1mg", "PharmEasy"]);
export type Marketplace = z.infer<typeof marketplaceSchema>;

export const pricingEntrySchema = z.object({
  productId: z.string(),
  priceINR: z.number(),
  priceIsIndicative: z.boolean().optional(), // default true
  marketplace: marketplaceSchema,
  marketplaceUrl: z.string(),
  // False means the URL hasn't been confirmed to resolve to THIS product —
  // the UI must not present an unverified link as a product page.
  urlVerified: z.boolean(),
  inStock: z.boolean().nullable().optional(),
});
export type PricingEntry = z.infer<typeof pricingEntrySchema>;

export const pricingFeedSchema = z.object({
  checkedOn: z.string(),
  source: z.enum(["manual", "scraper"]).optional(),
  entries: z.array(pricingEntrySchema),
});
export type PricingFeed = z.infer<typeof pricingFeedSchema>;

// ---------------------------------------------------------------------------
// UserProfile — data/schema/user-profile.schema.json
//
// Structured profile produced by the intake flow (Package D). The AI's only
// job is parsing free text into these fields with a confidence per field —
// nothing here decides a recommendation. Persisted as an immutable row in
// profile_versions (Package C): every edit writes a new version.
// ---------------------------------------------------------------------------

export const primaryGoalSchema = z.enum([
  "muscle_gain",
  "strength_performance",
  "weight_loss",
  "general_fitness",
  "general_wellness",
  "energy_fatigue",
  "digestive_health",
  "immunity",
  "sleep_quality",
  "joint_health",
  "skin_hair_nails",
  "endurance_performance",
]);
export type PrimaryGoal = z.infer<typeof primaryGoalSchema>;

export const exerciseTypeSchema = z.enum([
  "resistance_training",
  "cardio_endurance",
  "mixed",
  "yoga_mobility",
  "sport_specific",
  "none",
]);
export type ExerciseType = z.infer<typeof exerciseTypeSchema>;

// ADDED 2026-09-06. Additive nuance dimension alongside exerciseFrequencyPerWeek
// and exerciseType — frequency/type say how often and what kind, this says how
// hard a typical session is. Deliberately NOT a composite BMR/TDEE-style
// "activity level" label (those blend frequency+intensity into one fuzzy
// band, which is harder for a rules engine to gate on reliably than the
// clean numeric frequency question this project already asks). Not yet read
// by any eligibility/dosing/safety policy — collected for whoever next
// authors policy that could use it (e.g. beta-alanine/caffeine relevance is
// really about intensity, not just goal + frequency).
export const exerciseIntensitySchema = z.enum(["light", "moderate", "vigorous"]);
export type ExerciseIntensity = z.infer<typeof exerciseIntensitySchema>;

export const medicationsOrConditionsFlagSchema = z.object({
  hasAny: z.boolean(),
  freeText: z.string().optional(),
  // Set by the AI parser. Below the threshold, the safety gate treats the
  // field as unknown — which, under onUnknown: true, escalates. This is the
  // mechanism that stops an unparseable medication list from being silently
  // skipped.
  parseConfidence: z.number().min(0).max(1).optional(),
});
export type MedicationsOrConditionsFlag = z.infer<typeof medicationsOrConditionsFlagSchema>;

export const userProfileSchema = z.object({
  age: z.number().int().min(18).max(100),
  sex: z.enum(["male", "female", "prefer_not_to_say"]),
  // Required. Protein targets are g/kg/day and creatine loading is
  // weight-scaled — without this, no dose computes at all. If the user
  // declines, the engine must escalate or fall back to an absolute target,
  // never guess.
  bodyWeightKg: z.number().min(30).max(250),
  heightCm: z.number().min(100).max(250).optional(), // not used by any MVP rule yet
  // Consumed ONLY by the budget allocator, which runs after the
  // recommendation set is fixed. THE RULES ENGINE MUST NEVER READ THIS FIELD
  // — validate.mjs enforces that by rejecting any eligibility/dosing
  // predicate that references it (the "commercial firewall").
  monthlyBudgetINR: z.number().int().min(0).optional(),
  budgetIsHardConstraint: z.boolean().optional(), // default true
  // Hard global escalation trigger. Only asked when sex = female; defaults
  // to false otherwise.
  isPregnantOrBreastfeeding: z.boolean().optional(),
  dietaryPattern: dietaryPatternSchema,
  exerciseFrequencyPerWeek: z.number().int().min(0).max(14),
  exerciseType: z.array(exerciseTypeSchema).optional(),
  // ADDED 2026-09-06. See exerciseIntensitySchema's comment — additive, not
  // yet read by any policy.
  exerciseIntensityTypical: exerciseIntensitySchema.optional(),
  // Order matters: index 0 is the primary goal and scores 2 in
  // goal_alignment; the rest score 1.
  primaryGoals: z.array(primaryGoalSchema).min(1).max(3),
  sleepHoursTypical: z.number().min(0).max(14),
  // Free text normalised by the AI layer to compound ids (compounds.json
  // aliases). Feeds duplicate suppression and the dose ledger.
  existingSupplementUse: z.array(z.string()),
  // Rough self-assessment, not a diet log. "unsure" evaluates to unknown in
  // three-valued logic, which fails closed to not recommending.
  dietaryProteinAdequacy: z.enum(["likely_adequate", "likely_inadequate", "unsure"]),
  // When present, the gap is computed numerically instead of from the
  // adequacy enum — this is what turns "you may need protein" into "you
  // need ~130 g/day and you're getting ~90".
  estimatedDailyProteinG: z.number().min(0).max(400).optional(),
  dietaryOilyFishServingsPerWeek: z.number().int().min(0).max(21).optional(),
  allergies: z.array(z.string()),
  relevantHealthContext: z.string().optional(),
  // hasAny = true is NEVER an escalate-everything switch — it's checked
  // ingredient by ingredient against safety policy.
  medicationsOrConditionsFlag: medicationsOrConditionsFlagSchema,
  _meta: z
    .object({
      // Per-field parse confidence from the LLM intake step. Fields below
      // threshold must be confirmed by the user before the profile version
      // is written.
      fieldConfidence: z.record(z.string(), z.number()).optional(),
      confirmedByUser: z.array(z.string()).optional(),
    })
    .optional(),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

// ---------------------------------------------------------------------------
// ServingPlan — output of predicate.mjs's servingPlan()
//
// Nearest-half rounding, with the settled fallback for products that can't
// be split. Field names match the reference implementation's return value
// one-to-one on purpose, so Package B's TS port can be typed against this
// without renaming anything: { raw, increment, servings, delivered,
// flooredUpToMinEffective }. Worked example (must reproduce exactly): 40g
// gap ÷ 24g/scoop = 1.667 → rounds to 1.5 scoops (36g delivered).
// ---------------------------------------------------------------------------

export interface ServingPlanInput {
  gapAmount: number; // amount still needed, in the compound's unit
  amountPerServing: number; // per-serving delivered amount from the chosen product
  splittable: boolean;
  minEffectiveDose?: number;
}

export interface ServingPlan {
  // Context this plan was computed for — not present on predicate.mjs's raw
  // return value, but needed by anything downstream (UI, routine builder)
  // that wants to show/re-derive the plan without re-threading the inputs.
  compoundId: CompoundId;
  productId: ProductId;
  targetAmount: number; // = ServingPlanInput.gapAmount
  amountPerServing: number;
  unit: string;

  // Exactly predicate.mjs's servingPlan() return shape:
  raw: number; // gapAmount / amountPerServing, unrounded (3 decimal places)
  increment: 0.5 | 1; // 0.5 when splittable, else 1
  servings: number; // rounded to the nearest increment
  delivered: number; // servings * amountPerServing (1 decimal place)
  // True when rounding down would have gone below minEffectiveDose, so the
  // plan was floored UP to the minimum instead — see
  // data-layer-decisions-v2.md consequence #3 (a 2-capsule target must never
  // round down to 1).
  flooredUpToMinEffective: boolean;
}

// ---------------------------------------------------------------------------
// Priority scoring
//
// priority_score = gap_tier + evidence_tier + goal_alignment, ADDITIVE (not
// multiplicative), so it stays explainable in one sentence. Worked example
// that must reproduce: protein (severe/strong/primary) = 3+3+2 = 8; creatine
// (moderate/strong/primary) = 2+3+2 = 7; omega-3 (mild/moderate/secondary) =
// 1+2+1 = 4. No hard override for true nutrient deficiencies — they compete
// on the same score as everything else.
// ---------------------------------------------------------------------------

export type GapTier = 0 | 1 | 2 | 3; // 0 = no gap; 1 mild, 2 moderate, 3 severe
export type EvidenceTier = 0 | 1 | 2 | 3; // Insufficient / Limited / Moderate / Strong
export type GoalAlignmentScore = 0 | 1 | 2; // neither / secondary / primary goal

export interface PriorityScore {
  gapTier: GapTier;
  evidenceTier: EvidenceTier;
  goalAlignment: GoalAlignmentScore;
  total: number; // gapTier + evidenceTier + goalAlignment
}

// ---------------------------------------------------------------------------
// Recommendation — the per-compound (or per-ingredient) engine output
// ---------------------------------------------------------------------------

// Machine-friendly status values. demo.mjs's console output uses the
// corresponding display strings: RECOMMENDED, POTENTIALLY USEFUL, NOT
// NEEDED, ALREADY COVERED, ESCALATE, "not shown" — keep any UI-facing label
// mapping in one place (Package E) rather than duplicating these strings.
export type RecommendationStatus =
  | "recommended" // rule matched, grade >= Moderate
  | "potentially_useful" // rule matched, but evidence grade is Limited/Insufficient
  | "not_needed" // suppressWhen fired, suppressOutcome: "not_needed"
  | "already_covered" // suppressWhen fired, suppressOutcome: "already_covered"
  | "escalate" // a safety policy matched (or fired closed on unknown) for this item
  | "not_shown"; // recommendWhen did not pass and showWhenSuppressed is false

export interface CandidateIngredient {
  ingredientId: IngredientId;
  // True when this ingredient is in the list because it both delivers the
  // recommended compound AND lists the user's dietaryPattern in
  // suitableFor — i.e. it's what the substitution query actually returned,
  // not just every ingredient that happens to deliver the compound.
  matchesUserDiet: boolean;
}

export interface RecommendationDosing {
  policyId: PolicyId;
  target: DosingTarget;
  // target.target already scaled by basis (e.g. x bodyWeightKg for
  // per_kg_bodyweight), when computable from the profile.
  resolvedTargetAmount?: number;
  // resolvedTargetAmount minus dietary intake when a numeric intake estimate
  // is known (estimatedDailyProteinG etc); otherwise falls back to the full
  // resolvedTargetAmount (dietary contribution treated as unknown/zero,
  // never guessed at a nonzero value). Check gapIsQuantified before treating
  // this as a real personalized shortfall vs. a full-target fallback.
  gapAmount?: number;
  // True only when gapAmount reflects an actual measured dietary intake
  // subtracted from the target (protein today, via estimatedDailyProteinG).
  // False when subtractDietaryIntake is false (no gap concept for this
  // compound — creatine, lgg) OR true but no numeric intake field exists yet
  // for this compound (omega-3 — see lib/engine/dosing.ts's flagged
  // limitation). Consumers (priority scoring, UI copy) should treat an
  // unquantified gap as "unknown severity", not as "full deficiency".
  gapIsQuantified: boolean;
  timing: DosingTiming;
}

export interface Recommendation {
  // Exactly one of these is set, matching the eligibility policy that
  // produced this recommendation.
  compoundId?: CompoundId;
  ingredientId?: IngredientId;
  policyId: PolicyId;
  status: RecommendationStatus;
  // Highest grade among the policy's citesClaims (see policy.schema.json's
  // grade-derivation note, and validate.mjs's grade-laundering check).
  grade: EvidenceGrade;
  // Built from the trace via predicate.mjs's explain() — never invented by
  // an LLM. For a RECOMMENDED status this is decisive.trace where value ===
  // TRUE; for a suppressed/not-shown status it's framed as "would need: ...".
  why: string;
  // The recommendWhen (or suppressWhen, whichever decided the status) trace.
  eligibilityTrace: EvaluationResult;
  // Set when a safety policy is what actually produced an "escalate" status.
  safetyTrace?: EvaluationResult;
  // Substitution set for RECOMMENDED/POTENTIALLY USEFUL compound-level
  // recommendations: which ingredients deliver this compound and suit this
  // user's diet (e.g. algal-oil instead of fish-oil for a vegan user).
  candidateIngredients?: CandidateIngredient[];
  dosing?: RecommendationDosing;
  // Set once a specific product has been chosen and the gap is numeric.
  servingPlan?: ServingPlan;
  // Set once the full recommendation set is fixed and priority scoring has
  // run (i.e. after this shape leaves the eligibility stage).
  priorityScore?: PriorityScore;
}

// ---------------------------------------------------------------------------
// BudgetOutcome — the allocator's output
//
// Runs strictly AFTER the recommendation set and priority order are fixed,
// price-blind, in priority order (never cheapest-first). Anything that
// doesn't fit is "deferred" with its price shown, never silently dropped.
// ---------------------------------------------------------------------------

export interface BasketItem {
  recommendation: Recommendation;
  productId: ProductId;
  priceINR: number;
  priorityScore: PriorityScore;
  // True when this item was substituted to a cheaper SKU than the top
  // candidate — only ever allowed above the quality floor (still meets the
  // required effective dose). Absent/false = the top candidate was funded as-is.
  downgradedFromProductId?: ProductId;
}

export interface BudgetOutcome {
  budgetINR?: number; // undefined = user set no limit (monthlyBudgetINR was blank)
  budgetIsHardConstraint: boolean;
  funded: BasketItem[]; // priority order preserved, never re-sorted by price
  deferred: BasketItem[]; // still carries price — never silently dropped
  totalFundedCostINR: number;
  totalDeferredCostINR: number;
}

// ---------------------------------------------------------------------------
// Safety escalation — top-level output of the safety gate (Package B)
//
// A GLOBAL escalation (appliesTo.all) stops the pipeline before eligibility
// runs at all — "no automated recommendation is produced for this profile"
// (see data/tools/demo.mjs's unparseable-medications case). A targeted
// escalation blocks only the compounds/ingredients it names and surfaces as
// an individual Recommendation with status "escalate" instead.
// ---------------------------------------------------------------------------

export interface SafetyEscalation {
  policyId: PolicyId;
  global: boolean; // appliesTo.all
  severity?: "high" | "moderate";
  userMessage?: string;
  why: string; // from explain(trace)
  firedOnUnknown: boolean; // true when this fired because of onUnknown fail-closed, not a direct match
  trace: EvaluationResult;
}

export interface SafetyGateResult {
  escalations: SafetyEscalation[]; // every policy that fired, global and targeted
  globalEscalations: SafetyEscalation[];
  blockedCompoundIds: Set<CompoundId>;
  blockedIngredientIds: Set<IngredientId>;
}
