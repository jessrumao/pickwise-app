"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { generateRecommendations, type RecommendationResult } from "@/lib/engine";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResultsView } from "@/components/results/results-view";
import { SiteHeader } from "@/components/site/site-header";
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
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="font-mono text-xs tracking-wide text-brand">
          CALCULATING STACK<span className="animate-pulse">_</span>
        </p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <p className="text-sm text-destructive">{state.message}</p>
        <Button asChild variant="outline" className="font-display text-xs tracking-wide">
          <Link href="/intake">← BACK TO THE QUESTIONNAIRE</Link>
        </Button>
      </div>
    );
  }

  if (state.status === "ready") {
    return (
      <div className="flex flex-1 flex-col">
        {/* Same "INPUT X OF Y" micro-label rhythm intake uses (see
            components/intake/intake-flow.tsx) so landing on /results after
            finishing the questionnaire reads as the next step in one flow,
            not a jump into a differently-styled page. */}
        <div className="border-b border-border px-6 py-6 sm:px-10">
          <p className="flex items-center gap-2 font-display text-[9px] font-semibold tracking-[0.2em] text-brand">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" />
            ANALYSIS COMPLETE
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Your recommendations
          </h1>
        </div>
        <div className="flex flex-1 flex-col items-center gap-6 px-6 py-10 sm:px-10">
          <ResultsView result={state.result} />
          <Button asChild variant="outline" className="font-display text-xs tracking-wide">
            <Link href="/intake">START OVER</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="font-display">No profile loaded</CardTitle>
          <p className="text-sm text-muted-foreground">
            Complete the questionnaire, or pick a sample profile to see how this page renders.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button asChild className="font-display text-xs tracking-wide">
            <Link href="/intake">START THE QUESTIONNAIRE →</Link>
          </Button>
          <div className="space-y-2">
            {DEMO_PROFILES.map((demo) => (
              <button
                key={demo.id}
                type="button"
                onClick={() =>
                  setState({ status: "ready", result: generateRecommendations(demo.profile) })
                }
                className="block w-full border border-border p-3 text-left text-sm hover:bg-accent"
              >
                <p className="font-medium">{demo.label}</p>
                <p className="text-xs text-muted-foreground">{demo.note}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <main className="flex min-h-svh flex-col">
      <SiteHeader />
      <React.Suspense fallback={null}>
        <ResultsPageInner />
      </React.Suspense>
    </main>
  );
}
