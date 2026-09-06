// lib/engine/index.ts — public surface of Package B's recommendation engine.
export { generateRecommendations, type RecommendationResult } from "./recommend";
export { evaluateSafetyGate } from "./safety";
export { evaluateEligibility } from "./eligibility";
export { findCandidateIngredients, ingredientDeliversCompound } from "./substitution";
export { resolveDosing, buildServingPlan, pickTopCandidateProduct, amountPerServingFor } from "./dosing";
export { computeServingPlan } from "./serving-plan";
export { computeGoalAlignment, computeGapTier, computePriorityScore } from "./priority";
export { allocateBudget, type BasketCandidate } from "./budget";
export { packsNeededPerMonth, monthlyCostINR, DAYS_PER_MONTH } from "./monthly-cost";
export { evaluate, run, decisive, explain } from "./predicate";
export * as knowledgeBase from "./knowledge-base";
