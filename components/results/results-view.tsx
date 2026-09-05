"use client";

import * as React from "react";
import { generateRecommendations } from "@/lib/engine";
import type { UserProfile } from "@/types/engine";
import { BasketSummary } from "@/components/results/basket-summary";
import { Disclaimer } from "@/components/results/disclaimer";
import { RecommendationCard } from "@/components/results/recommendation-card";

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

export function ResultsView({ profile }: { profile: UserProfile }) {
  const result = React.useMemo(() => generateRecommendations(profile), [profile]);

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

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      {visible.map((rec, i) => (
        <RecommendationCard key={i} rec={rec} safetyEscalations={result.safety.escalations} />
      ))}
      {result.budget && <BasketSummary budget={result.budget} />}
      <Disclaimer />
    </div>
  );
}
