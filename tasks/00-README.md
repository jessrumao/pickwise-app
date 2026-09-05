# Work Packages — Index

This folder breaks the remaining build (post data-layer-v3) into independent task briefs. Each `*.md` file is self-contained: paste its whole content as the opening prompt in a fresh chat (Claude or otherwise), or hand it to a teammate, and they'll have everything needed to start without any other context from this conversation.

Source of truth these were derived from: `data-layer-decisions-v2.md`, `data-layer-build-status.md`, and `mvp-plan.md` (Claude project docs), plus this repo's `data/README.md`, `MVP-Plan.md`, `data/questionnaire.md`, and the handoff doc.

## Current state (as of 2026-09-05)

The `data/` layer (schema, entities, ingredients, claims, policy, products, db schema, validator, demo) is built and passing `validate.mjs`/`demo.mjs` — see `data-layer-build-status.md`. Nothing else exists yet: there is no Next.js app in this repo. `README.md` at the repo root is still the unmodified myAI6 template README, describing what the app *will* look like once it's forked in. So the first repo task (B0) is literally standing up the app.

## Who does what

- **Domain expert (friend)** — Package **A** only. No repo checkout needed; works from the JSON files (viewable on GitHub) or a spreadsheet export. Everything else needs the codebase.
- **Sanket** — everything else (B0, B, C, D, E, F, G, H, I). Split across parallel chats per the dependency graph below.

## Dependency graph

```
A  (domain data)              ─── independent, run anytime, no repo needed
I  (regulatory & writeup)     ─── independent, run anytime, low code

B0 (bootstrap app + types)    ─── START FIRST. ~half day. Blocks D, E, G's real integration
  │                                (they can start against mocked types, but should sync
  │                                once B0 lands).
  ├── C (persistence, no login) ─ DONE. independent of B0's *types*, just needs the app repo to exist
  ├── F (Pinecone ingestion)  ─── independent of B0's *types*, just needs the app repo to exist
  ├── B (recommendation       ─── logic can be ported from data/tools/predicate.mjs immediately;
  │      engine)                  needs B0's types to compile against by the end
  ├── D (profile intake UI)   ─── needs B0 types + data/questionnaire.md
  ├── E (results/basket UI)   ─── needs B0 types; can build against data/tools/samples/*.json
  │                                + demo.mjs output shape while B is in progress
  └── G (routine builder)     ─── needs B0 types + B's serving-plan output shape

H (integration & testing)     ─── LAST. Needs B, C, D, E, F, G all merged.
```

So realistically: run **A**, **I**, and **B0** first (three parallel chats, none conflict). The moment B0 lands, fan out **B, C, D, E, F, G** as five more parallel chats. **H** is the final sequential pass.

## File-overlap warnings

Flagged inside each task file, but the short version: **B0 and B both touch `lib/engine/` and `types/`** — B0 should land first and B should rebase onto it rather than the two running truly concurrently. **D and E both touch `app/` and `components/`** but in different subtrees (intake route vs. results route) — low conflict risk if they stick to their own routes. Everyone reads `data/` but only **A** should write to it.
