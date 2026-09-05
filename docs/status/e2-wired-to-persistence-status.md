# Package E → wired to Package C's real persistence (2026-09-06)

Follow-up to `e-results-basket-ui-status.md`, which is left as-is (historical
record of the original build) rather than rewritten — this note covers what
changed once Package C (`c-auth-persistence-status.md`) landed on `main`
while `package-e` was still an unmerged branch, and the swap that note
explicitly asked whoever merged E to make.

## What changed

- **`lib/results/session-handoff.ts` is gone.** The intake flow no longer
  stashes the full `UserProfile` in `sessionStorage` for `/results` to pick
  back up — Package C's `POST /api/profile` already returns a real
  `profileVersionId`, so that's what gets handed off instead.
- **`intake-flow.tsx`'s "See your recommendations" link** now goes to
  `/results?profileVersionId=<id>` instead of a bare `/results`.
- **`/results` fetches real recommendations** via a new
  `lib/results/decisions-api.ts` (`createDecision(profileVersionId)` →
  `POST /api/decisions`) when a `profileVersionId` is in the URL, instead of
  calling `generateRecommendations()` client-side. The demo-profile picker
  (still there for testing without a real submission) is unchanged — it
  still calls `generateRecommendations()` directly, since those are
  synthetic fixtures, not real submitted profiles.
- **`lib/results/decision-record-adapter.ts`** reshapes Package C's stored
  `DecisionRecordPayload` (`{trace: {safety, ...}, recommendation,
  budgetOutcome, escalations}`) back into the `RecommendationResult` shape
  (`{globalEscalation?, safety, recommendations, budget?}`) the rest of
  Package E already renders — a `RecommendationResult`, wherever it came
  from, is now the one shape `ResultsView` deals with.
- **`ResultsView`'s prop changed** from `profile: UserProfile` (it used to
  compute the result itself) to `result: RecommendationResult` — it's now
  purely presentational; the caller (the page) decides whether that result
  was just computed or fetched back from the database.

## A real bug found while wiring this up, not a pre-existing one

`RecommendationCard` used to match a `Recommendation`'s `safetyTrace` back
to its `SafetyEscalation` (for the escalate card's real safety-policy
message) via `escalations.find(e => e.trace === rec.safetyTrace)` —
**reference** equality. That only ever worked because
`generateRecommendations()` keeps everything as the same in-memory objects
within one call. Once a result is persisted to Postgres `jsonb` and fetched
back as fresh JSON (exactly what the real flow now does), `JSON.parse`
always builds new objects — the values are identical, the references
aren't — so the lookup would have silently failed and every escalate card
would've shown the generic fallback message instead of the real
per-policy one.

Fixed in a new `lib/results/trace-match.ts` (`findMatchingEscalation`),
which compares by value with object keys canonicalized (sorted) first —
`jsonb` doesn't preserve key order either, so a plain `JSON.stringify`
string comparison wasn't safe on its own. `RecommendationCard` and
`ResultsView` now use this everywhere, not just for the persisted path, so
there's one code path instead of two. Regression test
(`lib/results/__tests__/trace-match.test.ts`) explicitly round-trips a real
`RecommendationResult` through `JSON.parse(JSON.stringify(...))` — the exact
failure mode — before asserting the match still works.

## Verification

`tsc --noEmit` clean. `eslint` — 0 errors (the one known `set-state-in-effect`
warning from the previous version of `/results` is actually **gone** now:
the new effect calls `setState` inside an async `.then()`/`.catch()`, not
synchronously in the effect body, which the rule doesn't flag).

Full `vitest run`: **147 tests pass** (140 prior + 3 new for
`trace-match.ts` + 1 new for `decision-record-adapter.ts`, the latter
against a **real captured response** from `POST /api/decisions`, not a
hand-built fixture — see `lib/results/__tests__/fixtures/
real-decision-response.json`).

**Manually verified against the live Neon database** (not mocked), via curl
with a real cookie jar, reproducing every check from Package C's own status
note:
1. `GET /api/profile` with no cookie → `{"profileVersion":null}`, cookie issued.
2. `POST /api/profile` with a real profile → `201`, real UUID.
3. `POST /api/decisions` with that id → `201`, the engine ran for real and
   the persisted shape matched what `adaptDecisionRecord()` expects exactly
   (captured as the fixture above).
4. `GET /api/profile` / `GET /api/decisions` (same cookie) → the same
   profile version and decision history come back.
5. **Isolation check**: a fresh cookie jar sees `profileVersion: null` —
   confirmed two anonymous identities don't see each other's data.

Rebased `package-e` onto `main` (which now includes Package C) rather than
merging, to keep history linear — one conflict, in `docs/status/00-README.md`
(both branches added a new numbered entry), resolved by combining both.

**Not independently re-verified in a live browser** this pass — the browser
tool was unavailable in this session when this work was done. Verified
instead at the level that actually mattered for this change (the real
HTTP/DB round trip and the exact JSON shape crossing that boundary), which
is a strictly stronger check for a persistence-integration change than a
visual click-through would have been on its own. Worth a quick visual pass
before considering this fully closed.

## Known limitation carried over, not fixed here

`SafetyGateResult.blockedCompoundIds`/`blockedIngredientIds` are typed as
`Set<...>` in `types/engine.ts`, but `Set` doesn't survive
`JSON.stringify` — they come back as `{}` after the Postgres round trip (see
the real fixture: both fields are literally `{}`). Nothing in Package E
currently reads these fields from an adapted result (only
`safety.escalations`, which round-trips fine as a plain array), so this
isn't an active bug — but anyone adding UI that calls
`.has(...)` on a decision-record-derived `result.safety.blockedCompoundIds`
will get a runtime error. Flagging for whoever touches this next (H,
probably) rather than fixing preemptively for a code path that doesn't
exist yet.

## For whoever picks up F, G, H next

`lib/results/decisions-api.ts` and `decision-record-adapter.ts` are the
pair to reuse if anything else needs a `RecommendationResult` for an
already-submitted profile — don't re-derive the `/api/decisions` call or
the reshaping elsewhere. A "returning visitor" page (load `GET
/api/profile`/`GET /api/decisions` with no query param, per Package C's own
suggestion) would be a natural small addition on top of this, not done here
since it wasn't part of the ask.
