// Matches a Recommendation's safetyTrace back to the SafetyEscalation that
// produced it. Can't use reference equality (===) for this once data has
// gone through Package C's persistence: generateRecommendations() sets both
// values to the SAME in-memory object, but after a round trip through
// Postgres jsonb and back (JSON.stringify -> stored -> fetched -> JSON.parse
// on the client), they're structurally-equal but no longer the same
// reference — JSON.parse always builds fresh objects, and jsonb doesn't
// preserve key order either, so a plain JSON.stringify string comparison
// isn't safe against that reordering. This compares by value with object
// keys canonicalized (sorted) first, so it works for both the in-memory
// case (demo profiles) and the persisted-and-refetched case.
import type { Recommendation, SafetyEscalation } from "@/types/engine";

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function findMatchingEscalation(
  rec: Recommendation,
  escalations: SafetyEscalation[]
): SafetyEscalation | undefined {
  if (!rec.safetyTrace) return undefined;
  const target = stableStringify(rec.safetyTrace);
  return escalations.find((e) => stableStringify(e.trace) === target);
}
