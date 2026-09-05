# Package B — Recommendation Engine (Rules Core)

**Owner:** Sanket (or a parallel chat once B0 has landed or is close). **Can start immediately** against `data/tools/predicate.mjs` as the reference implementation — just plan to rebase onto B0's published types once they exist rather than inventing your own.

## The one rule that governs everything in this package

Recommendations only ever come from exact, structured lookups over `data/` — **never** from vector/embedding retrieval, never from the LLM, and never from price. Pinecone (Package F) only gets queried *after* a decision is made, to fetch citations to display — it cannot influence what gets recommended. If you find yourself wanting the LLM to decide or nudge a recommendation, stop — that's the one architectural boundary this whole product is built around.

## What to port

`data/tools/predicate.mjs` and `data/tools/demo.mjs` are the working JS reference implementation. Port the same logic to TypeScript inside the app (`lib/engine/`), building on B0's types. Pipeline, in order:

1. **Predicate evaluator** — three-valued (Kleene) logic over the JSON AST predicates in `data/policy/*/*.json`. A missing/null field evaluates to `unknown`, not `false`. Each policy declares what `unknown` means for it: eligibility policies set `onUnknown: "false"` (don't recommend), safety policies set `onUnknown: "true"` (escalate) — this is what "fail closed" means concretely, e.g. an unparseable medication list escalates rather than silently passing a contraindication check. The evaluator must return a **clause trace** — this is what the LLM will later use to phrase (never invent) an explanation.

2. **Safety gate** — runs first, over `data/policy/safety/*.json` (8 policies). Includes the global unparseable-medications escalation and the global pregnancy escalation, which fire before any eligibility rule runs.

3. **Eligibility** — over `data/policy/eligibility/*.json` (6 policies). Remember: compounds, not ingredients, are the unit of reasoning. An ingredient is a delivery vehicle (`fish-oil`, `algal-oil`, `whey-protein`); a compound has the effect and dose (`epa-dha`, `creatine-monohydrate`, `protein-complete`). There's one protein eligibility rule, not one per ingredient — vegan substitution is a query over `delivers[]` + `suitableFor` on the ingredient records, not a branch in the rule. Verify this by reproducing the `vegan-endurance` sample: omega-3 must resolve to `algal-oil`, not `fish-oil`, with zero rule anywhere mentioning veganism.

4. **Suppression** — "not needed" / "already covered" outcomes (e.g. BCAA suppressed when protein intake is already adequate; the `already-covered` sample profile). Known issue to be aware of (not necessarily yours to fix, flag to Package A if it's a policy-authoring question vs. yours if it's an engine bug): `suppressOutcome` is currently per-policy but should be per-clause — `suppressWhen` should become an array of `{when, outcome}` rather than a single predicate, so e.g. the sedentary profile can correctly say "not needed" (gets enough from food) instead of "already covered."

5. **Serving plan** — dose (policy × body weight) → serving plan (arithmetic + the rounding rule) → routine (out of scope here, that's Package G). Reproduce the worked example: 130g/day protein target − 90g from food = 40g gap → 40 ÷ 24g/scoop = 1.667 → rounds to **1.5 scoops** (36g), because nearest-half is closer than nearest-whole. Watch the edge case in `data-layer-decisions-v2.md` consequence #3: nearest-half is safe for protein but not for a compound with a `minEffectiveDose` threshold and a non-splittable product — a 2-capsule target must not round down to 1.

6. **Priority scoring** — `priority_score = gap_tier + evidence_tier + goal_alignment`, additive, not multiplicative. Gap tier: severe/moderate/mild vs. requirement, 3/2/1. Evidence tier: Strong/Moderate/Limited/Insufficient, 3/2/1/0. Goal alignment: primary goal 2, secondary goal 1, neither 0. No hard override for true nutrient deficiencies — they compete on the same score, don't auto-jump the queue. Reference worked example (must reproduce): protein (severe/strong/primary) = 8, creatine (moderate/strong/primary) = 7, omega-3 (mild/moderate/secondary) = 4.

7. **Budget allocator** — runs strictly *after* the recommendation set and priority order are fixed, price-blind, in priority order (never cheapest-first). Anything that doesn't fit is "deferred" with its price shown, never silently dropped. Downgrade to a cheaper SKU is allowed only if it still meets the required effective dose (the quality floor — no separate third-party-testing gate, dose-met is the only gate).

## Verify against the 5 sample profiles

`data/tools/samples/*.json` + `node data/tools/demo.mjs` is your ground truth. Your TS port must reproduce, exactly:
- `vegetarian-muscle-gain` → protein RECOMMENDED at 1.5 scoops, creatine RECOMMENDED, BCAA shown as an explicit NOT NEEDED card with citation.
- `vegan-endurance` → omega-3 resolves to algal-oil. **Also** — this profile currently exposes the known protein-eligibility gap (see Package A); don't silently "fix" this by hacking the engine, it's a policy-data issue, flag it.
- `unparseable-medications` → global escalation fires on `unknown`, before any eligibility rule runs.
- `sedentary-wellness` → nearly everything suppressed.
- `already-covered` → suppression, not a second recommendation.

## Enforcement rules already automated (don't fight these, they're correct)

`data/tools/validate.mjs` is the CI gate and enforces two things you must respect in your port too: **the commercial firewall** (no eligibility/dosing predicate may read `monthlyBudgetINR` — hard error) and a **grade-laundering warning** (a policy citing both a Strong and a Limited claim — check `elig-epa-dha-general` as the deliberate example: it cites only the Limited general-population claim even though a Strong triglyceride-specific claim exists in `claims/`, because that claim describes a different outcome/dose).

## File overlap warning

You and B0 will both touch `lib/engine/` and `types/`. B0 should land first; if you're starting before it does, keep your logic in a standalone module that's trivial to re-point at the real types once published, rather than deep-integrating with placeholder types.

## Deliverable

`lib/engine/` (or agreed path) implementing the full pipeline above, with unit tests reproducing all 5 sample profiles' `demo.mjs` output exactly. This is the critical-path package — D, E, and G all consume its output shape.
