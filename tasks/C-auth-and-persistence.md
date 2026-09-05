# Package C — Persistence, No Login — DONE (2026-09-06)

**Status: built and verified against a live database.** See
`docs/status/c-auth-persistence-status.md` for the full account — this
file is kept as the historical brief plus a summary of what actually
shipped, in case anything here needs revisiting.

## Scope change from the original plan

The original version of this brief called for Auth.js (NextAuth) with
email magic-link sign-in. That was built, then **removed**: a
class-submission constraint means the app cannot ask the user to log in.
Everything else below — profile versioning, decision records, the
reproducibility guarantees — is unchanged; only the identity mechanism is
different.

## What actually exists now

- **Identity**: `lib/anon-session.ts` — no login, no email. A random
  `users` row is minted and its id stored in a long-lived httpOnly cookie
  the first time a browser calls `/api/profile` or `/api/decisions`. Every
  later request from that browser reuses it. Not a verified identity —
  fine for a class project, would need real auth again before this handles
  anything sensitive or must survive a device switch.
- **Database**: Postgres via Neon (provisioned through Vercel's Storage
  integration). `data/db/schema.sql` — three tables: `users` (just `id` +
  `created_at` now), `profile_versions`, `decision_records`, exactly as
  originally designed.
- **API routes**: `app/api/profile/route.ts` (GET current version, POST new
  version — always inserts, never updates in place) and
  `app/api/decisions/route.ts` (GET history, POST re-runs
  `generateRecommendations()` server-side against a profile version and
  persists the result — never trusts a client-supplied result).
- **Guard rail**: a decision record can never point at another identity's
  profile version — enforced atomically in `lib/decisions.ts`.

Verified end-to-end against the live database: first visit -> cookie
issued, no profile; profile submitted -> new `profile_versions` row; same
cookie -> sees that same version; decision triggered -> engine runs for
real, record persisted; a second, cookie-less session sees nothing (identity
isolation confirmed).

## For whoever builds D/E/G against this

No auth step to wire up at all. Call `/api/profile` and `/api/decisions`
with same-origin defaults (cookies ride along automatically) — no session
check, no login redirect, nothing to handle if "not authenticated."

- `POST /api/profile` (body: a `UserProfile`) -> new `profile_versions` row.
- `GET /api/profile` -> current version, or `{ profileVersion: null }` for
  a first-time visitor.
- `POST /api/decisions` (body: `{ profileVersionId }`) -> runs the engine,
  persists, returns the decision record.
- `GET /api/decisions` -> this browser's history, newest first.

---

## Original brief (superseded, kept for context)

**Auth.js (NextAuth), email magic link only** was the original plan — no
Google OAuth, no password, chosen for being Next.js/Vercel-native, no
per-message cost, low build effort. This is what got replaced by the
anonymous-cookie approach above once the no-login constraint came in; the
database design itself (Postgres, the three tables, snapshot-per-edit
versioning, immutable decision records) was never in question and is
unchanged.
