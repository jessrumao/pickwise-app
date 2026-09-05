# Package G — Routine Builder

**Owner:** Sanket (or a parallel chat). **Needs B0's types + Package B's serving-plan output shape.** This is the smallest package and the last one that's genuinely blocked on another package's output rather than just types — don't start the actual logic until B's serving plan output is real, though you can scaffold the UI/prompt shell earlier.

## What this is, precisely

Per `data-layer-decisions-v2.md`, there are three distinct things and this package is only the third:
- **Amount** (e.g. 40g protein/day) — computed by policy × body weight. Not yours, that's Package B.
- **Serving plan** (40g ÷ 24g/scoop = 1.5 scoops) — arithmetic + a rounding rule. Not yours, that's Package B.
- **Routine** (fitting that into someone's actual day — "take it with breakfast," "split into two doses," etc.) — **this is the one place in the whole product the LLM is allowed to write free text.**

## The constraint that makes this safe

The LLM's free text must be **fenced by evidence-backed timing constraints declared in L3** (`data/policy/dosing/*.json` — look for fields like `separate_from: calcium` or similar timing/interaction constraints). The LLM can phrase *when and how* to take something within those constraints, but it cannot invent clinically relevant timing advice that isn't backed by a policy field. If a policy has no timing constraint, don't let the LLM improvise one — keep the routine text generic ("take daily, with or without food") rather than inventing specificity.

Concretely: build a prompt/generation step that takes (a) the serving plan output, (b) the profile's stated schedule-relevant context (e.g. exercise timing, wake/sleep hours if useful), and (c) the set of timing constraints from the relevant dosing policies, and produces natural-language routine text that never contradicts (c).

## What to build

1. A routine-generation call (LLM, using whatever provider/pattern the myAI6 base already has wired for streaming responses).
2. Wire in the timing-constraint fields from `data/policy/dosing/*.json` as hard constraints in the prompt — not suggestions.
3. Output should be attachable to a recommendation card (Package E) as an optional "your routine" section, not required for the card to render on its own.

## Deliverable / done-when

Given a serving plan + profile + the relevant dosing policy, produces routine text that respects every timing constraint the policy declares, and never invents a constraint the policy doesn't have.
