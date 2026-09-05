# Package C — Auth & Persistence

**Owner:** Sanket. **Independent of B0's types** — only needs the app repo to exist (Package B0's Part 1). Can run fully in parallel with B, D, E, F, G once that's true.

## Why this exists

Per `data-layer-decisions-v2.md`: user accounts and persistence are **real and built for the MVP, not faked, not deferred** — the point is a user can create a profile, leave, and come back to find it and their past recommendations still there. This is also what makes the recommendation reproducible: a decision record pins the exact profile version and knowledge-base version that produced it.

## Auth

**Auth.js (NextAuth), email magic link only.** No Google OAuth, no password, for this build — chosen because it's Next.js/Vercel-native (no new vendor beyond the Postgres DB you're setting up below), has no per-message cost (unlike phone OTP), and is low build effort before the deadline. Leave it structured so Google can be added later as an additional provider without rework, but don't build that now.

## Database

**Postgres — Vercel Postgres or Neon** (not git; git can't hold runtime writes from a serverless function, which is why L5 lives here and L0–L4 don't). Schema already drafted: `data/db/schema.sql` in this repo — use it as the starting point, adjust only if you find a concrete reason to.

Three tables, per the settled design:

- **`users`** — identity, managed by Auth.js (id, email, created_at).
- **`profile_versions`** — **one row per edit, never an overwrite.** (id, user_id, created_at, body_weight_kg, goals, diet, medications, monthly_budget_inr, …). "Current profile" = latest row for that `user_id`. This is deliberate: it's what makes a 6-month-old recommendation reproducible instead of silently mutated by a later profile edit. Every profile change — including a weight or budget change — creates a new snapshot.
- **`decision_records`** — (id, user_id, `profile_version_id` FK, created_at, `kb_sha`, `ruleset_sha`, trace jsonb, recommendation jsonb, budget_outcome jsonb, adherence/outcome fields to be appended later — don't build the feedback loop itself, just leave the columns room to grow). `kb_sha`/`ruleset_sha` should be the git SHA of the `data/` directory state at decision time — that's the KB version pin.

## What to build

1. Provision the Postgres instance (Vercel Postgres or Neon — check which the team's Vercel project already has access to).
2. Run/adapt `data/db/schema.sql` as the initial migration.
3. Wire Auth.js with the email-magic-link provider.
4. API routes (or server actions, matching the app's pattern):
   - Create/update profile → writes a new `profile_versions` row (never updates in place).
   - Fetch current profile for a logged-in user → latest `profile_versions` row.
   - Write a decision record → called by whatever wires up the engine (Package B's output) + the profile version used.
   - Fetch a user's past decision records (for "come back and see your history").

## Out of scope

Don't build the profile intake *form* (Package D) or the results UI (Package E) — just the auth flow and the API surface they'll call. Don't implement the adherence/outcome feedback loop itself, just leave room for it in the schema (already true of `data/db/schema.sql` — confirm rather than redesign).

## Deliverable / done-when

A logged-in user can: sign in via magic link, have a `users` row created, submit a profile and see a new `profile_versions` row appear (not an overwrite of the last one), and a decision record can be written and read back tied to the right profile version. Test this with a fake/manual profile payload if Package D/B aren't ready yet — you don't need to wait on them.
