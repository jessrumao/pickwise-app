# Package B — Recommendation Engine — done (2026-09-05)

Status note for the team / future sessions picking up Packages C, D, E, F, G. Builds on `b0-bootstrap-status.md` (types) and follows Package B's own task brief (`tasks/B-recommendation-engine.md`). Committed as `webapp` commit `61a7dc7` on `main`.

## What exists now

```
webapp/lib/engine/
  knowledge-base.ts   <- static imports + indices for every data/ record the engine reads
  predicate.ts        <- Kleene (3-valued) predicate evaluator + trace + explain, ported from predicate.mjs
  safety.ts           <- safety gate: global + targeted escalations, blockedCompoundIds/blockedIngredientIds
  eligibility.ts       <- eligibility/suppression loop, EXTENDS demo.mjs (see "one deliberate extension" below)
  substitution.ts      <- findCandidateIngredients(): delivers[] + suitableFor query, zero diet-specific branching
  dosing.ts            <- resolveDosing(), target/gap resolution, dietary-intake subtraction
  serving-plan.ts      <- computeServingPlan(): nearest-half rounding, floors UP to minEffectiveDose
  priority.ts          <- NEW: priority_score = gap_tier + evidence_tier + goal_alignment (additive)
  budget.ts            <- NEW: price-blind budget allocator, funds in priority order
  recommend.ts          <- generateRecommendations(): orchestrates the full pipeline, one profile in, full output out
  index.ts              <- public export surface
  __tests__/            <- 23 tests, all passing (see below)
```

`types/engine.ts` gained three additive changes (verified with `git diff` before committing — nothing else touched): `ingredientScoped` on `DosingPolicy`, `gapIsQuantified` on `RecommendationDosing`, and the new `SafetyEscalation`/`SafetyGateResult` types.

