# Package I — Regulatory Disclaimer & Deferral Writeup

**Owner:** either. **Independent of every other package** — no code dependency, can run at any point, good filler task if someone's blocked waiting on another package.

## Context

This is a BITSoM ABM Term 4 class assignment doubling as the seed of a real venture. Per the original scope decision, regulatory work (FSSAI etc.) is explicitly **not implemented** in this build, and the 4-tier safety model (Green/Yellow/Red/Black) is **collapsed to 2 states** (Auto-recommendable / Escalate) for now, with the full model as documented future architecture. The instruction from the handoff doc was: don't ignore regulatory considerations, but don't burn build time on them either — show awareness instead. This package is that awareness, made concrete and written down.

## Deliverables

1. **A visible in-product disclaimer** (short copy, for wherever the results page ends up — hand this to whoever builds Package E). Should cover: this is not medical advice, not a diagnosis, supplements are not FDA/FSSAI-evaluated for the claims being shown, and escalation to a professional means exactly that — see a doctor, don't self-treat based on this tool.

2. **A "regulatory considerations" section** for the assignment writeup, showing the product thinking even though it isn't built:
   - What FSSAI oversight actually applies to supplement marketing/claims in India, at a level of specificity that shows real research (not just "we should probably check regulations").
   - Why the 4-tier safety model (Green/Yellow/Red/Black) is the target architecture, and specifically what's needed to properly calibrate the Yellow/Red boundary that the 3-day MVP collapsed away.
   - What would be needed to move from "collapsed 2-state MVP" to "full 4-tier" — this should read as a real roadmap item, not a hand-wave.

3. **"What's implemented vs. deferred, and why" section** — this is explicitly called out as *part of* demonstrating the product thinking, not just an appendix. Should cover at minimum, with one or two honest sentences each on why each was a deliberate scope call:
   - 4-tier safety model → collapsed to 2 states
   - Regulatory/FSSAI → not implemented, awareness only
   - Personalization / adherence-outcome feedback loop → deferred (the `decision_records` table has the hooks for it — see `data-layer-decisions-v2.md` — but nothing consumes them yet)
   - Food recommendations → explicitly out of scope, supplements + gap math only (doubling the data layer to cover food was a conscious call)
   - Lab-value inputs (blood test results — relevant to Vitamin D/B12/iron-type items) → out of scope for the questionnaire, per `data/questionnaire.md`'s explicit non-goals
   - Third-party testing / quality verification beyond label-claimed dose → the product schema has a field for it, but the quality floor only checks "dose met," not verified content (see `data-layer-decisions-v2.md` consequence #2)

## Where to pull source material from

- `Supplement Recommendation Engine — Core Idea & Discussion Handoff.md` (repo root) — original 4-tier model and philosophy.
- `MVP-Plan.md` (repo root) and the project's `mvp-plan.md`/`data-layer-decisions-v2.md` docs — the actual scope decisions and why.
- `data/README.md`'s "Known findings from the test run" section — concrete, already-discovered gaps worth citing as evidence the team is aware of its own limitations.

## Out of scope for this package

Don't touch any code or `data/` JSON — this is documentation and copy only. If a disclaimer needs to be wired into the actual UI, write the copy here and hand it to Package E rather than editing components yourself (avoids two people touching the results page).
