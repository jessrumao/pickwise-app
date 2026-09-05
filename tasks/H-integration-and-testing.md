# Package H — Integration & Testing

**Owner:** Sanket. **Last package — needs B, C, D, E, F, G all merged.** Don't start this in a parallel chat until the others are at least functionally done; it's inherently sequential.

## What this is

Wiring the independently-built pieces into one working end-to-end flow, then proving it behaves correctly with realistic test profiles — this is Day 3 of the original plan (integration, testing, polish).

## Integration checklist

1. Profile intake (D) → writes via persistence (C, no login — anonymous cookie identity) → engine (B) evaluates → results/basket UI (E) renders → citations resolve via Pinecone retrieval (F) → routine text generates (G) where applicable.
2. Confirm every hop uses B0's published types with no ad-hoc reshaping in between — if you find a package invented its own shape instead of using the shared contract, fix the integration point, don't paper over it with a converter function.
3. Confirm decision records (C) are actually written on every completed run, with the correct `profile_version_id`, `kb_sha`, and `ruleset_sha`.

## Test profiles

Run the 5 existing samples (`data/tools/samples/*.json`) through the **real app**, not just `demo.mjs`, and confirm the UI matches what `demo.mjs` proves at the data layer:
- `vegetarian-muscle-gain` — protein RECOMMENDED (1.5 scoops), creatine RECOMMENDED, BCAA NOT NEEDED with citation.
- `vegan-endurance` — omega-3 → algal-oil. Also currently exposes the protein-eligibility gap (see Package A) — confirm whether Package A landed a fix by the time you test; if not, this is a known, already-documented gap, not a new bug to chase.
- `unparseable-medications` — global escalation before any eligibility rule runs.
- `sedentary-wellness` — nearly everything suppressed.
- `already-covered` — suppression, not a duplicate recommendation.

Then add 1-2 fresh profiles not in the sample set, covering scenarios the originals don't (e.g. a profile that should trigger the budget allocator's "deferred" state with a real basket that doesn't all fit, and a profile that exercises the routine builder's timing-constraint fencing).

## What to check beyond "does it run"

- **Escalation reads as legitimate, not broken.** Click through the escalate state as a first-time user would — does it feel like a real answer, or an error page?
- **Not-needed/already-covered cases are visible, not silently omitted.** This is the actual differentiator — verify it's not just correct in data but visible in UI.
- **No broken/unverified product links ship.** Cross-check against Package A/E's `urlVerified: false` list.
- **Disclaimer (Package I's copy) is actually present** on the results page.
- **Reproducibility**: pull up a past decision record for a test user and confirm it still shows the same recommendation even after that user's profile has since changed (proves `profile_versions` snapshotting actually works, not just that the table exists).

## Deliverable

A working end-to-end demo covering all 5 original samples + 2 new ones, a short list of any rule gaps found (route data issues to Package A, code issues fix directly or file as follow-ups), and confirmation the disclaimer/regulatory copy (Package I) made it into the actual UI.