**The one architectural rule that governs everything here, per the brief**: recommendations only ever come from exact, structured lookups over `data/` — never vector/embedding retrieval, never the LLM, and never price. The budget allocator is the *only* code that reads `monthlyBudgetINR`, and only after the recommendation set and priority order are already fixed. A test (`safety.test.ts`'s "commercial firewall" describe block) mirrors `data/tools/validate.mjs`'s own check by walking every eligibility/dosing predicate and asserting none of them reference `monthlyBudgetINR`.

## Pipeline

`generateRecommendations(profile)` runs, in order: safety gate → eligibility/suppression → substitution → dosing/serving-plan → priority scoring → budget allocation. A global safety escalation (unparseable medications, pregnancy) short-circuits everything after the gate — matching `demo.mjs`'s "no automated recommendation is produced for this profile" behavior exactly.

## Verification

`tsc --noEmit` clean and `npx eslint lib/engine types/engine.ts` zero issues, both run against the real `webapp` repo. Full `npx vitest run` in `webapp`: **122 tests pass** (100 pre-existing myAI6-template tests + 4 from B0's own type smoke test + 23 new from Package B).

The 23 new tests: all 5 canonical sample profiles reproduced against `demo.mjs`'s actual console output (vegetarian-muscle-gain's protein 1.5 scoops/36g/₹1999/`on-gold-standard-whey-1lb`; creatine/BCAA/omega-3/multivitamin/lgg statuses; unparseable-medications' global escalation; sedentary-wellness and already-covered suppression cases); priority-score formula + data-driven goal-alignment; serving-plan rounding including the floor-up-to-minEffectiveDose edge case; budget allocation against a real scenario (vegetarian-muscle-gain's actual ₹3000 budget genuinely can't fund all four eligible items, so priority order determines who's deferred); the targeted-safety-escalation case below; the commercial-firewall check; and a manifest-freshness check (`knowledge-base.manifest.test.ts`) that fails loudly if a new `data/` file is ever added without a matching static import.

## One deliberate extension beyond `demo.mjs`

`demo.mjs`'s blocking check can only compare a safety policy's `appliesTo` against an eligibility policy's *own* `compoundId`/`ingredientId`. That's a real gap: `safety-whey-milk-allergy` is scoped to `appliesTo.ingredientIds: ["whey-protein"]`, but `elig-protein-complete` is a **compound**-scoped policy — so a milk allergy had zero effect on it, and a milk-allergic vegetarian could still be served a whey serving plan. That directly contradicts the safety policy's own `userMessage`: *"Whey is milk-derived. We'll route you to a plant-based protein instead."*

Fixed in `eligibility.ts`, not left as a silent behavior change: for compound-scoped policies, blocked ingredients are now filtered **out** of the substitution candidate list rather than escalating the whole compound. A vegetarian user with a milk allergy still gets `protein-complete` recommended — just routed to `plant-protein-blend` only, with `whey-protein` excluded from `candidateIngredients` (and therefore never picked as the serving-plan product). The compound only escalates to `"escalate"` if filtering empties an originally non-empty candidate list, i.e. no safe delivery vehicle survives at all — a scenario today's data can't actually trigger (every ingredient-scoped safety rule currently leaves a substitute standing), so that branch is exercised by a targeted unit test that constructs the safety result directly rather than end-to-end.

## Known issues carried forward, not fixed here (flagging for Package A / the domain expert)

- **vegan-endurance never gets protein recommended.** `elig-protein-complete`'s goal list doesn't include `endurance_performance`, so this sample's protein-complete stays `not_shown` even though the profile trains 5x/week — reproduced exactly as `demo.mjs` produces it, not silently patched. Already flagged in `data/README.md` finding #1.
- **`suppressOutcome` is per-policy, not per-clause.** A single eligibility policy can only declare one suppression outcome (`already_covered` or `not_needed`) for its whole `suppressWhen` predicate, even if that predicate has multiple disjoint branches that logically deserve different outcomes. Not touched — this is a data/policy-authoring decision, not an engine bug.
- **`priority.ts`'s `computeGapTier` default.** Anything without a genuinely quantified dietary gap (creatine, lgg — no gap concept at all; omega-3 — gap concept exists but no measurable intake field yet) defaults to `moderate (2)` rather than an invented severe/mild. Documented in the code as a deliberate simplification, not a guess — worth the team revisiting once real intake-estimate fields exist for more compounds.
- **`priority.ts`'s worked-example note.** `data-layer-decisions-v2.md`'s illustrative 3+3+2/2+3+2/1+2+1 worked example is exactly that — illustrative. It assumes omega-3's cited claim is graded Moderate; today's actual `elig-epa-dha-general` cites a claim graded Limited. What *is* verified against real 2026 data: the additive formula itself, and the goal-alignment derivation (protein/creatine → primary goal, omega-3 → secondary), via the `goals.json` → `outcomes.json` → `claim.outcomeId` indirection — not a hardcoded per-compound table.

## Not done here (intentionally, per Package B scope)

- No UI — that's Packages D/E.
- No domain prompt rewrite — still Package D/G's job (flagged in B0).
- ICMR-NIN reference values for `rda_multiple`-basis dosing (multivitamin) are still deliberately near-empty (`data/README.md` finding #5) — the engine handles this by giving multivitamin a priority score and a basket entry without a computed serving plan, not by guessing a number.

## For whoever picks up C, D, E, F, G next

`import { generateRecommendations } from "@/lib/engine"` — one `UserProfile` in, a `RecommendationResult` (`{ globalEscalation?, safety, recommendations, budget? }`) out. Every `Recommendation.why`/`eligibilityTrace`/`safetyTrace` is generated via `explain()` over a real predicate trace — never invented — which is what the brief means by "explanations must never be invented, only phrased from the trace." Rebase downstream work onto this rather than re-deriving eligibility/dosing logic in the UI or an LLM prompt; the one-rule-that-governs-everything (no price in eligibility/dosing, ever) is enforced by both `data/tools/validate.mjs` and this package's own commercial-firewall test.
