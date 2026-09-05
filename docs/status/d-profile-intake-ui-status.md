# Package D — Profile Intake UI — done (2026-09-06)

Status note for the team / future sessions picking up Packages E, G, H. Follows
`tasks/D-profile-intake-ui.md`. Builds on `b0-bootstrap-status.md` (types) and
`b-recommendation-engine-status.md` (the engine D's output feeds, once E wires
it up).

## What exists now

```
webapp/
  app/intake/page.tsx                    <- the /intake route
  components/intake/intake-flow.tsx      <- the 17-step form (client component)
  app/api/intake/parse/route.ts          <- AI free-text normalization (Q8/Q11/Q13)
  app/api/profile/route.ts               <- STUB for Package C, see below
  lib/intake/schema.ts                   <- react-hook-form + zod schema for the form
  lib/intake/assemble-profile.ts         <- pure: form + parsed text -> UserProfile
  lib/intake/submit-profile.ts           <- client fetch helpers (parse, submit)
  lib/intake/__tests__/assemble-profile.test.ts  <- 7 tests against the 5 real samples
```

## The flow

17 steps, in the order `data/questionnaire.md` specifies (demographic → goals →
sensitive-last), with the two v3-added fields slotted in per the brief:
`bodyWeightKg` next to the other demographic questions (step 3, with optional
`heightCm`), `monthlyBudgetINR` + `budgetIsHardConstraint` right after
`primaryGoals` (step 8) — framed with its own sentence making clear it only
affects the budget allocator, never eligibility, matching the "don't position
budget and goals as one question" instruction in the brief. A conditional
`isPregnantOrBreastfeeding` question appears only when `sex === "female"`; a
conditional `estimatedDailyProteinG` appears unless protein adequacy is
`likely_adequate`; a conditional `medicationsFreeText` textarea appears only
when `medicationsHasAny` is true. Per-step validation uses
`form.trigger(STEP_FIELDS[step])` so Back/Next never needs a second schema.

**AI's only role**, per the brief: `app/api/intake/parse/route.ts` takes the
three free-text answers (current supplements, allergies, medications) and
returns normalized fields + a confidence per field, using `generateObject`
against the utility model (`getUtilityModel()`/`utilityProviderOptions()` from
`lib/ai/model-registry.ts` — same utility-model pattern the chat route already
uses for background work). It does not see recommendation logic. The prompt is
given the real `data/entities/compounds.json` id+alias list so "whey protein"
maps to `protein-complete` instead of an invented id; anything that doesn't
match a known compound is kept as lowercase free text rather than guessed.
When all three free-text fields are empty/false, the route short-circuits
without an LLM call.

Fields whose parse confidence is below `CONFIRMATION_THRESHOLD` (0.7, in
`assemble-profile.ts`) stop at a review screen listing what was understood,
matching `user-profile.schema.json`'s `_meta.confirmedByUser` mechanism —
confirming writes those field names into `_meta.confirmedByUser` before
submit. This is also how the fail-closed unparseable-medications sample
(`parseConfidence: 0.35`) should surface to a real user: not silently, but as
"please confirm this."

## Submission

`POST /api/profile` is a **stub for Package C**: it validates the body against
`userProfileSchema` and returns `{ profileVersionId: "stub-<uuid>" }` without
persisting anything (logs a `TODO(Package C)` warning). `lib/intake/submit-
profile.ts`'s `submitProfile()` is the only caller-facing surface — Package C
should be able to replace the route's body with a real `profile_versions`
insert without any client-side change. On success, the intake page currently
renders a plain confirmation with the raw assembled `UserProfile` JSON printed
(`app/intake/page.tsx` → `IntakeFlow`'s "done" state) — a placeholder until
Package E's results screen exists to render real recommendations there
instead.

## Verification

`tsc --noEmit` clean, `npx eslint app/intake app/api/intake app/api/profile
components/intake lib/intake` — 0 errors (1 pre-existing-pattern warning:
React Compiler flags `react-hook-form`'s `watch()` as unmemoizable, which is
true of every RHF form, not specific to this one). Full `vitest run`: **129
tests pass** (122 from B0/B + 7 new). The 7 new tests
(`lib/intake/__tests__/assemble-profile.test.ts`) run `assembleUserProfile()`
against all 5 real files in `data/tools/samples/*.json` — reconstructing what
the form + a hypothetically-perfect AI parse would produce and checking it
matches the sample field-for-field (including the `unparseable-medications`
sample's 0.35 confidence correctly tripping `fieldsNeedingConfirmation`) — plus
a `userProfileSchema.safeParse` check on each assembled result. This is a
sanity check on the *assembly logic*, not the LLM's parsing quality, which a
unit test can't verify without a network call.

**Manually verified in-browser** (Chrome via the dev server, `/intake`): the
full 17-step flow end to end twice — once exercising every conditional branch
(female → pregnancy question, medications yes → free-text requirement,
required-field validation blocking `Next`, the `primaryGoals` 1–3 constraint),
once leaving every optional/free-text field at its default to confirm the
"nothing to parse" short-circuit path is reachable. `POST /api/profile`
verified directly with `curl`: valid profile → `stub-<uuid>`, invalid shape →
400, invalid JSON → 400.

**Known gap, not this session's to fix**: this dev environment's
`ANTHROPIC_API_KEY` in `.env.local` is an empty placeholder, so
`/api/intake/parse`'s actual LLM call couldn't be exercised live — it fails at
`lib/env.ts`'s module-level `validateEnv()`, the same fail-fast guard
`app/api/chat/route.ts` already relies on (the chat feature is equally blocked
by this). Once a real key is added, both should work identically; nothing in
Package D's code should need to change.

## Not done here (intentionally, per D scope)

- No results rendering — that's Package E. The "done" state today just prints
  the JSON that would be handed to `generateRecommendations()`.
- No real persistence — Package C's job; `/api/profile` is a stub by design.
- No routine-builder integration — Package G, downstream of E.

## For whoever picks up E, G, H next

Import `assembleUserProfile`/`ParsedFreeText` from `@/lib/intake/assemble-
profile` if you need to construct a `UserProfile` outside the form (e.g. a
test fixture). The intake route and results route are meant to live in
separate `app/` subtrees (`app/intake/` vs. whatever E creates) per the
file-overlap warning in both task briefs — low conflict risk as long as E
doesn't touch `app/intake/` or `components/intake/`.
