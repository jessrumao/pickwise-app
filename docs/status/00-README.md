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
7. `e-results-basket-ui-status.md` — the `/results` page: recommendation
   cards for all 5 visible statuses, the funded/deferred basket, and three
   real bugs in Package D's `assemble-profile.ts` found and fixed while
   integrating (most severe: every non-female intake submission was hitting
   a global pregnancy-escalation false positive). Originally handed off
   from intake via `sessionStorage` since Package C hadn't landed yet — see
   the next entry for the swap to the real `/api/decisions` once it did.
8. `e2-wired-to-persistence-status.md` — the swap of the item above onto
   Package C's real `/api/profile`/`/api/decisions`, plus a real bug found
   while doing it: matching a recommendation to its safety escalation by
   object reference silently breaks once data round-trips through Postgres
   `jsonb`. Verified against the live database directly (curl + a real
   cookie jar), reproducing every check from Package C's own note.
9. `g-routine-builder-status.md` — the one place an LLM writes free text in
   this product, and why it's safe: routine timing is fenced by each dosing
   policy's own declared `DosingTiming` constraint, tested against the real
   policies in `data/`, and verified against the live model not to invent
   timing folklore (e.g. a post-workout rule for creatine) that the
   evidence doesn't support.
10. `i-regulatory-writeup-status.md` — the in-product disclaimer (now real
    copy, not Package E's placeholder) and the regulatory/deferral writeup
    (`docs/regulatory-and-deferral-writeup.md`): sourced FSSAI/DPDPA
    research, and a 4-tier-safety-model calibration section grounded in
    which former "Yellow" ingredients already have real policies today vs.
    which "Red" compounds exist only as entities with no policy yet.

These are snapshots as of the date in each file's title, not living
documents — if you make a decision that supersedes one, add a new dated
note rather than editing history out.
