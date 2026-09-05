// lib/engine/priority.ts
//
// priority_score = gap_tier + evidence_tier + goal_alignment, ADDITIVE.
// data/tools/demo.mjs does not implement this at all (its header comment
// lists stage 12, the allocator, and by extension this scoring step, as
// "WORK PACKAGE B") — this is a fresh implementation against
// data-layer-decisions-v2.md's spec, not a port of existing reference code.
//
// A note on faithfulness: the decisions doc's own worked example (protein
// 3+3+2=8, creatine 2+3+2=7, omega-3 1+2+1=4) is explicitly "the design
// doc's own sample" — an earlier, illustrative sketch, not a claim that
// today's actual data reproduces those exact three numbers end-to-end (e.g.
// it assumes omega-3's evidence tier is "moderate", but the claim
// elig-epa-dha-general actually cites today is graded Limited). What IS
// precisely specified, and what this module is tested against, is: (a) the
// additive formula itself, verified with the doc's literal component
// numbers, and (b) the goalAlignment derivation, verified against real data
// via the goals->outcomes indirection (entities/goals.json's own comment:
// "this indirection is what stops a new user goal from requiring an edit to
// every ingredient record") — and that DOES reproduce the doc's claim that
// protein/creatine land on the user's primary goal and omega-3 on a
// secondary one, using today's real vegetarian-muscle-gain sample.

import type { GapTier, EvidenceTier, GoalAlignmentScore, PriorityScore, UserProfile } from "@/types/engine";
import { goalById, claimById } from "./knowledge-base";

export function computePriorityScore(parts: {
  gapTier: GapTier;
  evidenceTier: EvidenceTier;
  goalAlignment: GoalAlignmentScore;
}): PriorityScore {
  return { ...parts, total: parts.gapTier + parts.evidenceTier + parts.goalAlignment };
}

/**
 * Does this recommendation serve the user's primary goal (2), a secondary
 * goal (1), or neither (0)? Derived from real data, not hardcoded per
 * compound: walk profile.primaryGoals in order (index 0 = primary, scores
 * 2; the rest score 1), look up each goal's linked outcomes in
 * entities/goals.json, and check whether any of citesClaims' outcomeId
 * lands in that set.
 */
export function computeGoalAlignment(profile: UserProfile, citesClaims: string[]): GoalAlignmentScore {
  const claimOutcomeIds = new Set(citesClaims.map((id) => claimById.get(id)?.outcomeId).filter(Boolean));
  if (claimOutcomeIds.size === 0) return 0;

  for (let i = 0; i < profile.primaryGoals.length; i++) {
    const goal = goalById.get(profile.primaryGoals[i]);
    if (!goal) continue;
    const linked = goal.outcomes.some((o) => claimOutcomeIds.has(o.outcomeId));
    if (linked) return i === 0 ? 2 : 1;
  }
  return 0;
}

/**
 * Severity of the shortfall against requirement. Only meaningfully
 * computable when gapIsQuantified is true — i.e. gapAmount reflects a real
 * measured dietary shortfall (protein today, via estimatedDailyProteinG).
 *
 * FLAGGED DEFAULT: everything else defaults to "moderate" (2) rather than an
 * invented severe/mild, because there genuinely isn't a shortfall number to
 * grade yet — either the compound has no dietary-gap concept at all
 * (subtractDietaryIntake: false — creatine, lgg: the target IS the dose, not
 * a gap to close) or the concept exists but the profile has no field to
 * measure it against (omega-3, pending a dietary-EPA/DHA estimate field).
 * Treating "we don't know" as "severe" would have been wrong in the other
 * direction — this is a deliberate, documented simplification for the team
 * to revisit, in the same spirit as the other known gaps flagged in
 * data/README.md, not a silent guess.
 */
export function computeGapTier(
  gapAmount: number | undefined,
  resolvedTargetAmount: number | undefined,
  gapIsQuantified: boolean
): GapTier {
  if (!gapIsQuantified || gapAmount == null || resolvedTargetAmount == null || resolvedTargetAmount <= 0) return 2;
  if (gapAmount <= 0) return 0;
  const ratio = gapAmount / resolvedTargetAmount;
  if (ratio >= 0.3) return 3;
  if (ratio >= 0.1) return 2;
  return 1;
}
