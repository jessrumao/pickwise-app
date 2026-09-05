// lib/engine/knowledge-base.ts
//
// Loads and indexes every data/ record the engine needs. Uses static ES
// imports (not fs.readdirSync, the way data/tools/demo.mjs does it) so that
// every file the engine reads is visible to the bundler at build time —
// dynamic directory scanning risks a file being silently missing from a
// serverless deployment's file trace. The tradeoff: adding a new ingredient/
// claim/policy/product JSON file means adding one import line here. A
// manifest-freshness test (lib/engine/__tests__/knowledge-base.manifest.test.ts)
// catches the case where a new file exists on disk but was never added here.

import type {
  Compound,
  Ingredient,
  Claim,
  Policy,
  EligibilityPolicy,
  DosingPolicy,
  SafetyPolicy,
  Product,
  PricingEntry,
} from "@/types/engine";

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

import compoundsFile from "@/data/entities/compounds.json";
import goalsFile from "@/data/entities/goals.json";
import outcomesFile from "@/data/entities/outcomes.json";

export interface Goal {
  id: string;
  label: string;
  outcomes: Array<{ outcomeId: string; relation: "primary" | "secondary" }>;
}
export interface Outcome {
  id: string;
  label: string;
}

export const compounds = compoundsFile.compounds as Compound[];
export const goals = goalsFile.goals as Goal[];
export const outcomes = outcomesFile.outcomes as Outcome[];

// ---------------------------------------------------------------------------
// Ingredients (excludes the two DEPRECATED stub files on purpose)
// ---------------------------------------------------------------------------

import algalOil from "@/data/ingredients/algal-oil.json";
import bcaaIngredient from "@/data/ingredients/bcaa.json";
import creatineMonohydrateIngredient from "@/data/ingredients/creatine-monohydrate.json";
import fishOil from "@/data/ingredients/fish-oil.json";
import multivitaminIngredient from "@/data/ingredients/multivitamin.json";
import plantProteinBlend from "@/data/ingredients/plant-protein-blend.json";
import probioticLgg from "@/data/ingredients/probiotic-lgg.json";
import wheyProtein from "@/data/ingredients/whey-protein.json";

export const ingredients: Ingredient[] = [
  algalOil,
  bcaaIngredient,
  creatineMonohydrateIngredient,
  fishOil,
  multivitaminIngredient,
  plantProteinBlend,
  probioticLgg,
  wheyProtein,
] as Ingredient[];

// ---------------------------------------------------------------------------
// Claims (L2 evidence)
// ---------------------------------------------------------------------------

import bcaaNoIncrementalBenefit from "@/data/claims/bcaa-no-incremental-benefit-over-complete-protein.json";
import creatineLeanMass from "@/data/claims/creatine-lean-mass-resistance-trained.json";
import creatineStrengthPower from "@/data/claims/creatine-strength-power-resistance-trained.json";
import epaDhaGeneralPopulation from "@/data/claims/epa-dha-general-population-cv-prevention.json";
import epaDhaTriglyceride from "@/data/claims/epa-dha-triglyceride-lowering.json";
import lggAntibioticDiarrhoea from "@/data/claims/lgg-antibiotic-associated-diarrhoea.json";
import multivitaminCvdCancer from "@/data/claims/multivitamin-cvd-cancer-prevention-insufficient.json";
import multivitaminMicronutrientAdequacy from "@/data/claims/multivitamin-micronutrient-adequacy-restricted-diets.json";
import proteinLeanMass from "@/data/claims/protein-lean-mass-resistance-trained.json";
import proteinStrength from "@/data/claims/protein-strength-resistance-trained.json";

export const claims: Claim[] = [
  bcaaNoIncrementalBenefit,
  creatineLeanMass,
  creatineStrengthPower,
  epaDhaGeneralPopulation,
  epaDhaTriglyceride,
  lggAntibioticDiarrhoea,
  multivitaminCvdCancer,
  multivitaminMicronutrientAdequacy,
  proteinLeanMass,
  proteinStrength,
] as unknown as Claim[];

// ---------------------------------------------------------------------------
// Policy — eligibility, dosing, safety
// ---------------------------------------------------------------------------

import eligBcaa from "@/data/policy/eligibility/elig-bcaa.json";
import eligCreatineMonohydrate from "@/data/policy/eligibility/elig-creatine-monohydrate.json";
import eligEpaDhaGeneral from "@/data/policy/eligibility/elig-epa-dha-general.json";
import eligLgg from "@/data/policy/eligibility/elig-lgg.json";
import eligMultivitamin from "@/data/policy/eligibility/elig-multivitamin.json";
import eligProteinComplete from "@/data/policy/eligibility/elig-protein-complete.json";

export const eligibilityPolicies: EligibilityPolicy[] = [
  eligBcaa,
  eligCreatineMonohydrate,
  eligEpaDhaGeneral,
  eligLgg,
  eligMultivitamin,
  eligProteinComplete,
] as unknown as EligibilityPolicy[];

