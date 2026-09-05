# Data layer — v3

The knowledge base and its contracts. Plain JSON, no framework, no build step.
Everything here is readable by `node` today: `node tools/validate.mjs` and `node tools/demo.mjs`.

Design rationale lives in `../MVP-Plan.md`, the project's `data-layer-decisions-v2.md`,
and the "Retrieval Explains, Rules Decide" architecture doc. This README is the map.

## The one rule

Storage is split by **whether the lookup has to be reproducible**, not by what kind of thing
is stored. Everything a recommendation depends on lives here as exact structured data.
Pinecone holds evidence *prose* and is queried only after a decision is made.
Retrieval never reaches the decision. Neither does price. Neither does the LLM.

## Layout

```
schema/       contracts. Read these first — they carry the reasoning in their descriptions.
reference/    L0  ICMR-NIN requirements and IOM/FDA upper limits
entities/     L1  compounds, ingredients' vocabularies, goals → outcomes
ingredients/  L1  delivery vehicles: what each delivers, and who it suits
claims/       L2  evidence: one (subject × outcome × population) finding each
policy/       L3  expert-signed decisions — eligibility, dosing, safety
products/     L4  products.json (stable composition) + pricing.json (volatile)
db/           L5  Postgres schema for profile versions and decision records
tools/        validator, predicate evaluator, sample profiles, demo runner
```

References only ever point **downward**: policy cites claims, claims describe compounds,
products map to compounds, decisions pin versions. That is what lets each layer be
reviewed and versioned on its own clock.

## Three things worth understanding before editing anything

**1. Compounds, not ingredients, are the unit of reasoning.**
A compound has an effect and a dose (`epa-dha`, `creatine-monohydrate`, `protein-complete`).
An ingredient is a vehicle that delivers compounds (`fish-oil`, `algal-oil`, `whey-protein`).
There is one protein eligibility rule, not one for whey and one for pea — the vegan path is a
query over `delivers[]` + `suitableFor`, not a branch in the rule. Adding a vegan ingredient
later requires **zero rule edits**. This is also what makes upper-limit stacking and
₹-per-effective-dose arithmetic rather than guesswork.

**2. Rules are data, evaluated with three-valued logic.**
Predicates are JSON ASTs (`schema/predicate.schema.json`), never `eval`'d strings.
A missing or null field evaluates to `unknown`, not false, and each policy declares what
unknown means for it: eligibility sets `onUnknown: "false"` (don't recommend), safety sets
`onUnknown: "true"` (escalate). *That* is what "fail closed" means concretely — an unparseable
medication list escalates rather than quietly passing a contraindication check.
The evaluator returns a clause trace, and the user-facing explanation is generated **from**
that trace, so it cannot drift away from the logic that actually fired.

**3. Every judgment carries its own review block.**
Not per file — per judgment. An evidence grade, a dosing target and a contraindication are
three separate expert sign-offs with three separate `review` blocks. All 37 records are
currently `draft_needs_expert_review`. That number is the honest measure of how much
expert governance actually exists.

## Running it

```bash
node tools/validate.mjs   # referential integrity + policy checks. CI gate. Exits non-zero on error.
node tools/demo.mjs       # runs safety gate + eligibility + substitution + serving plan
                          # against the 5 sample profiles in tools/samples/
```

`validate.mjs` is what makes "git as a database" safe. Beyond checking that every id resolves,
it enforces two rules that are easy to violate by accident:

- **The commercial firewall.** Any eligibility or dosing predicate that reads
  `monthlyBudgetINR` is a hard error. Budget may only be read by the allocator, which runs
  after the recommendation set is fixed.
- **Grade laundering.** A policy citing both a Strong and a Limited claim gets a warning —
  the Strong claim may describe a different dose or population, and the derived grade would
  otherwise be inflated. `elig-epa-dha-general` is the live example: it cites only the Limited
  general-population claim, even though a Strong triglyceride claim sits in `claims/`.

## What the demo currently proves

Running `tools/demo.mjs` reproduces, from the data alone:

- **vegetarian-muscle-gain** → protein RECOMMENDED, 130 g/day target − 90 g food = 40 g gap,
  40 ÷ 24 g per scoop = 1.667 → **1.5 scoops** (36 g). Creatine RECOMMENDED. BCAA shown as an
  explicit NOT NEEDED card with its citation.
- **vegan-endurance** → omega-3 resolves to `algal-oil`, not `fish-oil`. No rule mentions
  veganism anywhere; it falls out of `suitableFor`.
- **unparseable-medications** → global escalation, fired on `unknown`, before any eligibility
  rule runs.
- **sedentary-wellness** → almost everything suppressed. The engine saying "you need nothing".
- **already-covered** → suppression rather than a second recommendation to buy more.

## Known findings from the test run

These came out of running `demo.mjs`, which is what it is for. None are blockers.

1. **Endurance athletes get no protein recommendation.** `elig-protein-complete` gates on
   `muscle_gain / strength_performance / general_fitness / weight_loss`. The vegan-endurance
   profile trains five days a week and is `unsure` about protein intake, and still falls
   through. Endurance training does raise protein requirements — this is a policy gap for the
   domain expert, not a code bug.
2. **`suppressOutcome` is per-policy but should be per-clause.** The sedentary profile gets
   "ALREADY COVERED" for protein when the real reason is "gets enough from food" (NOT NEEDED).
   Fix is to make `suppressWhen` an array of `{when, outcome}` rather than a single predicate.
   Small schema change, touches six policy files.
3. **Four marketplace URLs are search pages, not listings**, carried over from Day 1 and now
   flagged as `urlVerified: false`. The UI must not present these as product links.
4. **Three product composition records are placeholders** (`algal-omega3-vegan-60`,
   `hkvitals-multivitamin-men-60`, `hkvitals-pre-probiotic-60`). The multivitamin one feeds the
   upper-limit ledger, so wrong numbers there produce wrong *safety* output. It must not ship
   unverified.
5. **`reference/nutrient-requirements.json` has upper limits but almost no requirements.**
   Deliberately left near-empty rather than filled with plausible-looking numbers. Micronutrient
   gap assessment stays disabled until it is sourced from ICMR-NIN 2020.

## Superseded files

`user-profile-schema.json`, `ingredient-schema.json`, `products/product-schema.json`,
`ingredients/omega-3-fish-oil.json` and `ingredients/probiotics.json` are stubs pointing at
their replacements. They are kept only so git history shows the migration.
