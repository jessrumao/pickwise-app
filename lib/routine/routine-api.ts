import type { RoutineItemInput, RoutineScheduleContext } from "@/lib/routine/build-routine-prompt";

export async function generateRoutine(
  items: RoutineItemInput[],
  scheduleContext?: RoutineScheduleContext
): Promise<string> {
  const res = await fetch("/api/routine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, scheduleContext }),
  });
  if (!res.ok) {
    throw new Error("Could not generate a routine for this basket. Please try again.");
  }
  const { routineText } = (await res.json()) as { routineText: string };
  return routineText;
}
