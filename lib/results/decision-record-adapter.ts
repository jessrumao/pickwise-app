// Turns Package C's persisted decision-record shape (as returned by
// POST/GET /api/decisions) back into the RecommendationResult shape
// lib/engine's own output already has, so ResultsView/RecommendationCard
// have one code path regardless of whether a result was just computed (the
// demo picker) or fetched back from the database (the real intake flow).
//
// Type-only import from lib/decision-mapping.ts: that module is pure (no
// `pg`), so this doesn't pull any server-only code into the client bundle —
// `import type` is erased entirely at compile time.
import type { DecisionRecordPayload } from "@/lib/decision-mapping";
import type { RecommendationResult } from "@/lib/engine";

export function adaptDecisionRecord(record: DecisionRecordPayload): RecommendationResult {
  return {
    globalEscalation: record.escalations[0],
    safety: record.trace.safety,
    recommendations: record.recommendation,
    budget: record.budgetOutcome ?? undefined,
  };
}
