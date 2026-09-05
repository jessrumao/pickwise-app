// Pure shaping of a RecommendationResult (Package B's engine output) into
// the three jsonb columns decision_records splits it across. No `pg` import
// here on purpose -- keeps this testable without a live database.
import type { RecommendationResult } from "@/lib/engine";

export interface DecisionRecordTrace {
  // Global safety gate result -- carries the per-policy clause trace for any
  // global escalation (unparseable medications, pregnancy).
  safety: RecommendationResult["safety"];
  // Per-item traces, pulled out of `recommendations` so "why was X shown/not
  // shown" is queryable without walking the full recommendation objects.
  perRecommendation: Array<{
    policyId: string;
    compoundId?: string;
    ingredientId?: string;
    eligibilityTrace: unknown;
    safetyTrace?: unknown;
  }>;
}

export interface DecisionRecordPayload {
  trace: DecisionRecordTrace;
  recommendation: RecommendationResult["recommendations"];
  budgetOutcome: RecommendationResult["budget"] | null;
  escalations: NonNullable<RecommendationResult["globalEscalation"]>[];
}

export function buildDecisionRecordPayload(result: RecommendationResult): DecisionRecordPayload {
  return {
    trace: {
      safety: result.safety,
      perRecommendation: result.recommendations.map((r) => ({
        policyId: r.policyId,
        compoundId: r.compoundId,
        ingredientId: r.ingredientId,
        eligibilityTrace: r.eligibilityTrace,
        safetyTrace: r.safetyTrace,
      })),
    },
    recommendation: result.recommendations,
    budgetOutcome: result.budget ?? null,
    escalations: result.globalEscalation ? [result.globalEscalation] : [],
  };
}
