"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { generateRecommendations, type RecommendationResult } from "@/lib/engine";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResultsView } from "@/components/results/results-view";
import { DEMO_PROFILES } from "@/lib/results/demo-profiles";
import { createDecision } from "@/lib/results/decisions-api";
import { adaptDecisionRecord } from "@/lib/results/decision-record-adapter";

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; result: RecommendationResult }
  | { status: "picker" };

function ResultsPageInner() {
  const searchParams = useSearchParams();
  const profileVersionId = searchParams.get("profileVersionId");
  const [state, setState] = React.useState<PageState>(
    profileVersionId ? { status: "loading" } : { status: "picker" }
  );

  React.useEffect(() => {
    if (!profileVersionId) return;
    let cancelled = false;
    createDecision(profileVersionId)
      .then((record) => {
        if (!cancelled) setState({ status: "ready", result: adaptDecisionRecord(record) });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Something went wrong.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [profileVersionId]);

  if (state.status === "loading") {
    return (
      <main className="flex min-h-svh items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Loading your recommendations…</p>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
        <p className="text-sm text-destructive">{state.message}</p>
        <Button asChild variant="outline">
          <Link href="/intake">Back to the questionnaire</Link>
        </Button>
      </main>
    );
  }

  if (state.status === "ready") {
    return (
      <main className="flex min-h-svh flex-col items-center gap-6 p-6">
        <ResultsView result={state.result} />
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>No profile loaded</CardTitle>
          <p className="text-sm text-muted-foreground">
            Complete the questionnaire, or pick a sample profile to see how this page renders.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button asChild>
            <Link href="/intake">Start the questionnaire</Link>
          </Button>
          <div className="space-y-2">
            {DEMO_PROFILES.map((demo) => (
              <button
                key={demo.id}
                type="button"
                onClick={() =>
                  setState({ status: "ready", result: generateRecommendations(demo.profile) })
                }
                className="block w-full rounded-md border p-3 text-left text-sm hover:bg-accent"
              >
                <p className="font-medium">{demo.label}</p>
                <p className="text-xs text-muted-foreground">{demo.note}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

export default function ResultsPage() {
  return (
    <React.Suspense fallback={null}>
      <ResultsPageInner />
    </React.Suspense>
  );
}
