# UI/UX redesign pass 1 — brand theme, nav, About page (2026-09-06)

Status note for the team / future sessions. Branch: `ui-redesign`. Restyles
on top of the shipped app (D's intake, E's results, "ui-polish-1"'s
landing) rather than rebuilding any flow logic — no `lib/`, `data/`, or
`app/api/*` changes except pure presentation.

## Source of truth

Two reference files the user supplied, now copied into the repo for future
sessions: `docs/design/pickwise_exmachina_v6.html` (the mockup this pass
targets: cream/blue "data terminal" aesthetic, Syne/Inter fonts, sharp
corners) and `docs/design/pickwise-design-language.md` (a **different**,
amber-on-black design language doc — explicitly **not** the direction used
here; kept only for reference in case that direction is wanted later).

## What changed

**1. Global theme tokens** (`app/globals.css`, `app/layout.tsx`) — applied
site-wide (including `/chat`, `/terms`) rather than a scoped theme, since
maintaining two palettes is more risk than one consistent look is worth:
cream background (`#F2F2F0`), near-black foreground/primary, a new
`--brand` token (`#4D9FFF`, exposed as `text-brand`/`bg-brand`/`border-brand`)
kept deliberately separate from shadcn's own `--accent` (a neutral hover
fill) so the blue stays an intentional accent, not a default. `--radius`
dropped to `0.25rem` for the sharper look. Syne added as a second font
(`--font-display`, weights 500–800) alongside the existing Inter, applied
via `font-display` on headings/nav/buttons/labels — body prose stays Inter.

**2. `components/site/site-header.tsx`** — new shared top nav (logo, About
link, a "START →" CTA to `/intake`), added to Landing, About, Intake, and
Results. Deliberately not added to `/chat` or `/terms` (out of scope, same
boundary "ui-polish-1" drew).

**3. `app/about/page.tsx`** — new. Real content grounded in the handoff
doc's "Core Idea"/"Core philosophy" sections (recommend what's appropriate
not what's profitable, rules decide, retrieval only explains, budget is a
filter not a bias), not placeholder copy.

**4. `app/page.tsx` (landing)** — rebuilt around the mockup's split-hero
pattern (headline + CTA left, dark status panel right) but keeping the
existing real copy/pitch rather than the mockup's literal content. The
dark panel deliberately does **not** copy the mockup's "500+ products
indexed" stat — that number doesn't exist for this product (a small,
expert-reviewed catalogue, not a marketplace of hundreds) and fabricating
it would be dishonest marketing copy. It shows real, defensible status
lines instead (engine online, budget-blind scoring active, escalation gate
active). Similarly, the mockup's "this week's top products" ranked-card
section is not reproduced — this product's recommendations are always
personalized per profile, so a generic "bestsellers" list would
misrepresent how it actually works; the real "how it works" 3-step content
is shown in the mockup's visual language instead (numbered grid, eyebrow
labels) rather than literally copying the product-card component.

**5. Intake (`components/intake/intake-flow.tsx`)** — outer shell
restructured to the mockup's onboarding layout: a segmented progress row
(one tick per step) plus a dark step sidebar (hidden below `md`, by
design — mobile-first) listing all 8 steps with done/current/upcoming
states, replacing the single centered Card + shadcn `Progress` bar.
**Every field's internal JSX/validation logic is untouched** — this was a
shell-only restructure, not a form rewrite; `STEP_FIELDS`/`STEP_TITLES`
remain the single source of truth exactly as before.

**6. Results** (`app/results/page.tsx`, `recommendation-card.tsx`,
`basket-summary.tsx`) — lighter touch: `SiteHeader` added, loading state
now shows the design language's `CALCULATING STACK_` pattern instead of a
generic spinner, typography updated to `font-display` on titles/badges/
buttons. **No structural rebuild** of the mockup's sidebar-profile-block +
ranked-card layout — that would need a user-profile summary the current
`RecommendationResult`/`adaptDecisionRecord` output doesn't carry, which is
a data-plumbing change, not a styling one. Flagged below as a real next
step rather than silently left out.

## Scope boundaries (deliberate, not oversights)

- No pixel-for-pixel rebuild of every mockup element on every screen —
  intake's per-field markup and results' card internals reuse the existing,
  already-correct shadcn components (which now inherit the new theme
  automatically) rather than being hand-rebuilt to match the mockup's exact
  DOM shape. The 5-status recommendation system (recommended/potentially
  useful/escalate/not_needed/already_covered) and its calm, non-alarming
  framing for escalate/not-needed — explicitly "the actual differentiator,"
  per Package E's own brief — is fully preserved, not simplified to match
  the mockup's plainer 3-item ranked list.
- No results-page profile sidebar (GOAL/LEVEL/FREQ/DIET/BUDGET block) —
  needs the raw profile plumbed through to the results view, which today's
  `/api/decisions` response doesn't carry. Real next step for whoever picks
  this up, not done here.
- `/chat` and `/terms` keep their original myAI6-era look and copy — same
  boundary every prior UI pass has drawn; still not this pass's job.

## Verification

`npx tsc --noEmit` clean. `eslint` on every file this pass touched — 0
errors (4 unescaped-apostrophe errors in the new About page copy were
caught and fixed; the one remaining warning in `intake-flow.tsx` is
pre-existing, about `react-hook-form`'s `watch()` API, unrelated to this
pass). Full `vitest run`: **175 tests pass**, unchanged count — this was a
presentation-only pass, no logic to add tests for. `next build` succeeds
with the same route list as before plus `/about`.

**Manually verified in-browser** (this device had no way to run the app
before this session — Node.js was installed specifically to do this):
landing page renders the full hero/status-panel/trust-bar/steps sequence;
About page renders all sections; Intake's segmented progress bar and step
sidebar render correctly (sidebar confirmed via direct DOM measurement to
be full-height, `716px` in an 800px viewport — an early screenshot looked
truncated but that was the preview tool's own letterboxing when emulating
a viewport larger than the pane, not a real layout bug); a real
recommendation card (status badge, evidence badge, product info, routine
button, evidence accordion) renders correctly through the demo picker.

## For whoever picks up next

- `--brand` is the one accent color — reach for it before inventing a new
  one, and keep it rare (CTAs, scores, active states, eyebrow labels) per
  the design language doc's "count the amber/accent elements, if more than
  ~8 remove some" instinct, even though we're not using that doc's exact
  palette.
- If a results-page profile summary sidebar is wanted, the raw `UserProfile`
  needs to reach `ResultsView` — check whether `/api/decisions`' GET/POST
  response should carry it, or whether it's cheaper to fetch
  `/api/profile` alongside the decision on that page.
- `docs/design/pickwise-design-language.md` (amber/black) exists in the
  repo but was explicitly not used — don't accidentally blend the two
  systems in a future pass without checking which one is still current.
