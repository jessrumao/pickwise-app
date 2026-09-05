# Package A — Domain & Data Governance

**Owner:** domain expert (life-sciences background). **Repo checkout not required** — every file here can be reviewed on GitHub's web UI or from a shared export; edits can be handed back as comments, a marked-up spreadsheet, or direct small JSON edits if comfortable doing so.

## Why this package exists

The product's entire trust story is "we recommend what's appropriate, not what's profitable" — and the only thing that makes that credible is that a real domain expert has actually reviewed the rules, not an AI. Right now, all 37 data records in `data/` (8 ingredients, 10 evidence claims, 19 policies) are tagged `draft_needs_expert_review`. That number is printed by the validator on every run — it's the honest, visible measure of how much expert governance currently exists. This package is what brings it down.

This is, realistically, the largest single block of work in the project, and it's the one most likely to get silently deprioritized because it doesn't need a repo checkout and doesn't block a demo from *running* — only from being credible. Please don't let it slip.

## What to review

Files live under `data/` in the repo (`SupplementRecommendationEngine`). You don't need to understand the schema internals — the reasoning is written into the field descriptions in `data/schema/*.json`, and each record is plain JSON.

1. **`data/ingredients/*.json`** (8 files) — one record per ingredient: whey, plant-protein-blend, creatine-monohydrate, fish-oil, algal-oil, multivitamin, probiotic-lgg, bcaa. Check: forms, indications, dosing ranges, contraindications.
2. **`data/claims/*.json`** (10 files) — one evidence finding each (subject × outcome × population), with citations. Check: is the citation real and does it actually support the stated grade (Strong/Moderate/Limited/Insufficient)? Is the population match honest (e.g. a resistance-trained-adults finding shouldn't get cited to support a general-population claim)?
3. **`data/policy/eligibility/*.json`**, **`data/policy/dosing/*.json`**, **`data/policy/safety/*.json`** (19 files total) — the actual decision rules. This is the highest-leverage review: these are what fire "recommended," "escalate," or "not needed" for a real user.

Each of the above has a `review` block per judgment (not per file — a claim's evidence grade, a policy's dosing target, and a policy's contraindication list each get their own sign-off). Your sign-off is changing `draft_needs_expert_review` to reviewed/approved (exact field name is in `schema/`) once you're satisfied, or leaving a note if something needs a fix.

## Specific fixes needed (already found, not hypothetical)

1. **Endurance athletes currently get no protein recommendation.** `elig-protein-complete` only fires on goals `muscle_gain / strength_performance / general_fitness / weight_loss`. A vegan endurance athlete training 5x/week and unsure about protein intake falls through with nothing. Endurance training does raise protein needs — please confirm the right threshold/goal to add, and what dose target applies.
2. **`reference/nutrient-requirements.json` has upper limits (IOM/FDA) but almost no actual requirements.** This was deliberately left near-empty rather than filled with guessed numbers. It needs sourcing from **ICMR-NIN 2020** (Indian RDA/EAR values) before micronutrient gap math (e.g. "you're getting X% of your B12 requirement") can turn on. This is probably the single most valuable thing you can add, since it's currently the biggest gap between "US/generic guidance" and "India-first."
3. **Remaining ingredients.** The original scope was the full ~20-item green list; only 8 are built. If you have a preferred next 4-6 (the original suggestion was to prioritize whichever have the strongest/most demo-relevant evidence), draft them in the same shape as the existing 8 ingredient + claim + policy records.

## Product verification (also this package)

`data/products/products.json` and `data/products/pricing.json`:
- **4 marketplace URLs are flagged `urlVerified: false`** — they're Amazon search-result pages, not actual product listings. Need real listing URLs (Amazon.in, HealthKart, etc.) before these can be shown as "buy" links.
- **3 product composition records are placeholders**: `algal-omega3-vegan-60`, `hkvitals-multivitamin-men-60`, `hkvitals-pre-probiotic-60`. The multivitamin one specifically feeds the upper-limit safety ledger — wrong numbers there produce wrong *safety* output, not just a bad recommendation, so this one should not ship unverified under any circumstances.
- General check for the rest: does the listed "effective amount per serving" match the actual label? Note in `data-layer-decisions-v2.md`'s open item #2: this is inherently "label-claimed dose," not verified content — underfilling/adulteration is a known problem in the Indian supplement category, which is fine to note as a limitation but the label numbers should at least be transcribed correctly.

## Ground rules to keep in mind while reviewing

- **Rules are data, not code** — you're editing/approving JSON, not touching any app logic.
- **Fail-closed semantics**: a missing/unknown field is not treated as "false" — eligibility rules quietly don't recommend on unknown, but safety rules escalate on unknown. If you're unsure whether a new rule should be `onUnknown: "true"` or `"false"`, default toward safety (escalate) and flag it for a second look.
- **No budget logic here.** Nothing in eligibility or dosing should ever reference price/budget — that's enforced by an automated check (`validate.mjs`) and any rule that references `monthlyBudgetINR` will hard-fail CI. You won't need to think about this, just know it's a wall that exists.

## Deliverable

Either: (a) direct edits to the JSON files (a PR, or files handed back), or (b) a marked-up doc/spreadsheet Sanket can turn into edits — whichever is easier for you. Flag anything you're not confident signing off on rather than approving it provisionally; `draft_needs_expert_review` staying true on a record is a completely fine outcome to hand back.
