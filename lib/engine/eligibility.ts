// lib/engine/eligibility.ts
//
// Eligibility + suppression stage. Ported from demo.mjs's eligibility loop.
// Compounds, not ingredients, are the unit of reasoning: most policies key
// on compoundId, and the substitution query (substitution.ts) resolves which
// ingredient actually delivers it for this user's diet. elig-multivitamin is
// the one ingredient-scoped exception (a multivitamin is a bundle, not a
// compound) and is handled by keying on ingredientId instead.
//
// EXTENDS demo.mjs (not just a port) for one case demo.mjs's blocking check
// can't reach: a safety rule scoped to an INGREDIENT (e.g.
// safety-whey-milk-allergy, appliesTo.ingredientIds: ["whey-protein"]) can
// never block a COMPOUND-scoped eligibility policy (elig-protein-complete),
// because demo.mjs's blockedIngredients check is keyed on the policy's own
// p.ingredientId, which protein-complete doesn't have. Left as-is, that
// safety rule would have zero effect and the engine could still hand a
// milk-allergic vegetarian a whey serving plan — exactly the outcome the
// policy's own userMessage says it prevents ("We'll route you to a
// plant-based protein instead"). So: blocked ingredients are filtered OUT of
// a compound's candidate list rather than escalating the whole compound: whey
// is removed, plant-protein-blend remains as the (correct) sole candidate.
// Only when filtering empties the candidate list entirely (no safe delivery
// vehicle survives) does the recommendation escalate.

import type {
  CandidateIngredient,
  UserProfile,
  Recommendation,
  RecommendationStatus,
  SafetyGateResult,
} from "@/types/engine";
import { TRUE } from "@/types/engine";
import { eligibilityPolicies, highestGrade, safetyPolicyById } from "./knowledge-base";
import { run, explain } from "./predicate";
import { findCandidateIngredients } from "./substitution";

export function evaluateEligibility(profile: UserProfile, safetyResult: SafetyGateResult): Recommendation[] {
  const results: Recommendation[] = [];

  for (const policy of eligibilityPolicies) {
    const recTrace = run(policy.recommendWhen, profile);
    const supTrace = policy.suppressWhen ? run(policy.suppressWhen, profile) : undefined;
    const { grade, rank } = highestGrade(policy.citesClaims);

    // Compound-scoped policies: resolve the substitution candidates up front
    // and filter out any ingredient a targeted safety rule blocks (see the
    // module doc comment above). blockedCandidateIds feeds the safetyTrace
    // lookup below; ingredientsExhausted is true only when a non-empty
    // candidate list is filtered down to nothing -- i.e. no safe delivery
    // vehicle survives for this user.
    let candidateIngredients: CandidateIngredient[] | undefined;
    let blockedCandidateIds: string[] = [];
    let ingredientsExhausted = false;
    if (policy.compoundId) {
      const allCandidates = findCandidateIngredients(policy.compoundId, profile.dietaryPattern);
      candidateIngredients = allCandidates.filter((c) => !safetyResult.blockedIngredientIds.has(c.ingredientId));
      blockedCandidateIds = allCandidates
        .map((c) => c.ingredientId)
        .filter((id) => safetyResult.blockedIngredientIds.has(id));
      ingredientsExhausted = allCandidates.length > 0 && candidateIngredients.length === 0;
    }

    const isBlocked =
      (policy.compoundId != null && safetyResult.blockedCompoundIds.has(policy.compoundId)) ||
      (policy.ingredientId != null && safetyResult.blockedIngredientIds.has(policy.ingredientId)) ||
      ingredientsExhausted;

    let status: RecommendationStatus;
    let why: string;
    let eligibilityTrace = recTrace;

    if (isBlocked) {
      status = "escalate";
      why = "safety rule matched for this item";
    } else if (supTrace && supTrace.value === TRUE) {
      status = policy.suppressOutcome === "already_covered" ? "already_covered" : "not_needed";
      why = explain(supTrace);
      eligibilityTrace = supTrace;
    } else if (recTrace.value === TRUE) {
      // grade >= 2 means Strong or Moderate — see EvidenceGrade/GRADE_RANK.
      status = rank >= 2 ? "recommended" : "potentially_useful";
      why = explain(recTrace);
    } else {
      status = "not_shown";
      why = explain(recTrace);
    }

    // Matches demo.mjs: only "not_shown" is ever filtered, and only when the
    // policy explicitly opts out of showing it. Every other status always renders.
    if (status === "not_shown" && policy.showWhenSuppressed === false) continue;

    const safetyTrace = isBlocked
      ? safetyResult.escalations.find((e) => {
          if (policy.compoundId && policyTargets(e.policyId, policy.compoundId, "compound")) return true;
          if (policy.ingredientId && policyTargets(e.policyId, policy.ingredientId, "ingredient")) return true;
          if (ingredientsExhausted && blockedCandidateIds.some((id) => policyTargets(e.policyId, id, "ingredient"))) {
            return true;
          }
          return false;
        })?.trace
      : undefined;

    const recommendation: Recommendation = {
      compoundId: policy.compoundId,
      ingredientId: policy.ingredientId,
      policyId: policy.id,
      status,
      grade,
      why,
      eligibilityTrace,
      safetyTrace,
    };

    // candidateIngredients is already the SAFETY-FILTERED list (blocked
    // ingredients like whey removed) -- pickTopCandidateProduct/dosing
    // downstream only ever see safe delivery vehicles.
    if (["recommended", "potentially_useful"].includes(status) && policy.compoundId) {
      recommendation.candidateIngredients = candidateIngredients;
    }

    results.push(recommendation);
  }

  return results;
}

// Re-derives whether a safety policy targets a given compound/ingredient id,
// by looking it up in the knowledge base rather than threading the whole
// policy object through — keeps evaluateEligibility's signature small.
function policyTargets(policyId: string, id: string, kind: "compound" | "ingredient"): boolean {
  const policy = safetyPolicyById.get(policyId);
  if (!policy) return false;
  return kind === "compound"
    ? (policy.appliesTo.compoundIds ?? []).includes(id)
    : (policy.appliesTo.ingredientIds ?? []).includes(id);
}
