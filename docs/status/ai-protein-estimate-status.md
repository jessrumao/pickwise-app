# AI protein-estimate escape hatch (2026-09-06)

Status note for the team / future sessions. Follow-up to
`questionnaire-finalization-status.md`, which made `estimatedDailyProteinG`
a required slider. That fixed the "4-5 scoops/day" bug, but created a new
usability problem: most people genuinely don't know how many grams of
protein they eat a day, and a bare slider with no anchor invites a random
guess. This adds an AI-assisted alternative path to the same slider,
gated so it never runs unless the user says they don't know.

## What changed

**New: "describe what you eat instead" escape hatch on the protein slider.**
Only surfaces when the user picks "Not sure" on the adjacent
"do you consistently get enough protein from food?" question — never
shown by default, and never required.

- `app/api/intake/estimate-protein/route.ts` (new) — POST endpoint taking
  `{ dietaryPattern, bodyWeightKg, foodDescription }`. Uses `generateObject`
  (same `getModel(DEFAULT_VENDOR, DEFAULT_MODEL_ID)` pattern as
  `/api/intake/parse`) to turn a short free-text description ("eggs, dal,
  roti, paneer, milk") into `{ estimatedDailyProteinG, confidence }`. This
  is a normalization/estimation call, not a recommendation — same
  architectural boundary as every other AI use in this codebase (Package G's
  routine text is the only place an LLM writes user-facing prose; everywhere
  else it only fills structured fields the rules engine then reasons over).
- `lib/intake/submit-profile.ts`: `estimateProteinFromDescription()` client
  helper wrapping that endpoint.
- `lib/intake/schema.ts`: two new UI-only fields on `intakeFormSchema`,
  never read by the engine — `proteinFoodDescription` (the raw text sent to
  the endpoint) and `estimatedDailyProteinGConfidence` (the returned
  confidence, `undefined` on the default manual-slider path).
- `components/intake/intake-flow.tsx`: a "Not sure? Describe what you eat
  instead" toggle above the slider expands into a textarea + "Estimate for
  me" button. On success, `form.setValue("estimatedDailyProteinG", ...)`
  moves the slider and stores the confidence; **the slider stays adjustable
  afterward** — dragging it manually clears the stored confidence, treating
  it as the user's own fresh input again, same as if they'd never used the
  escape hatch.
- `lib/intake/assemble-profile.ts`: `fieldConfidence.estimatedDailyProteinG`
  now reads `form.estimatedDailyProteinGConfidence ?? 1` (full confidence
  unless the AI path set a real one), and `fieldsNeedingConfirmation()`
  takes an optional second parameter so a low-confidence AI estimate routes
  through the exact same needs-confirmation review screen already used for
  `existingSupplementUse` / `allergies` / `medicationsOrConditionsFlag.freeText`.
  Nothing new was built for the confirmation UI — this reuses the pattern.

## Why gated on confidence, not just shown once

The user's own framing was "this will only give a rough estimate" — per
this codebase's established rule (`CONFIRMATION_THRESHOLD = 0.7` in
`assemble-profile.ts`), no AI-parsed/estimated field is trusted silently
below that threshold. A vague description correctly produces a lower
confidence than a specific, itemized one, and only the former needs the
user's explicit sign-off before submission — verified directly (see below).

## Verification

`tsc --noEmit` clean. `eslint app/api/intake components/intake lib/intake`
clean (0 new errors; the one `react-hooks/incompatible-library` warning on
`form.watch` is pre-existing on every RHF form in this codebase). Full
`vitest run`: **166 tests pass** (164 prior + 2 new in
`assemble-profile.test.ts` for `fieldsNeedingConfirmation`'s new parameter:
ignores `undefined` on the manual path, flags `estimatedDailyProteinG` when
the AI path returns confidence below threshold).

**Endpoint verified directly**, confirming confidence scales with
description specificity as intended:
- Vague: `{"dietaryPattern":"vegetarian","bodyWeightKg":70,"foodDescription":"eggs, dal, roti, paneer, milk"}` → `{"estimatedDailyProteinG":65,"confidence":0.55}` — below threshold.
- Specific/itemized: `{"dietaryPattern":"omnivore","bodyWeightKg":80,"foodDescription":"breakfast is 4 eggs and oats, lunch is 200g chicken breast with rice, dinner is fish curry with roti, snack is a protein shake and some nuts"}` → `{"estimatedDailyProteinG":155,"confidence":0.75}` — above threshold.

**Manually verified in-browser, full click-through** with the vague
description above: toggle expands the textarea, "Estimate for me" shows a
loading state then moves the slider to the returned 65g, the review step
displays "Estimated daily protein: 65g" under Diet gaps, and — because
confidence was 0.55 — submitting correctly routes to the existing
needs-confirmation screen ("Please double-check a couple of things we
weren't fully sure we parsed correctly: Estimated daily protein (from what
you described): 65g") before the final "Looks right, submit" completes the
flow. This confirms the fail-safe behaves as intended: the AI estimate is
never silently trusted when it's a genuine guess.

