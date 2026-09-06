import type { RecommendationResult } from "@/lib/engine";
import { knowledgeBase } from "@/lib/engine";
import { BasketSummary } from "@/components/results/basket-summary";
import { Disclaimer } from "@/components/results/disclaimer";
import { RecommendationCard } from "@/components/results/recommendation-card";
import { RecommendationsChat } from "@/components/results/recommendations-chat";

// Recommended/potentially-useful first (highest priority score first), then
// escalate, then the explicit no's — not_shown never reaches this list's
// visible output (RecommendationCard returns null for it).
const STATUS_ORDER: Record<string, number> = {
  recommended: 0,
  potentially_useful: 0,
  escalate: 1,
  not_needed: 2,
  already_covered: 2,
  not_shown: 3,
};

// Purely presentational over an already-computed RecommendationResult — the
// caller decides how that result was produced: generateRecommendations()
// directly for the demo picker, or fetched back from Package C's
// /api/decisions (via adaptDecisionRecord) for a real submitted profile.
export function ResultsView({ result }: { result: RecommendationResult }) {
  if (result.globalEscalation) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-4">
        <div className="rounded-lg border border-amber-600/40 p-4">
          <p className="font-medium">We can&apos;t generate automated recommendations right now.</p>
          <p className="mt-2 text-sm">{result.globalEscalation.userMessage}</p>
        </div>
        <Disclaimer />
      </div>
    );
  }

  const visible = result.recommendations
    .filter((r) => r.status !== "not_shown")
    .sort((a, b) => {
      const bucketDiff = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
      if (bucketDiff !== 0) return bucketDiff;
      return (b.priorityScore?.total ?? 0) - (a.priorityScore?.total ?? 0);
    });

  // One shared chat for the whole page, scoped to the union of every
  // visible recommendation's cited claims — not a per-card question box
  // (that clutters the UI once several recommendations are shown; see
  // components/results/recommendations-chat.tsx). Escalations are excluded
  // the same way RecommendationCard excludes them from EvidenceAccordion: a
  // safety escalation has no "why" evidence to explain, only a message to
  // see a professional. Deduped since multiple recommendations can share a
  // policy/claim.
  const citedClaimIds = Array.from(
    new Set(
      visible
        .filter((rec) => rec.status !== "escalate")
        .map((rec) => knowledgeBase.eligibilityPolicyById.get(rec.policyId))
        .filter((policy): policy is NonNullable<typeof policy> => Boolean(policy))
        .flatMap((policy) => policy.citesClaims)
    )
  );

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      {visible.map((rec, i) => (
        <RecommendationCard key={i} rec={rec} safetyEscalations={result.safety.escalations} />
      ))}
      {result.budget && <BasketSummary budget={result.budget} />}
      <RecommendationsChat citedClaimIds={citedClaimIds} />
      <Disclaimer />
    </div>
  );
}
