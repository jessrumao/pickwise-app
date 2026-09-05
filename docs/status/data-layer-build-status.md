# Data layer — built and verified (v3)

Status note for future sessions. Architecture rationale is in `data-layer-decisions-v2.md`; this records what now exists on disk.

## What was built

The v3 data layer is written in `data/` in the SupplementRecommendationEngine repo and runs under plain `node` with no build step. Counts: **20 compounds, 8 ingredients, 10 claims, 19 policies, 9 products, 5 sample profiles.**

```
data/
  schema/       8 JSON Schemas — the contracts, with reasoning in the field descriptions
  reference/    L0  ICMR-NIN + IOM/FDA upper limits
  entities/     L1  compounds.json, outcomes.json, goals.json
  ingredients/  L1  8 records (whey, plant-protein-blend, creatine, fish-oil, algal-oil,
                    multivitamin, probiotic-lgg, bcaa)
  claims/       L2  10 evidence records, all with real citations
  policy/       L3  6 eligibility, 5 dosing, 8 safety
  products/     L4  products.json (composition) + pricing.json (volatile, split out)
  db/           L5  schema.sql — users, profile_versions, decision_records
  tools/        predicate.mjs, validate.mjs, demo.mjs, samples/
```

Superseded files (`user-profile-schema.json`, `ingredient-schema.json`, `products/product-schema.json`, `ingredients/omega-3-fish-oil.json`, `ingredients/probiotics.json`) were overwritten with deprecation stubs pointing at their replacements, so git history shows the migration.

## Tooling

- `node tools/validate.mjs` — CI gate. Referential integrity, plus two rules that are easy to violate accidentally: the **commercial firewall** (any eligibility or dosing predicate reading `monthlyBudgetINR` is a hard error) and a **grade-laundering** warning (a policy citing both a Strong and a Limited claim).
- `node tools/demo.mjs` — runs safety gate → eligibility → substitution → serving plan against the 5 sample profiles.
- `tools/predicate.mjs` — three-valued (Kleene) predicate evaluator with clause trace, plus `servingPlan()` implementing nearest-half rounding with the non-splittable fallback. This is the reference implementation to port to TypeScript.

## Verified behaviour

The demo reproduces from data alone: 130 g/day protein target − 90 g food = 40 g gap → 40 ÷ 24 = 1.667 → **1.5 scoops** (36 g); vegan omega-3 resolving to `algal-oil` with no rule mentioning veganism anywhere; unparseable medications escalating on `unknown` before any eligibility rule runs; the sedentary profile getting almost everything suppressed; and BCAA rendering as an explicit "not needed" card with its citation.

## Findings from the test run (documented in data/README.md)

1. **Endurance athletes get no protein recommendation** — `elig-protein-complete` gates on muscle_gain / strength_performance / general_fitness / weight_loss. Policy gap for the domain expert.
2. **`suppressOutcome` is per-policy, should be per-clause** — small schema change touching six policy files.
3. Four marketplace URLs are Amazon search pages, flagged `urlVerified: false`.
4. Three product composition records are placeholders; the multivitamin one feeds the UL ledger, so it must not ship unverified.
5. `reference/nutrient-requirements.json` has upper limits but almost no requirements — deliberately left empty rather than filled with plausible-looking numbers. Needs sourcing from ICMR-NIN 2020.

All 37 records are `draft_needs_expert_review`. That count is the honest measure of how much expert governance currently exists, and `validate.mjs` reports it on every run.

## Build plan — finalized into task briefs (2026-09-05)

The "ten work packages" sketch below has been fully written out as standalone task briefs under `tasks/` in the repo (`tasks/00-README.md` is the index). Each brief is self-contained enough to paste as the opening prompt in a fresh chat, or hand to a teammate directly. This section is now the summary; `tasks/*.md` is the source of truth going forward.

**Current app state (as of this note)**: nothing beyond `data/` existed yet in the repo. Root `README.md` was still the unmodified myAI6 template README — the app hadn't been forked in. So `tasks/B0-bootstrap-and-types.md` (fork myAI6 + publish shared TS types) was the literal first repo step and unlocked everything else. (B0 and B have since landed — see `b0-bootstrap-status.md` and `b-recommendation-engine-status.md`.)

**Ten packages, who owns each:**

| Package | File | Owner | Depends on |
|---|---|---|---|
| A | `tasks/A-domain-data-governance.md` | Domain expert (no repo needed) | none — run anytime |
| I | `tasks/I-regulatory-and-writeup.md` | Either | none — run anytime |
| B0 | `tasks/B0-bootstrap-and-types.md` | Sanket | none — run first, ~half day |
| B | `tasks/B-recommendation-engine.md` | Sanket | B0 (types); logic port can start immediately against `predicate.mjs` |
| C | `tasks/C-auth-and-persistence.md` | Sanket | B0 (app exists), not B0's types |
| D | `tasks/D-profile-intake-ui.md` | Sanket | B0 types + `data/questionnaire.md` |
| E | `tasks/E-results-basket-ui.md` | Sanket | B0 types; can build against `demo.mjs`/sample fixtures meanwhile |
| F | `tasks/F-pinecone-evidence-ingestion.md` | Sanket | B0 (app exists), not B0's types |
| G | `tasks/G-routine-builder.md` | Sanket | B0 types + B's serving-plan output shape |
| H | `tasks/H-integration-and-testing.md` | Sanket | B, C, D, E, F, G all merged — last, sequential |

Practical parallelization: run A, I, B0 first (three chats, no conflicts). Once B0 lands, fan out B, C, D, E, F, G as five more parallel chats. H is the final sequential integration pass.

**File-overlap notes**: B0 and B both touch `lib/engine/`/`types/` — B0 lands first, B rebases onto it. D and E both touch `app/`/`components/` but in different routes (intake vs. results) — low conflict if each stays in its own subtree. Everyone reads `data/`; only Package A should write to it.

**Specific known gaps carried into the briefs** (not re-litigated, just flagged to the right owner): endurance-athlete protein-eligibility gap → Package A; `suppressOutcome` should be per-clause not per-policy → Package B; 4 unverified marketplace URLs + 3 placeholder product records → Package A to fix, Package E to gate on `urlVerified` in the meantime.
