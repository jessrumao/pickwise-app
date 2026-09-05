# Package D — Profile Intake UI

**Owner:** Sanket (or a parallel chat). **Needs B0's types** to integrate for real; can be scaffolded against `data/schema/user-profile.schema.json` directly in the meantime and rewired once B0 lands.

## What this is

The questionnaire that turns a user into a structured `UserProfile`. Wording is already drafted — don't re-derive it, use `data/questionnaire.md` as the literal source of copy, which maps 1:1 to fields in `data/schema/user-profile.schema.json` (see each field's `questionnaireText`).

## Ordering (already decided, keep it)

Easy demographic questions first, goals in the middle, sensitive/safety questions last so the user is warmed up before being asked about medications. The 13 questions in `data/questionnaire.md`, in order:

1. Age (18+)
2. Sex (+ conditional: pregnant/breastfeeding if female)
3. Diet pattern (omnivore/vegetarian/eggetarian/vegan/pescatarian/other)
4. Exercise days/week (0-14)
5. Exercise type (multi-select)
6. Primary goal(s) — pick up to 3
7. Sleep hours/night
8. Current supplements (free text — AI-parsed into normalized list)
9. Protein-from-food adequacy (yes/no/not sure, with helper text)
10. Oily fish servings/week (0-21)
11. Allergies/intolerances (free text)
12. Other relevant health/lifestyle info (optional, free text)
13. Medications/conditions (yes/no + free text if yes — used only for escalation, never diagnosis, never stored beyond that use)

Framing copy to show before Q1 is in `questionnaire.md` — use verbatim, it's already tuned to set the right expectation ("we'll tell you plainly when nothing is needed").

**Two fields not yet in the questionnaire doc that must be added** per `data-layer-decisions-v2.md`: **`bodyWeightKg`** (required — protein/creatine dosing is weight-scaled, nothing computes without it) and **`monthlyBudgetINR`** (used only by the budget allocator downstream, never by eligibility/dosing — keep that separation visible even in how you frame the question, e.g. don't position it as "tell us your goals and budget" together). Fit these in wherever makes sense in the flow (weight probably belongs near the demographic questions; budget near the end, adjacent to goals).

## AI's role here (and only here)

Per the core architecture principle: the AI parses free-text answers (Q8 current supplements, Q11 allergies, Q13 medications) into the structured enum/array fields the engine needs. **It does not decide anything and does not see the recommendation logic.** Free-text fields are intentionally short-answer, not conversational — keep the parsing step simple (normalize into a list), don't build a chat-style back-and-forth for this.

## Explicit non-goals (already decided, don't add these)

- No diagnostic/symptom-checker questions beyond the single yes/no + free-text medications flag.
- No blood-test/lab-value inputs (relevant to Vitamin D/B12/iron-type items) — those ingredients are simply out of the current auto-recommend path.

## What to build

1. The form/flow itself (multi-step or single scroll, team's call) in `app/`, following the ordering above.
2. Client-side validation matching `data/schema/user-profile.schema.json` constraints.
3. Free-text → structured parsing for Q8/Q11/Q13 (small LLM call, or reuse whatever parsing utility already exists in the myAI6 base).
4. On submit: call Package C's "create/update profile" API (writes a new `profile_versions` row — if C isn't ready yet, stub this behind an interface so it's a one-line swap later).
5. Wire the two added fields (bodyWeightKg, monthlyBudgetINR) into the schema/UI.

## File overlap warning

You and Package E both touch `app/` and `components/`, but in different routes (intake vs. results) — stick to your own route/subtree to keep merge conflicts low.

## Deliverable / done-when

A user can complete the full questionnaire and produce a `UserProfile` object matching B0's published type, submitted to Package C's API. Test with the 5 sample profiles in `data/tools/samples/*.json` as known-good inputs to sanity-check your form produces equivalent structured output.
