// Pure arithmetic, kept separate from the API route so it's unit-testable
// without a network call. Takes the LLM's food-identification output
// (what was eaten, matched against PROTEIN_DATABASE where possible, in
// grams) and computes the actual protein total deterministically — the LLM
// never does this multiplication itself, since that's exactly where it was
// found to be unreliable (see the 2026-09-06 stress-test note in
// docs/status/ai-protein-estimate-status.md).
import { PROTEIN_DATABASE_BY_ID } from "@/lib/intake/protein-database";

export interface ProteinItem {
  matchedDatabaseId: string | null;
  quantityGrams: number;
  selfEstimatedProteinG?: number;
}

export interface ComputedProteinEstimate {
  estimatedDailyProteinG: number;
  // Fraction of total estimated protein that came from a real database
  // value rather than the LLM's own guess for an unmatched food — 1 means
  // every item matched, 0 means none did. Used to temper confidence: a
  // fluent-sounding estimate built entirely on the LLM's own guesses isn't
  // more trustworthy just because it sounds precise.
  matchedProteinFraction: number;
}

export function computeProteinFromItems(items: ProteinItem[]): ComputedProteinEstimate {
  let matchedProteinG = 0;
  let unmatchedProteinG = 0;

  for (const item of items) {
    const entry = item.matchedDatabaseId
      ? PROTEIN_DATABASE_BY_ID.get(item.matchedDatabaseId)
      : undefined;
    if (entry) {
      matchedProteinG += (item.quantityGrams / 100) * entry.proteinPer100g;
    } else {
      unmatchedProteinG += item.selfEstimatedProteinG ?? 0;
    }
  }

  const totalProteinG = matchedProteinG + unmatchedProteinG;
  const matchedProteinFraction = totalProteinG > 0 ? matchedProteinG / totalProteinG : 1;

  return {
    estimatedDailyProteinG: Math.round(totalProteinG),
    matchedProteinFraction,
  };
}