import doseCreatineMaintenance from "@/data/policy/dosing/dose-creatine-maintenance.json";
import doseEpaDhaGeneralHealth from "@/data/policy/dosing/dose-epa-dha-general-health.json";
import doseLggGeneral from "@/data/policy/dosing/dose-lgg-general.json";
import doseMultivitaminRda from "@/data/policy/dosing/dose-multivitamin-rda.json";
import doseProteinResistanceTraining from "@/data/policy/dosing/dose-protein-resistance-training.json";

export const dosingPolicies: DosingPolicy[] = [
  doseCreatineMaintenance,
  doseEpaDhaGeneralHealth,
  doseLggGeneral,
  doseMultivitaminRda,
  doseProteinResistanceTraining,
] as unknown as DosingPolicy[];

import safetyCreatineRenal from "@/data/policy/safety/safety-creatine-renal.json";
import safetyEpaDhaAnticoagulant from "@/data/policy/safety/safety-epa-dha-anticoagulant.json";
import safetyGlobalPregnancy from "@/data/policy/safety/safety-global-pregnancy.json";
import safetyGlobalUnparseableMedications from "@/data/policy/safety/safety-global-unparseable-medications.json";
import safetyMultivitaminIronOverload from "@/data/policy/safety/safety-multivitamin-iron-overload.json";
import safetyProbioticImmunocompromised from "@/data/policy/safety/safety-probiotic-immunocompromised.json";
import safetyProteinRenal from "@/data/policy/safety/safety-protein-renal.json";
import safetyWheyMilkAllergy from "@/data/policy/safety/safety-whey-milk-allergy.json";

export const safetyPolicies: SafetyPolicy[] = [
  safetyCreatineRenal,
  safetyEpaDhaAnticoagulant,
  safetyGlobalPregnancy,
  safetyGlobalUnparseableMedications,
  safetyMultivitaminIronOverload,
  safetyProbioticImmunocompromised,
  safetyProteinRenal,
  safetyWheyMilkAllergy,
] as unknown as SafetyPolicy[];

export const policies: Policy[] = [...eligibilityPolicies, ...dosingPolicies, ...safetyPolicies];

// ---------------------------------------------------------------------------
// Products & pricing (L4)
// ---------------------------------------------------------------------------

import productsFile from "@/data/products/products.json";
import pricingFile from "@/data/products/pricing.json";

export const products: Product[] = productsFile.products as unknown as Product[];
export const pricingEntries: PricingEntry[] = pricingFile.entries as unknown as PricingEntry[];

// ---------------------------------------------------------------------------
// Indices
// ---------------------------------------------------------------------------

export const compoundById = new Map(compounds.map((c) => [c.id, c]));
export const ingredientById = new Map(ingredients.map((i) => [i.id, i]));
export const claimById = new Map(claims.map((c) => [c.id, c]));
export const eligibilityPolicyById = new Map(eligibilityPolicies.map((p) => [p.id, p]));
export const dosingPolicyById = new Map(dosingPolicies.map((p) => [p.id, p]));
export const safetyPolicyById = new Map(safetyPolicies.map((p) => [p.id, p]));
export const productById = new Map(products.map((p) => [p.id, p]));
export const pricingByProductId = new Map(pricingEntries.map((p) => [p.productId, p]));
export const goalById = new Map(goals.map((g) => [g.id, g]));
export const outcomeById = new Map(outcomes.map((o) => [o.id, o]));

/** Dosing policy that applies to a given compound, if any (0 or 1 per compound in the current data). */
export function dosingPolicyForCompound(compoundId: string): DosingPolicy | undefined {
  return dosingPolicies.find((d) => d.compoundId === compoundId);
}

/** Highest evidence grade among a set of claim ids, as demo.mjs's GRADE_RANK does. */
export const GRADE_RANK: Record<string, number> = { Strong: 3, Moderate: 2, Limited: 1, Insufficient: 0 };
export function highestGrade(claimIds: string[]): { grade: import("@/types/engine").EvidenceGrade; rank: number } {
  let best = { grade: "Insufficient" as import("@/types/engine").EvidenceGrade, rank: -1 };
  for (const id of claimIds) {
    const c = claimById.get(id);
    if (!c) continue;
    const rank = GRADE_RANK[c.grade] ?? 0;
    if (rank > best.rank) best = { grade: c.grade, rank };
  }
  if (best.rank < 0) best = { grade: "Insufficient", rank: 0 };
  return best;
}

/**
 * Manifest of every file this module statically imports, purely so a test
 * can compare its length against an fs.readdirSync of data/ and fail loudly
 * if someone adds a new ingredient/claim/policy/product file without also
 * adding an import above.
 */
export const MANIFEST_COUNTS = {
  ingredients: ingredients.length,
  claims: claims.length,
  eligibilityPolicies: eligibilityPolicies.length,
  dosingPolicies: dosingPolicies.length,
  safetyPolicies: safetyPolicies.length,
  products: products.length,
} as const;
