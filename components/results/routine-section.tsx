"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { generateRoutine } from "@/lib/routine/routine-api";
import type { RoutineInput } from "@/lib/routine/build-routine-prompt";

// Lazy and per-card on purpose: generating this for every card on every
// page load would mean an LLM call nobody asked for, on every /results
// view. Per the brief, this section is optional and never required for the
// card to render — it only exists once a user asks for it.
type RoutineState = "idle" | "loading" | { text: string } | { error: string };

export function RoutineSection(props: RoutineInput) {
  const [state, setState] = React.useState<RoutineState>("idle");

  async function handleClick() {
    setState("loading");
    try {
      const text = await generateRoutine(props);
      setState({ text });
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : "Something went wrong." });
    }
  }

  if (state === "idle") {
    return (
      <Button type="button" variant="outline" size="sm" onClick={handleClick}>
        Show my routine
      </Button>
    );
  }

  if (state === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Working out a routine…
      </div>
    );
  }

  if ("error" in state) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-destructive">{state.error}</span>
        <Button type="button" variant="outline" size="sm" onClick={handleClick}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-dashed p-3 text-sm">
      <p className="mb-1 text-xs font-medium text-muted-foreground">Your routine</p>
      <p>{state.text}</p>
    </div>
  );
}
