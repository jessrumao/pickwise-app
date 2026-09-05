// lib/engine/substitution.ts
//
// The substitution query: which ingredients deliver a given compound AND
// suit this user's dietary pattern. This is what makes vegan omega-3
// resolve to algal-oil (not fish-oil) and vegetarian protein resolve to
// either whey or plant-protein-blend, with ZERO rule anywhere mentioning
// veganism — see data/README.md's "one rule that governs everything" note.
//
// Ported from demo.mjs's deliversCompound(): an ingredient delivers a GROUP
// compound (e.g. epa-dha) if it declares any of the group's members
// (epa, dha) — group membership resolution lives in entities/compounds.json.

import type { DietaryPattern, Ingredient, CandidateIngredient } from "@/types/engine";
import { compounds, ingredients } from "./knowledge-base";

export function ingredientDeliversCompound(ingredient: Ingredient, compoundId: string): boolean {
  const group = compounds.find((c) => c.id === compoundId);
  const memberIds = group?.members ?? [];
  return ingredient.delivers.some((d) => d.compoundId === compoundId || memberIds.includes(d.compoundId));
}

export function findCandidateIngredients(
  compoundId: string,
  dietaryPattern: DietaryPattern
): CandidateIngredient[] {
  return ingredients
    .filter((i) => ingredientDeliversCompound(i, compoundId))
    .map((i) => ({
      ingredientId: i.id,
      matchesUserDiet: i.suitableFor.includes(dietaryPattern),
    }))
    .filter((c) => c.matchesUserDiet);
}
