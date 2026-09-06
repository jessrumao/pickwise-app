# Package G — Routine Builder — done (2026-09-06)

Status note for the team / future sessions picking up H. Follows
`tasks/G-routine-builder.md`. Builds on `lib/engine`'s `RecommendationDosing.timing`
(already flowing through from Package B — no new plumbing needed there) and
attaches to `components/results/recommendation-card.tsx` (Package E).

## What exists now

```
app/api/routine/route.ts              <- the LLM call, non-streaming (see below)
lib/routine/build-routine-prompt.ts   <- THE FENCE — pure, unit-testable prompt builder
lib/routine/routine-api.ts            <- client fetch helper
lib/routine/__tests__/build-routine-prompt.test.ts
components/results/routine-section.tsx <- lazy per-card "Show my routine" UI
```

## The one place an LLM writes free text, and why it's safe

Per `data-layer-decisions-v2.md`, there are three distinct things: amount
(Package B, policy × bodyweight), serving plan (Package B, arithmetic +
rounding), and routine — fitting that into someone's day. This package is
only the third. `types/engine.ts`'s `DosingTiming` type is commented "THE
FENCE" for exactly this reason: `lib/routine/build-routine-prompt.ts` turns
a dosing policy's declared `constraint` (`any` / `with_food` /
`empty_stomach` / `post_exercise_2h` / `evening` / `morning`) and
`separateFromCompoundIds`/`separationHours` into hard, explicit rules in the
system prompt, and explicitly instructs the model **not** to improvise a
specific time when the constraint is `any` — several real dosing policies
(`dose-creatine-maintenance.json`, `dose-caffeine.json`) carry notes
documenting this exact gym-folklore trap on purpose, specifically so the
routine builder doesn't fall into it. The `note` field is passed as
"context only, not a new rule" — never elevated to an instruction the model
could treat as license to add specificity.

Tested against the **real dosing policies** in `data/` (not hand-built
fixtures) — a policy author changing a constraint is exactly what would
break `lib/routine/__tests__/build-routine-prompt.test.ts` if the fencing
logic ever drifted from what the data actually declares.

## Verified against the real model, not just the prompt-builder's own logic

The prompt-builder is deterministic and unit-tested; the LLM's actual output
isn't (it's prose), so that part was verified by hand against the live
Anthropic API rather than asserted in vitest:

- **`any` constraint (creatine)**: *"Take 5g of creatine monohydrate once
  daily at a time that's easy to remember and stick with."* — no invented
  post-workout timing, exactly the folklore trap the fence exists to avoid.
- **`with_food` (omega-3)**: *"...with a meal that contains some fat, such
  as lunch or dinner with oil, nuts, or fish."*
- **`evening` (magnesium)**: *"Take magnesium in the evening..."*
- **Hypothetical hard separation** (no real policy has one yet — see
  below): given `separateFromCompoundIds: ["calcium"], separationHours: 2`,
  the model correctly stated *"separate it by at least 2 hours from any
  calcium-containing supplements or foods."*

**Manually verified in-browser** end to end: clicking "Show my routine" on
a real recommendation card (protein, from the vegetarian-muscle-gain demo
profile) correctly shows a loading state, then renders *"Take 1.5 servings
(36g) of complete dietary protein once daily at a time that's easy to
remember and stick with"* — matching the card's own computed serving plan
exactly, with no invented timing (protein's constraint is `any`).

## Design choices

- **Non-streaming.** `generateObject` (same one-shot pattern
  `app/api/intake/parse/route.ts` already uses), not `streamText`. The
  output is one short paragraph attached to a card, not a chat turn —
  streaming would add wiring for no real UX gain at this length.
- **Lazy, per-card, opt-in.** A "Show my routine" button, not automatic
  generation for every card on page load. Per the brief ("optional...not
  required for the card to render on its own") and to avoid an LLM call
  nobody asked for on every `/results` view — cost and latency, not just
  taste.
- **Uses the default chat-tier model** (`DEFAULT_VENDOR`/`DEFAULT_MODEL_ID`
  from `config.ts`), not the "utility" model — this is a real product
  feature generating user-facing prose, not a background classification
  task, even though both happen to resolve to the same model today.

## Not done here (intentionally, per G scope)

- **`scheduleContext` (exercise days, sleep hours) is wired into the prompt
  builder and the API but never actually populated from the UI.** Threading
  it through would mean either fetching the full profile alongside a
  decision record (Package C's `/api/decisions` doesn't currently return
  one) or passing it from the demo picker only — asymmetric and not worth
  it for what the brief itself frames as optional flavor context. The
  parameter exists and is tested structurally
  (`build-routine-prompt.test.ts`); wiring a real value in is a natural
  small follow-up once there's a reason to.
- **No real `separateFromCompoundIds` case exists in today's data** — every
  current dosing policy has it empty (see `dose-multivitamin-rda.json`'s own
  note: reserved for when standalone iron enters scope). The fence handles
  it correctly regardless (tested with a hand-built `DosingTiming`, verified
  against the real model), but nothing in the shipped data exercises it yet.

## For whoever picks up H next

`RoutineSection` is fully self-contained inside `RecommendationCard` —
nothing else needs to change to include it in an integration pass. If a
future package wants schedule-aware routines, extend
`RoutineInput.scheduleContext` and pass real values in from wherever the
profile is available at that point; `buildRoutinePrompt` already knows what
to do with it.
