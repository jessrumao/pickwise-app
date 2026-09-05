# Package C — Persistence, No Login — built and DB-verified (2026-09-06)

Status note for the team / future sessions picking up D, E, F, G, H. Follows
`tasks/C-auth-and-persistence.md`, **with one scope change applied on top**:
per a class-submission constraint, the app cannot ask the user to log in.
Everything else from the original brief — profile versioning, decision
records, reproducibility — is intact; only the identity mechanism changed.
An earlier version of this package used Auth.js (email magic link) for real
login; that was built, then removed in favor of the approach below once the
no-login constraint came in. If real login needs to come back later, see
"if login comes back" at the bottom rather than re-deriving this from
scratch.

## What exists now

```
lib/db.ts                 <- pg Pool singleton, cached on globalThis, lazy
lib/anon-session.ts        <- cookie-based anonymous identity (replaces Auth.js -- see below)
lib/profile-mapping.ts     <- pure UserProfile <-> profile_versions row mapping (unit tested)
lib/profile.ts             <- createProfileVersion (always INSERT, never UPDATE), getCurrentProfileVersion, getProfileVersionById
lib/decision-mapping.ts    <- pure RecommendationResult -> {trace, recommendation, budgetOutcome, escalations} shaping (unit tested)
lib/decisions.ts           <- createDecisionRecord, getDecisionRecords
lib/build-info.ts          <- kb_sha/ruleset_sha pin (VERCEL_GIT_COMMIT_SHA) + ENGINE_VERSION
app/api/profile/route.ts   <- GET current profile, POST new profile version
app/api/decisions/route.ts <- GET list, POST re-runs generateRecommendations() server-side and persists
data/db/schema.sql         <- three tables: users (just id + created_at now), profile_versions, decision_records
lib/__tests__/profile-mapping.test.ts, decision-mapping.test.ts  <- pure round-trip tests, no DB needed
```

## No login: how identity works instead

`lib/anon-session.ts` mints a random `users` row and stores its id in a
long-lived (1 year) httpOnly cookie (`pw_uid`) the first time a browser hits
`/api/profile` or `/api/decisions` with no cookie yet. Every later request
from that browser reuses the same id — so "come back and see your profile
and past recommendations" still works, without any sign-in screen, email,
or verification step.

**This is not a verified identity.** Anyone holding the cookie value can act
as that "user" — there's no password or email tying it to a real person.
That's an acceptable trade-off for a class project with no sensitive PII
beyond a supplement profile. It does NOT survive a cleared-cookies browser
or a switch to a different device — if that matters later, real
authentication needs to come back (see below).

`data/db/schema.sql`'s `users` table is now just `id` + `created_at` — no
`email`, no Auth.js adapter tables (`accounts`/`sessions`/`verification_token`
are gone entirely). `profile_versions` and `decision_records` are
**unchanged** from the original design — same columns, same
"always-insert-never-update" versioning, same `decision_profile_same_user`
guard rail (still enforced the same way, in `lib/decisions.ts`, via an
atomic `insert ... where exists (...)` check against the anonymous
`user_id` instead of an authenticated one).

`POST /api/decisions` still re-runs the engine server-side from only a
`{ profileVersionId }` body — never trusts a client-supplied
`RecommendationResult` — same reasoning as before: the recommendation must
come from the exact pipeline, never something a client could hand-edit.

## What's verified — this time against the real, live database

Unlike the Auth.js version of this package (verified only by type-check/
lint/tests/build, since it needed a live Postgres + real email that hadn't
been provisioned yet), this version has an actual Neon Postgres instance
provisioned via Vercel's Storage integration, with `data/db/schema.sql`
applied to it, and a real end-to-end pass run against it:

1. `GET /api/profile` with no cookie -> `{"profileVersion": null}`, `Set-Cookie: pw_uid=...` issued.
2. `POST /api/profile` with a sample profile (same cookie) -> `201`, new `profile_versions` row.
3. `GET /api/profile` again (same cookie) -> returns that exact same profile version, confirming the cookie identity persists across requests.
4. `POST /api/decisions` with that `profileVersionId` -> `201`, engine ran for real, 6 recommendations produced and persisted as a `decision_records` row.
5. `GET /api/decisions` (same cookie) -> lists that 1 record back.
6. **Isolation check**: a fresh session with no cookie at all sees `profileVersion: null` and an empty decision list — confirms two different anonymous identities don't see each other's data.

