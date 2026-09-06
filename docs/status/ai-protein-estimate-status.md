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

## Not done here (intentionally)

- No confidence-threshold tuning beyond reusing the existing `0.7` constant
  — not re-derived or asked to be domain-reviewed for this specific field.
- No caching/rate-limiting on the new endpoint — same as `/api/intake/parse`,
  which has none either; out of scope for an intake-time, once-per-session call.
