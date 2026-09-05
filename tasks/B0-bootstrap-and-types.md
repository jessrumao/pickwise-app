# Package B0 — Bootstrap the App + Publish Shared TypeScript Contracts

**Owner:** Sanket. **Run this first, before fanning out the other repo packages.** Target: ~half a day. Everything else that touches app code (B, D, E, G) either needs this done or needs to sync with it once it lands.

## Why this is first

Right now this repo has `data/` (the v3 data layer, fully built) plus three docs. There is **no Next.js app in this repo yet** — the root `README.md` is still the unmodified `myAI6` template's own README, describing what the app will look like once forked in, not what's actually here. Nothing else in this build plan can run in the actual codebase until this exists.

Separately, `data/tools/predicate.mjs` and `data/tools/demo.mjs` are the *reference implementation* in plain JS — they prove the logic works but nothing downstream (UI, engine) has typed contracts to build against yet. Publishing those types is the second half of this package and is the one dependency the rest of the plan has.

## Part 1 — Fork the app

1. Clone `myAI6` (https://github.com/dringel/myAI6) — either into this repo's root or as the base for a new repo, whichever the team prefers for the class submission. `npm install`, confirm `npm run dev` boots the stock template locally.
2. Strip what doesn't apply to this product (per `mvp-plan.md` §4):
   - `fetchOwnerProfiles` and the live-owner-profile-fetch tool.
   - The confidentiality-about-tech-stack prompt rules (not relevant here).
   - The multi-conversation sidebar is *probably* unnecessary for a single recommendation flow — harmless to leave if removing it costs time, but don't build anything new on top of it.
3. Keep as-is (don't rewrite, just repurpose later in Packages F and elsewhere):
   - Next.js scaffold, streaming API pattern.
   - Pinecone 3-namespace retrieval (`lib/pinecone.ts`) — will be repurposed in Package F to hold ingredient evidence instead of "owner" content.
   - Citation verification / Sources box (`components/messages/sources.tsx`, `lib/citations.ts`) — reusable as-is for showing evidence with checkmarks.
   - Moderation, rate limiting (`middleware.ts`), env-var config pattern (`lib/env.ts`, `env.template`).
4. `config.ts` and `prompts.ts` will need rewriting for the nutrition/supplement domain (replacing the "personal chatbot about an owner" framing) — that rewrite belongs to whichever package first needs working prompts (likely D or G), not this one; just leave clear TODOs.

## Part 2 — Publish the shared types

Source of truth for the shapes: `data/schema/*.json` (JSON Schema — the contracts, with reasoning in the field descriptions) and the runtime behavior in `data/tools/predicate.mjs` + `data/tools/demo.mjs`.

Publish (as `types/` or `lib/engine/types.ts`, team's naming convention):

- **`UserProfile`** — from `data/schema/user-profile.schema.json`. Note `bodyWeightKg` and `monthlyBudgetINR` are both required-ish fields per `data-layer-decisions-v2.md` (weight because protein/creatine dosing is weight-scaled and nothing computes without it; budget because the allocator needs it, though it must never reach eligibility/dosing logic).
- **`Recommendation`** — the per-compound output: status (Recommended / Escalate / Not needed / etc. — check current naming in `demo.mjs` output), evidence grade, dosing target, and the clause trace that produced it.
- **`ServingPlan`** — output of the rounding logic: target amount, chosen product, scoops/units, with the `splittable` flag semantics (nearest-half rounding, non-splittable falls back to whole units — see `data-layer-decisions-v2.md`'s rounding policy section for the exact worked example: 40g ÷ 24g/scoop = 1.667 → 1.5 scoops).
- **`BudgetOutcome`** — funded / deferred basket after the allocator runs, price-blind priority order preserved, each deferred item still carrying its price.
- **`Trace`** — the clause-by-clause evaluation trace from the three-valued (Kleene) predicate evaluator. This is what the LLM is allowed to phrase explanations from — it must never be allowed to invent an explanation not grounded in this.

Also publish the **predicate AST type** itself (`data/schema/predicate.schema.json`) since Package B will need to evaluate it, and the **policy record type** (`data/schema/policy.schema.json`).

## Deliverable / done-when

- App boots locally with the myAI6 owner-specific pieces removed.
- `types/` (or equivalent) compiles and is imported by nothing yet, but is ready to import.
- A short note back to the team (Slack/PR description) saying types are published, so B, D, E, G can start integrating for real instead of building against mocks.

## Out of scope

Don't implement any engine logic here (that's Package B) and don't build any UI (Packages D/E). This package is scaffolding + contracts only — the smaller and faster this lands, the sooner everything else can parallelize for real.