## Update (2026-09-06): dropped the static reference table, added height

Follow-up product feedback: keep the manual slider as the primary path
(unchanged), but reconsider the static "Need help estimating?" food-protein
reference table (`lib/intake/protein-food-reference.ts`) that sat below it —
requiring someone to manually cross-reference a lookup table is worse than
just letting them describe their day and having the model do that
arithmetic, which the escape hatch above already does for anyone who says
"Not sure." Removed the table and the now-unused file entirely; the escape
hatch is unchanged in when it appears, just the only aid offered now.

Also widened `/api/intake/estimate-protein`'s inputs to include `heightCm`
(previously only `bodyWeightKg`), and told the model explicitly to use
weight/height only as context for realistic portion sizes for someone of
that build — never to estimate protein from body stats alone, since the
food description is what should actually drive the number. Verified via
curl (`heightCm: 178` alongside the same vague description still correctly
returns confidence 0.55) and in-browser end to end: the toggle now reads
"What are the most common foods you eat in a day?", no reference table is
rendered, and the slider still updates correctly (75g, from a 70kg/170cm/
omnivore profile eating "eggs, dal, roti, chicken curry, milk").

`tsc --noEmit`, `eslint`, and the full `vitest run` (166 tests) all stayed
clean — this was a UI/prompt change only, no schema or test-covered logic
touched.

## Update (2026-09-06): ground the estimate in real values, not LLM memory

Stress-tested the single-call LLM estimate against 20 common Indian foods
with known real protein values and found it unreliable in two ways: (1)
inconsistent differentiation between close quantities — 50g and 100g of
chicken breast once returned the identical estimate — and (2) outright
wrong nutrition priors for specific foods, most notably regular curd
(200g) coming back at 28g protein against a real value of ~8g, a 3.5x
overestimate. Prompt-only fixes (asking it to be "conservative," lowering
temperature) improved consistency but couldn't fix a wrong prior, and once
overcorrected into returning 0g for a description that clearly named a
protein food ("chicken rice vegetables salad").

Root fix: stopped asking the LLM to compute protein at all. It now only
*identifies* foods and estimates their quantity in grams (converting
stated units — pieces, bowls, ml/L — using realistic Indian-diet portion
sizes), matching each item against a new real per-100g reference table,
`lib/intake/protein-database.ts` (~29 common foods: roti, dal, paneer,
curd, milk, eggs, chicken/fish variants, legumes, South Indian staples,
nuts, soy chunks, generic vegetables/fruit). `computeProteinFromItems()`
(`lib/intake/compute-protein-from-items.ts`) then does the actual
multiplication in code — deterministic, not LLM arithmetic. Only foods
with no reasonable database match fall back to the LLM's own per-item
guess, and returned confidence is now `quantityConfidence × matchedProteinFraction`
— computed in code, not self-reported by the model — so an estimate resting
on unmatched guesses is never treated as confidently as one built on real
values, no matter how fluent it sounds.

Re-ran the same 20-food stress test after this change: nearly every result
now matches (or is within 1-3g of) the real reference value, e.g. regular
curd corrected from 28g to 7g (true ~8g), and confidence rose to 0.85-0.95
for these well-specified single items — now honestly earned, since the
arithmetic behind it is real. The gram-differentiation bug is also fully
resolved: 50g/100g/200g chicken breast (+ 2 eggs) now returns 29g/44g/75g,
exactly proportional to the stated quantity. Confirmed the previously-fixed
cases still hold: vague inputs stay low-confidence (0.25-0.35), the
zero-protein regression is gone (38g for "chicken rice vegetables salad"),
and ml/L liquid scaling is exact (250ml/500ml/1L milk → 9g/17g/34g, matching
milk's real 3.4g/100g).

Added `lib/intake/__tests__/compute-protein-from-items.test.ts` (6 tests,
pure function, no network call) covering: single real-value lookup, summing
multiple matched items, the unmatched self-estimate fallback, a mixed
matched+unmatched case's fractional confidence weighting, the empty-items
edge case, and an unmatched item with no self-estimate defaulting to zero
rather than throwing. Full suite: **172 tests pass** (166 prior + 6 new).
`tsc --noEmit` and `eslint app/api/intake lib/intake` both clean. Verified
end to end in-browser: "100g paneer, 2 eggs, 1 bowl dal" → exactly 45g
(18 + 13 + 14, matching the database's real values precisely).

## Not done here (intentionally)

- No confidence-threshold tuning beyond reusing the existing `0.7` constant
  — not re-derived or asked to be domain-reviewed for this specific field.
- No caching/rate-limiting on the new endpoint — same as `/api/intake/parse`,
  which has none either; out of scope for an intake-time, once-per-session call.
- `PROTEIN_DATABASE`'s ~29 entries are typical/rounded figures (same caveat
  the old UI-facing reference table carried), not lab-verified per-brand
  values — good enough for a rough supplement-dosing estimate. Extending
  coverage (regional dishes, more packaged/branded foods) is straightforward
  since `computeProteinFromItems` and the schema are already generic over
  the table's contents — just add entries to `protein-database.ts`.
