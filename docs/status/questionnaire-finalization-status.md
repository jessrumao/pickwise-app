# Questionnaire finalization: compulsory dietary estimates, exercise intensity (2026-09-06)

Status note for the team / future sessions. Follow-up to `ui-polish-1-status.md`,
prompted by a real product bug report and a broader "what should we actually
ask" conversation. Touches the intake form (Package D), the shared profile
schema (`types/engine.ts` / `data/schema/user-profile.schema.json`), and
`lib/engine/dosing.ts` (Package B).

## The bug that started this

Protein was being recommended as "4-5 scoops/day" for most users. Root
cause: `estimatedDailyProteinG` was optional and shown only conditionally,
so `resolveDosing()` almost always fell back to the FULL per-kg-bodyweight
target instead of `target - actual diet` — see `lib/engine/dosing.ts`'s own
`gapIsQuantified` logic. Fixed by making the question compulsory rather
than patching the display.

## What changed

**1. Protein estimate — now a required slider, not an optional number field.**
- `lib/intake/schema.ts`: `estimatedDailyProteinG` is required, range
  0-250 (was optional, 0-400 — 400 only made sense as a defensive engine
  bound, not a realistic slider range).
- UI: a shadcn `Slider` with a live "Ng" readout, plus a collapsible "Need
  help estimating?" panel (`lib/intake/protein-food-reference.ts`) listing
  common Indian foods' protein per 100g and a typical serving size —
  presentational only, never read by the engine.
- Still stays optional in `UserProfile`/`user-profile.schema.json` itself
  (not every profile source is the intake form — samples, demo fixtures)
  — same pattern already used for `heightCm`.

**2. Omega-3's identical gap bug, fixed the same way — but via existing data, not a new question.**
`dose-epa-dha-general-health.json` also has `subtractDietaryIntake: true`,
but `dietaryOilyFishServingsPerWeek` is a serving COUNT, not an amount —
this was flagged as a known limitation in `dosing.ts`'s own header comment
since Package B. Rather than adding a new "how many mg of EPA/DHA do you
eat" question (nobody knows that number), `resolveDietaryIntake()` now
converts the already-asked serving count into an approximate daily mg
estimate via a deliberately conservative constant
(`AVG_EPA_DHA_MG_PER_OILY_FISH_SERVING = 500`, flagged in-code as a draft
needing Package A/domain review). `dietaryOilyFishServingsPerWeek` is now
also required in the intake form (was optional), so this conversion always
has a real number to work with.

**3. New additive question: exercise intensity.**
Prompted by a request to add nuance to the exercise question, modeled on a
BMR/TDEE-calculator "activity level" picker. Deliberately did **not** adopt
that pattern wholesale — it blends frequency and intensity into one fuzzy
label, which is harder for this project's rules engine to gate on reliably
than the clean numeric frequency question already asked. Instead added a
new, separate field: `exerciseIntensityTypical` (`light` / `moderate` /
`vigorous`, MET-style definitions), alongside the unchanged frequency/type
questions. **Not yet read by any eligibility/dosing/safety policy** —
collected for whoever next authors policy that could use it (flagged in
both `types/engine.ts` and the JSON schema).

## Two other precision fixes made along the way (same session, same root-cause pattern)

- **`elig-caffeine.json`** widened to include the `energy_fatigue` goal —
  the sanctioned goal-based alternative to a symptom question ("do you feel
  tired before the gym?") that `data/questionnaire.md`'s own explicit
  non-goals rules out.
- **`elig-magnesium.json`** now also fires directly off
  `sleepHoursTypical < 7`, not only the self-selected `sleep_quality` goal
  — `magnesium-sleep-quality` is exactly the claim being cited, so a real
  reported shortfall is at least as strong a signal as a self-picked goal.

Both marked back to `draft_needs_expert_review` since they change what was
previously `expert_reviewed`. Separately: **`pickTopCandidateProduct` now
ranks by price per unit delivered, not catalogue order** — a real product
bug (Optimum Nutrition's 1lb SKU was being recommended over a cheaper,
better-value MuscleBlaze 1kg SKU of the same ingredient purely because it
was listed first in `products.json`). See individual commits for each.

## Also identified, explicitly NOT acted on this round

- **Nine "Red tier" entities** (Vitamin D3/B12/C/A, Folate, Iron, Zinc,
  Calcium, *S. boulardii*) have zero eligibility policy — unreachable by
  any questionnaire answer today. Confirmed deliberate, matches Package I's
  writeup; no questionnaire change fixes this, it needs Package A policy
  work.
- **Ashwagandha** (on the original candidate list, never built),
  **melatonin**, **intra-workout carbs**, **fiber** — flagged for the
  Package A round the user is picking up next. Melatonin doesn't appear
  anywhere in the project's prior history; the others were on the original
  "Yellow tier" candidate list in the handoff doc alongside beta-alanine/
  caffeine/magnesium, which were built, and collagen, citrulline malate,
  nitric oxide boosters, turmeric/curcumin, glucosamine, rhodiola rosea,
  and HMB, which weren't.
- **Symptom-based questioning generally** ("do you feel tired," "do you
  lose motivation mid-workout," "do you feel hungry") was proposed and
  explicitly rejected as a pattern — conflicts with `data/questionnaire.md`'s
  Day-1 "no diagnostic/symptom-checker questions" decision and the
  regulatory risk Package I's writeup already researched. Goal-based
  gating (widening an existing goal list, as done for caffeine above) is
  the sanctioned alternative when a targeting gap looks like it needs a
  new question.

## Verification

`tsc --noEmit` clean, `eslint` clean (0 new errors; one pre-existing
`react-hooks/incompatible-library` warning on `form.watch`, same as every
other RHF form in this codebase). Full `vitest run`: **164 tests pass**
(154 prior + 2 new for the omega-3 dietary-gap conversion, plus updates to
`recommend.samples.test.ts`/`budget.test.ts` for the now-quantified omega-3
gap tier reordering the deferred basket).

**Manually verified in-browser, full click-through**: exercise-intensity
question renders with the MET-style copy and defaults to "moderate"; the
protein slider drags correctly with a live readout; the food-reference
panel expands with the full Indian-food list; a real submission with a
manually-set 65g protein estimate produced a **2.5-serving (62.5g)**
recommendation from the real per-kg-bodyweight target minus the real
diet estimate — not the old blanket "4-5 scoops."

## Not done here (intentionally)

- `exerciseIntensityTypical` is collected but not wired into any policy —
  a data/policy-authoring decision for whoever next touches
  `data/policy/eligibility|dosing/*.json`, not something to silently infer
  from the intake side.
- `AVG_EPA_DHA_MG_PER_OILY_FISH_SERVING`'s exact value (500mg) is a
  reasonable, deliberately conservative placeholder, not a reviewed
  nutrition-science figure — flagged in-code for Package A.
- The Package A ingredient candidates identified in this conversation
  (ashwagandha, melatonin, carbs, fiber, plus the rest of the never-built
  original Yellow-tier list) are not built here — that's the next round of
  work the user is picking up directly.

## For whoever picks up next

If a future policy wants to read `exerciseIntensityTypical`, it's already
flowing through the whole pipeline (form → `assembleUserProfile` →
`UserProfile` → persisted via Package C) — just add a `field` reference to
it in the relevant policy JSON, no plumbing needed. Same for anyone
revisiting `AVG_EPA_DHA_MG_PER_OILY_FISH_SERVING` — it's the one constant
in `lib/engine/dosing.ts` to change.