Also (same bar as before): `npx tsc --noEmit` clean, `eslint` clean on every file this package touches, full `vitest run` at **133/133** (122 pre-Package-C + 7 Package D + 4 Package C — see "landed alongside Package D" below for why that number, not 126), and the schema migration itself was applied safely (a small migration script checked every table was empty before dropping the old Auth.js tables and re-applying the simplified schema — nothing destructive happened to real data because there wasn't any yet).

Test data from the smoke-test pass above was truncated afterward, so the database starts empty for whoever uses it next.

## Landed alongside Package D — replaced its stub, kept its contract

Package D pushed directly to `main` (`e723b64`) while this package was being
built on a different device, including a stub `app/api/profile/route.ts`
("Package C should replace this handler's body... the client contract
should not need to change"). That stub's response shape —
`{ profileVersionId: string }`, destructured exactly that way in
`lib/intake/submit-profile.ts` and displayed in `intake-flow.tsx`'s
"done" screen — is honored verbatim: the real implementation returns
`{ profileVersionId: stored.id, profileVersion: stored }`, a strict
superset, so nothing in Package D's already-tested code needed to change.
Verified by starting the app and running Package D's actual intake flow
against the real endpoint (not just checking the two contracts on paper) —
confirmed `profileVersionId` comes back as a real database uuid and
`/intake` still renders.

**Package E, on a separate `package-e` branch not yet merged to `main` as of
this note, does not call this API at all yet.** Per its own status note
(`e-results-basket-ui-status.md` on that branch), it hands the profile from
intake to results via `sessionStorage`
(`lib/results/session-handoff.ts`) and calls `generateRecommendations()`
directly in the browser, specifically because Package C hadn't landed when
it was built. That note already flags the fix: replace
`saveProfileForResults`/`loadProfileForResults` with a fetch of the stored
profile by `profileVersionId` (available from `intake-flow.tsx`'s submit
result) and a call to `POST /api/decisions`. Whoever merges `package-e` —
or Package H — should do that swap; it wasn't done from here since
`package-e` is someone else's active branch, not this session's to modify.

## Dependencies removed

`next-auth`, `@auth/pg-adapter`, `nodemailer` (and its accompanying npm
`overrides` entry, which existed only to patch a nodemailer vulnerability
that no longer applies since nodemailer isn't a dependency at all now) are
gone. `pg`/`@types/pg` remain — still needed for the raw Postgres access in
`lib/db.ts`.

## Environment variables

Only `DATABASE_URL` (and optionally `DATABASE_SSL=false` for an untypical
local Postgres without TLS) — see `env.template`. Nothing else from the
Auth.js version (`AUTH_SECRET`, `AUTH_TRUST_HOST`, `EMAIL_*`) is needed
anymore.

## If login comes back later

This was a deliberate, documented pivot (`data-layer-decisions-v2.md`'s
"Auth method: Auth.js... email magic link" entry is now superseded by this
note — that file itself wasn't edited, per this repo's "add a new dated
note rather than editing history out" convention). If real authentication
is needed again:

- Re-add whichever identity provider (Auth.js or otherwise), its required
  `users` columns, and its own session/verification tables.
- The cleanest migration path is probably: keep the anonymous `pw_uid`
  cookie working as a fallback/guest mode, and add a real sign-in that,
  once completed, re-points existing `profile_versions`/`decision_records`
  rows at the newly-authenticated `user_id` (a one-time claim/merge step) —
  rather than losing a guest's history the moment they sign in for the
  first time.

## For whoever picks up D, E, F, G, H next

- No client-side auth call needed at all — just call `/api/profile` and
  `/api/decisions` with `credentials: "include"` (or same-origin defaults,
  which already send cookies) so the browser's `pw_uid` cookie rides along
  automatically. Nothing to check for a session/logged-in state.
- `POST /api/profile` (body: a `UserProfile`, i.e. `types/engine.ts`'s
  shape) -> new `profile_versions` row. `GET /api/profile` -> current
  (latest) version or `{ profileVersion: null }` for a first-time visitor.
- `POST /api/decisions` (body: `{ profileVersionId }`) -> runs the engine
  and persists; `GET /api/decisions` -> this browser's history, newest
  first.
- Package D calls `POST /api/profile` when the intake form submits; Package
  E (or G) calls `POST /api/decisions` once it has a `profileVersionId` to
  show results for.
