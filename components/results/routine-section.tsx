"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { generateRoutine } from "@/lib/routine/routine-api";
import type { RoutineItemInput, RoutineScheduleContext } from "@/lib/routine/build-routine-prompt";

// One combined routine for the whole FUNDED basket (2026-09-07 product
// decision), not a per-card "Show my routine" button — a person fits every
// funded item into one actual day, and cross-item separation rules
// (timing.separateFromCompoundIds) only mean anything relative to what else
// is in the basket. Auto-generates on mount rather than waiting for a click:
// this is now exactly one LLM call for the whole page (previously up to one
// per card), and how to actually use what was just recommended is core
// information, not an optional aside.
type RoutineState = "loading" | { text: string } | { error: string };

export function RoutineSection({
  items,
  scheduleContext,
}: {
  items: RoutineItemInput[];
  scheduleContext?: RoutineScheduleContext;
}) {
  const [state, setState] = React.useState<RoutineState>("loading");

  const load = React.useCallback(() => {
    setState("loading");
    generateRoutine(items, scheduleContext)
      .then((text) => setState({ text }))
      .catch((error: unknown) =>
        setState({ error: error instanceof Error ? error.message : "Something went wrong." })
      );
    // items/scheduleContext are derived fresh from the same funded basket
    // each render — re-running on every reference change would refetch
    // needlessly, so this intentionally only depends on the item identities
    // that actually change the routine text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(items), JSON.stringify(scheduleContext)]);

  React.useEffect(() => {
    load();
  }, [load]);

  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Your daily routine</CardTitle>
        <p className="text-sm text-muted-foreground">
          How everything in your basket fits into one day.
        </p>
      </CardHeader>
      <CardContent>
        {state === "loading" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner /> Working out your routine…
          </div>
        )}
        {typeof state === "object" && "error" in state && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-destructive">{state.error}</span>
            <Button type="button" variant="outline" size="sm" onClick={load}>
              Retry
            </Button>
          </div>
        )}
        {typeof state === "object" && "text" in state && <p className="text-sm">{state.text}</p>}
      </CardContent>
    </Card>
  );
}
