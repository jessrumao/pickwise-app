# Package B0 — done (2026-09-05)

Status note for the team / future sessions picking up Packages B, C, D, E, F, G. Full task brief: `tasks/B0-bootstrap-and-types.md`.

## What exists now

A new `webapp/` folder was created inside `SupplementRecommendationEngine/` (on Sanket's machine, path `.../SupplementRecommendationEngine/webapp/`). It is its own local git repo (`main` branch) and is now the actual place to build the app. The original `data/` and `tasks/` at the project root were **left untouched** as a backup — `webapp/` has its own copies.

```
webapp/
  (myAI6 Next.js scaffold — app/, components/, lib/, config.ts, prompts.ts, middleware.ts, etc.)
  data/            <- copied from the project root, same v3 data layer
  tasks/           <- copied from the project root, same task briefs
  types/engine.ts  <- NEW: shared TS contracts (see below)
  types/__tests__/engine.smoke.test.ts  <- NEW: validates the schemas against real data/
  MVP-Plan.md, "Supplement Recommendation Engine — Core Idea & Discussion Handoff.md"  <- copied
```

## Part 1 — app fork

- Cloned `dringel/myAI6`, then dropped its git history and `git init`'d fresh (so app + data + tasks share one history going forward).
- `npm install` — 815 packages, 0 vulnerabilities.
- `npm run dev` boots and serves `GET /` → 200 (verified twice, before and after the strip-down below).
- Removed per Part 1 step 2:
  - The `fetchOwnerProfiles` tool entirely: deleted `app/api/chat/tools/fetch-owner-profiles.ts`; removed its import/registration/tool-budget guidance from `lib/ai/tools.ts`; removed `OWNER_PROFILE_SOURCES` / `OWNER_PROFILE_MAX_CHARACTERS` / `OWNER_PROFILE_DOMAINS` from `config.ts`; removed the `OWNER_PROFILE_LIST`-dependent "latest info on the owner" prompt section from `prompts.ts`; removed the `OWNER_PROFILE_DOMAINS` reference from `web-search.ts`'s tool description; removed the `fetchOwnerProfiles` entry from `components/messages/tool-call.tsx`'s `TOOL_CONFIG`.
  - The "STRICT CONFIDENTIALITY — NEVER BREAK THESE RULES" block in `prompts.ts` (the never-reveal-the-tech-stack rules) — removed entirely.
- Left as-is, per the brief: Next.js scaffold, streaming API pattern, Pinecone 3-namespace retrieval, citation/Sources box, moderation, rate limiting, env-var config pattern, the multi-conversation sidebar.
- Left clear `TODO(Package D/G)` comments at the top of `config.ts` and `prompts.ts` flagging that the rest of the "personal chatbot about an owner" framing (`AI_NAME`, `OWNER_NAME`, `KB_SCOPE`, `WELCOME_MESSAGE`, the IDENTITY_PROMPT persona, etc.) still needs a full nutrition-domain rewrite — intentionally **not** done in B0, per the brief.
- **Known pre-existing issue, not introduced by B0**: `npx eslint .` reports 76 problems (mostly `no-explicit-any` around the Exa/exa-js integration in `web-search.ts` and a couple of other files, plus one unused-import warning) that were already present in the myAI6 template before any B0 changes. Confirmed by targeted `eslint` runs on only the files B0 touched — the only file B0 added, `types/engine.ts`, has zero lint issues.

## Part 2 — shared types (`webapp/types/engine.ts`)

Follows the existing convention already in the repo (`types/data.ts`): zod schemas + `z.infer` types for anything sourced from `data/schema/*.json`, plain TypeScript types for engine-only output shapes that nothing untrusted flows into.

Published:
- **Predicate AST** (`PredicateNode`, `predicateNodeSchema`) — modelled as a discriminated union per operator (all/any/not/const/eq/neq/lt/lte/gt/gte/in/contains_any/contains_all/contains_none/exists/matches), which enforces "exactly one operator key" at the type level rather than just by convention.
- **`TriState`** (`'true' | 'false' | 'unknown'`) plus `TraceEntry` / `EvaluationResult` — matching `predicate.mjs`'s `evaluate()`/`run()` return shape field-for-field, since Package B's port needs to produce exactly this trace for the LLM explanation layer to stay grounded.
- **`Policy`** — discriminated union on `kind` (`EligibilityPolicy` / `DosingPolicy` / `SafetyPolicy`), from `policy.schema.json`.
- **`UserProfile`** — from `user-profile.schema.json`, all required/optional fields matched exactly (including `_meta`).
- **`Compound`, `Ingredient`, `Claim`, `Product`, `PricingEntry`/`PricingFeed`, `ReviewBlock`** — supporting types the above reference.
- **`ServingPlan`** — field names (`raw`, `increment`, `servings`, `delivered`, `flooredUpToMinEffective`) deliberately match `predicate.mjs`'s `servingPlan()` return value one-to-one, plus context fields (`compoundId`, `productId`, `targetAmount`, `unit`) for downstream consumers.
- **`PriorityScore`** (`gapTier`/`evidenceTier`/`goalAlignment`/`total`) and **`Recommendation`** (status, grade, `why`, `eligibilityTrace`, optional `safetyTrace`/`candidateIngredients`/`dosing`/`servingPlan`/`priorityScore`) and **`BudgetOutcome`** (`funded`/`deferred` `BasketItem[]`, totals) — the three top-level output shapes Packages D, E and G consume.

**Verification**: `tsc --noEmit` clean. Full `vitest run` — 99 tests pass at the time, including a smoke test (`types/__tests__/engine.smoke.test.ts`) that runs every real record in `data/` (all 5 sample profiles, all 19 policies via the discriminated union, all compounds/ingredients/claims/products, the pricing feed, and a hand-built nested predicate) through `.safeParse()` against these schemas — confirms the types aren't just internally consistent but actually match today's data.

## Not done here (intentionally, per B0 scope)

- No engine logic — no predicate evaluator port, no serving-plan/priority-score/budget-allocator implementation. That was Package B, building on these types (now done — see `b-recommendation-engine-status.md`).
- No UI. That's Packages D/E.
- No domain prompt rewrite (`config.ts`/`prompts.ts` still say "myAI6" / "owner" everywhere apart from the two removed blocks) — flagged as TODOs for whichever of D/G needs working prompts first.

## For whoever picks up B, C, D, E, F, G next

`webapp/types/engine.ts` is ready to import (`import { UserProfile, Recommendation, ... } from "@/types/engine"`). Rebase onto it rather than inventing parallel types — Package B's brief specifically calls out that B0 and B both touch `lib/engine/`/`types/`, and B0 landed first as planned.
