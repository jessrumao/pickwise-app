"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResultsView } from "@/components/results/results-view";
import { DEMO_PROFILES } from "@/lib/results/demo-profiles";
import { loadProfileForResults } from "@/lib/results/session-handoff";
import type { UserProfile } from "@/types/engine";

export default function ResultsPage() {
  // sessionStorage doesn't exist during SSR, so the real value can only be
  // read after mount (matches app/page.tsx's own isClient pattern) — the
  // brief flash of the "no profile" state below is the accepted cost.
  const [profile, setProfile] = React.useState<UserProfile | undefined>(undefined);

  React.useEffect(() => {
    setProfile(loadProfileForResults());
  }, []);

  if (!profile) {
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
                  onClick={() => setProfile(demo.profile)}
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

  return (
    <main className="flex min-h-svh flex-col items-center gap-6 p-6">
      <ResultsView profile={profile} />
    </main>
  );
}
