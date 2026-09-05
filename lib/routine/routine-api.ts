import type { RoutineInput } from "@/lib/routine/build-routine-prompt";

export async function generateRoutine(input: RoutineInput): Promise<string> {
  const res = await fetch("/api/routine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error("Could not generate a routine for this item. Please try again.");
  }
  const { routineText } = (await res.json()) as { routineText: string };
  return routineText;
}
