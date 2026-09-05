# Package E — Results / Basket UI — done (2026-09-06)

Status note for the team / future sessions picking up Packages G, H (and
whoever eventually does Package C/F). Follows `tasks/E-results-basket-ui.md`.
Builds on `b-recommendation-engine-status.md` (the engine this renders) and
`d-profile-intake-ui-status.md` (the intake flow this receives a profile
from).

## What exists now

```
webapp/
  app/results/page.tsx                      <- the /results route
  components/results/results-view.tsx       <- orchestrator: runs generateRecommendations, sorts, renders
  components/results/recommendation-card.tsx <- per-item card, all 5 visible statuses
  components/results/basket-summary.tsx     <- funded/deferred basket view
  components/results/disclaimer.tsx         <- Package I placeholder copy (see below)
  lib/results/status-display.ts             <- the one place status -> label/tone mapping lives
  lib/results/product-lookup.ts             <- urlVerified + placeholder-composition guards
  lib/results/demo-profiles.ts              <- 5 real samples + 1 escalate demo, for the picker
  lib/results/session-handoff.ts            <- D -> E profile handoff (sessionStorage, see below)
  lib/results/__tests__/demo-profiles.test.ts
```

## How a profile gets here

Package C's real persistence doesn't exist yet (`/api/profile` is still
Package D's stub), so there's nowhere to fetch a submitted profile back from
by id. `lib/results/session-handoff.ts` bridges this: `saveProfileForResults`
is called from `intake-flow.tsx`'s `doSubmit` right after a successful
submit, and `/results` reads it back via `loadProfileForResults` in a
`useEffect` on mount (sessionStorage doesn't exist during SSR, so it can't be
read in a lazy `useState` initializer without a server/client mismatch —
matches the same `isClient`-in-an-effect shape `app/page.tsx` already uses).
**When Package C lands**, this should be replaced with a real fetch by
`profileVersionId`; `saveProfileForResults`/`loadProfileForResults` is the
one place that needs to change.

If there's no session profile (fresh visit, direct link, private browsing),
`/results` shows a picker: the 5 real `data/tools/samples/*.json` profiles
plus one Package-E-authored demo profile (see below), each with their
`_note` shown as a description — same profiles Package B's own tests use, so
what you see here is provably what the engine actually produces.

## The escalate-demo fixture

None of the 5 canonical samples ever produces a targeted (per-item)
`"escalate"` status — only `unparseable-medications`, which triggers a
*global* escalation that blanks the whole recommendation set. Package E's
done-when needs a real Recommended + Escalate + Not Needed on one screen, so
`lib/results/demo-profiles.ts` adds `escalate-demo`: `vegetarian-muscle-gain`
with `medicationsOrConditionsFlag` naming warfarin, which fires the real
`safety-epa-dha-anticoagulant` policy (already in `data/`, not invented for
this). This is **not** written into `data/tools/samples/` — only Package A
writes there — it lives in `lib/results/` as a UI-layer fixture. A test
(`demo-profiles.test.ts`) verifies it actually escalates `epa-dha` while
protein/creatine still recommend and BCAA is still `not_needed`, through the
real engine, not asserted by hand.

## Card design, per the brief's "not-needed/escalate are first-class" instruction

`lib/results/status-display.ts` maps status -> `{label, tone, framing}` in
one place. Deliberately no red/destructive color anywhere — `escalate` gets
its own amber "informative" tone with copy like *"This isn't a no — it just
needs a clinician's judgment, not ours"*, and `not_needed`/`already_covered`
get calm, explained copy rather than being omitted. `not_shown` is the only
status that renders nothing — that's the engine's own "not relevant to this
profile" signal (see `types/engine.ts`'s comment on `RecommendationStatus`),
distinct from an explicit no.

Every card's `why` text comes straight from `Recommendation.why`
(predicate.mjs/predicate.ts's `explain()` over the real trace) — never
written by this UI. The "Why? (evidence)" accordion pulls the eligibility
policy's `citesClaims` and renders each claim's `statement` + real citations
from `data/claims/*.json` — this is the Package F stub the brief calls for
("stub with the citation list already present... in the meantime").

## Product safety guards (brief: "do not render a product whose urlVerified
is false" + the 3 placeholder-composition records)

`lib/results/product-lookup.ts`'s `getProductDisplay()` is the single choke
point: `marketplaceUrl` is only ever returned when the pricing entry's
`urlVerified` is true (otherwise the card/basket row shows "Link coming
soon" instead of a broken/generic search-page link), and
`PLACEHOLDER_COMPOSITION_PRODUCT_IDS` (the exact 3 ids from
`data/README.md`: `algal-omega3-vegan-60`, `hkvitals-multivitamin-men-60`,
`hkvitals-pre-probiotic-60`) get an explicit amber note wherever they
appear — in the recommendation card **and** in the basket summary, since a
product can reach the basket without ever getting a serving-plan product box
(e.g. the multivitamin, which has no computed serving plan at all — see
`recommend.ts`'s ingredient-scoped branch).

## Bugs found and fixed during this package (not pre-existing, all mine)

Building E meant running real profiles through the real engine end-to-end
for the first time in a browser rather than through unit tests alone, which
surfaced three real defects:

1. **`lib/engine/dosing.ts`'s `buildServingPlan` produced an empty `unit`
   for every GROUP compound** (`epa-dha`). Its lookup was
   `product.deliversPerServing.find(d => d.compoundId === compoundId)`, but
   a group compound's product records are only ever keyed by its *members*
   (`epa`, `dha`), never by the group id itself — `amountPerServingFor` right
   above it already correctly sums the members, but the unit lookup didn't
   mirror that. Fixed to read the compound's own declared `unit` from
   `compoundById` instead of searching `deliversPerServing` at all — simpler
   and correct for both group and non-group compounds. Regression test:
   `lib/engine/__tests__/dosing.test.ts`.
2. **`lib/intake/assemble-profile.ts` omitted `relevantHealthContext` and
   `medicationsOrConditionsFlag.freeText` entirely whenever the user left
   those optional fields blank**, instead of sending `""`. `predicate.ts`'s
   evaluator treats a genuinely *missing* field as `UNKNOWN` (fails closed),
   but an empty string as a definite non-match — so leaving either question
   blank (the common case) made five unrelated safety policies
   (renal/kidney, anticoagulant, immunocompromised, iron-overload) escalate
   for a profile with nothing wrong at all.
3. **The same file only ever set `isPregnantOrBreastfeeding` for `sex ===
   "female"`, leaving it `undefined` for every male/prefer-not-to-say
   user** — directly contradicting `user-profile.schema.json`'s own note
   ("defaults to false otherwise"). Because `safety-global-pregnancy` also
   fails closed on unknown, **this meant every non-female submission of the
   real intake form would have hit the global "no automated recommendation
   is produced for this profile" screen.** This is the most severe of the
   three — caught only by loading a hand-built profile through
   `generateRecommendations()` in the browser and noticing five things
   escalated that had no business escalating.

All three are fixed in `lib/intake/assemble-profile.ts` (now: always set
these three fields, defaulting to `""`/`false` rather than omitting them),
with regression tests added directly to
`lib/intake/__tests__/assemble-profile.test.ts` that run the assembled
profile through the real `generateRecommendations()` — not just checking the
assembled object's shape — since that's the only way this class of bug
actually surfaces.

## Regulatory disclaimer

`components/results/disclaimer.tsx` is placeholder copy, not Package I's
final text (Package I hadn't landed when this was built) — written directly
from `tasks/I-regulatory-and-writeup.md`'s own required coverage (not
medical advice, not a diagnosis, not FSSAI/FDA-evaluated, escalation means
see a doctor). Swap in Package I's real copy in this one file once it
exists; every screen that needs the disclaimer already imports this
component, so nothing else should need to change.

## Verification

`tsc --noEmit` clean. `npx eslint app/results components/results lib/results
lib/engine lib/intake` — 1 known error, not a bug: `app/results/page.tsx`'s
`useEffect`-based sessionStorage read trips `react-hooks/set-state-in-effect`
(sessionStorage doesn't exist during SSR, so it can't be read any other way
without a hydration mismatch). This is the exact same shape as `app/page.tsx`'s
pre-existing `isClient` pattern — an initial attempt to "fix" this with
`useSyncExternalStore` instead was tried and reverted: it doesn't actually
work without also wiring a subscribe/notify mechanism to force a re-check
post-hydration, which the plain effect+state version doesn't need. Verified
correct by manual browser testing (see below), not just by removing the
lint error.

Full `vitest run`: **140 tests pass** (129 from B0/B/D + 7 new in
`lib/results/__tests__/demo-profiles.test.ts` + 2 new in
`lib/engine/__tests__/dosing.test.ts` + 2 new regression tests in
`lib/intake/__tests__/assemble-profile.test.ts`).

**Manually verified in-browser**: all 6 picker profiles render; the
escalate-demo profile shows Recommended (protein, creatine) + Potentially
Useful (multivitamin) + Escalate (omega-3, real safety copy) + Not Needed
(BCAA) + a funded/deferred basket with the placeholder-composition note, all
on one screen — the exact done-when criteria. The vegan-endurance profile
confirmed the substitution case (algal-oil, correct unit after the dosing.ts
fix, both product-safety guards firing together since that SKU is both
unverified-URL and placeholder-composition) and the known protein/endurance
data gap staying correctly hidden (`not_shown`, not silently patched). The
`unparseable-medications` profile confirmed the global-escalation screen. The
full intake -> sessionStorage -> results handoff was verified by seeding
sessionStorage the way `saveProfileForResults` does and loading `/results`
fresh — confirmed a healthy profile with every optional field left blank
produces zero escalations after the three fixes above (it produced five
before them).

## Not done here (intentionally, per E scope)

- No real citation retrieval — Package F's job; claims are read directly
  from `data/claims/*.json` via the knowledge base, which the brief
  explicitly allows as the interim stub.
- No routine/timing display (e.g. `DosingTiming.constraint`) — Package G's
  job, downstream of this.
- No real product ranking beyond what `pickTopCandidateProduct` already
  picks (catalogue order) — not this package's concern per Package B's
  brief.

## For whoever picks up G, H next

`ResultsView`'s sort order (`STATUS_ORDER` in `results-view.tsx`) and
`RecommendationCard`'s per-status rendering are the reference for how a
`Recommendation` should be presented — reuse rather than re-deriving status
labels or evidence-grade display elsewhere. `getProductDisplay()` in
`lib/results/product-lookup.ts` is the one function that knows about
`urlVerified` and the 3 placeholder-composition ids; any other UI that shows
a product should go through it rather than reading `pricingByProductId`
directly.
