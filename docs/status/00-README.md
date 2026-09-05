# Status notes

This folder mirrors the working decisions and package status notes that were
tracked in the team's Claude project (claude.ai) during the build, so they
travel with the repo itself rather than living only in one chat tool. If
you're picking this project up in a fresh session (Claude Code, a different
chat, a teammate), start here before touching `lib/engine/` or `data/`.

Read in this order:

1. `data-layer-decisions-v2.md` — the architecture decisions (six-layer data
   stack, compound-vs-ingredient, the "retrieval never reaches the decision"
   rule, priority formula, budget allocator design, auth/persistence shape).
2. `data-layer-build-status.md` — what actually exists in `data/` today, the
   ten work packages under `tasks/` and who owns each, known data gaps.
3. `b0-bootstrap-status.md` — how this `webapp/` was forked from myAI6 and
   what `types/engine.ts` publishes.
4. `b-recommendation-engine-status.md` — the `lib/engine/` port: pipeline,
   test coverage, one deliberate extension beyond `data/tools/demo.mjs`
   (targeted safety escalation via ingredient substitution), and known
   issues flagged for Package A (the domain expert).
5. `d-profile-intake-ui-status.md` — the `/intake` questionnaire UI: the
   17-step flow, the AI free-text normalization step (and only that step),
   and a known gap (no real `ANTHROPIC_API_KEY` configured yet in this dev
   environment). Its stub `/api/profile` has since been replaced by
   Package C — see the next entry.
6. `c-auth-persistence-status.md` — Postgres API surface (`/api/profile`,
   `/api/decisions`), profile versioning, and decision records. **No login**
   — a class-submission constraint superseded the original Auth.js plan;
   identity is now an anonymous cookie (`lib/anon-session.ts`), not an
   authenticated account. Verified end-to-end against a live Neon database.

These are snapshots as of the date in each file's title, not living
documents — if you make a decision that supersedes one, add a new dated
note rather than editing history out.
