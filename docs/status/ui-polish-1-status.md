# UI polish pass 1 — landing page, condensed intake, real review screen (2026-09-06)

Status note for the team / future sessions. Cross-cutting UX work spanning
the app root, `/intake` (Package D), and no `/results` (Package E) changes
in this pass — direct product feedback after using the deployed app, not
tied to a single lettered package.

## What changed

**1. Landing page.** `/` used to be the unmodified myAI6 chat scaffold — the
first thing anyone saw was a generic AI chatbot, not the supplement
product. The chat now lives at `/chat` (moved verbatim, no logic changed —
it had no relative imports, so the move was mechanical) and `/` is a real
Pickwise landing page: name, one-line pitch, a 3-step "how it works", and a
CTA straight to `/intake`. `config.ts`'s `BROWSER_TAB_TITLE` is now
`"Pickwise"` (decoupled from `AI_NAME`, which the file's own comment already
flagged as safe to change freely) — the chat's internal persona (`AI_NAME`,
`WELCOME_MESSAGE`, `OWNER_NAME`) is untouched, since that's a separate,
already-flagged-elsewhere domain rewrite this pass didn't attempt.
`/chat` isn't linked from the new landing page or navigation anywhere —
reachable only by direct URL. It's leftover scaffold that hasn't been
repurposed for the supplement domain (still says "myAI6"/references an
"owner" internally), so surfacing it prominently would be confusing more
than useful right now.

**2. Intake condensed from 17 one-question screens to 8** (intro + 6 themed
screens + review): About you, Diet & activity, Goals & budget, Sleep &
current supplements, Diet gaps, Allergies & safety. Optional questions sit
on the same screen as the required question(s) they're related to, rather
than each getting a screen of its own — `lib/intake/schema.ts`'s
`STEP_FIELDS` is the single source of truth for the grouping, validated per
screen exactly as before. **`heightCm` is now required** in the intake form
(it stays optional in `UserProfile`/`user-profile.schema.json` itself — no
MVP rule reads it yet, this is a product decision to collect it up front
rather than an engine requirement).

**3. The post-submit JSON dump is gone**, replaced by two things:
- A real **review screen** before submission: every answer shown in plain
  language, grouped into the same 6 sections, each with an **Edit** button
  that jumps straight to that screen. Editing and clicking "Save & back to
  review" returns directly to the review screen (skipping past the
  intervening screens) rather than requiring a full walk back through
  Next/Next/Next.
- A plain success message after submission ("You&apos;re all set... See
  your recommendations") instead of a `JSON.stringify`'d profile — the
  recommendations themselves are one click away on `/results`, so nothing
  is lost by not re-echoing the raw object.

## What was deliberately NOT done (per explicit scope agreement)

**Live/refreshed product pricing was discussed and explicitly deferred.**
Scraping Amazon/HealthKart at request time is blocked by anti-bot measures
in practice, a background-refresh alternative still needs either a fragile
self-hosted headless-browser scraper or a paid third-party scraping API,
and neither is worth the cost/fragility for this project right now — prices
stay static, exactly as `pricing.json`'s existing `priceIsIndicative` flag
already anticipated. Not implemented, not even the smaller "prices as of
`<date>`" label — out of scope for this pass by the user's own explicit
"go ahead with 1-3" decision, not an oversight.

## Verification

`tsc --noEmit` clean. `eslint` on every file this pass touched — 0 new
errors (the only errors reported are the pre-existing ones already present
in the original `app/page.tsx` before it was copied to `app/chat/page.tsx`
verbatim — see `b0-bootstrap-status.md`'s own note on this; moving the file
didn't add or remove any of them). Full `vitest run`: **154 tests pass**,
unchanged from before this pass — `lib/intake/__tests__/assemble-profile.test.ts`
needed one small fixture fix (`heightCm` backfilled to a default for the 5
real sample profiles, which predate the intake form requiring it; the
engine-level `UserProfile` schema is unaffected).

**Manually verified in-browser, full click-through**: landing page renders
with the correct tab title, "Get your recommendations" reaches `/intake`;
all 6 themed screens render their grouped fields correctly (including the
required height field defaulting to 170); reached the review screen and
confirmed every section's summary text is accurate; clicked "Edit" on
"About you", changed the age, clicked "Save & back to review", and
confirmed it landed back on the review screen with the updated value
reflected — the full edit-and-return loop works end to end; submitted for
real (short-circuit path, no free text to parse) and confirmed the "You're
all set" screen shows no JSON.

## Not done here (intentionally, out of this pass's scope)

- Live/refreshed pricing (see above).
- No changes to `/results` itself — Package E's cards, basket, and
  disclaimer are untouched.
- No rewrite of `/chat`'s own persona/prompts (`AI_NAME`, `WELCOME_MESSAGE`,
  `OWNER_NAME` still say "myAI6"/reference a generic "owner") — flagged as
  a TODO since B0 and still nobody's job yet.

## For whoever picks up next

`lib/intake/schema.ts`'s `STEP_FIELDS`/`STEP_TITLES` are now the
authoritative source for both step validation and the review screen's
section labels — if the grouping ever changes again, both update from
editing that one array. If `/chat` is ever repurposed or removed, check
`app/terms/page.tsx`'s "back to home" link (already correctly points at `/`,
i.e. the new landing page, not `/chat`) and confirm nothing else assumes
chat lives at the site root.
