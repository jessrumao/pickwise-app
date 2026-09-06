# Package I — Regulatory Disclaimer & Deferral Writeup — done (2026-09-06)

Status note for the team / future sessions. Follows
`tasks/I-regulatory-and-writeup.md`. Documentation only, as scoped — no
`data/` or engine changes.

## What exists now

```
docs/regulatory-and-deferral-writeup.md   <- the actual deliverable: disclaimer copy,
                                              regulatory considerations, implemented-vs-deferred
components/results/disclaimer.tsx          <- real copy swapped in (was Package E's placeholder)
```

A polished version was also produced for the actual BITSoM assignment
submission (Word doc), sent separately — `docs/regulatory-and-deferral-writeup.md`
is the source of truth; keep them in sync if either changes.

## The one scope deviation from the brief

The brief says "write the copy here and hand it to Package E rather than
editing components yourself," to avoid two people touching the results page
concurrently. Package E is already merged and done (not concurrent work
anymore), so the disclaimer copy was swapped directly into
`components/results/disclaimer.tsx` rather than left as a handoff note
nobody would necessarily act on. The text is unchanged from what was
already there — Package E's placeholder had already been written directly
from this brief's own required coverage and needed no rewording, only the
file's header comment changed (it no longer says "placeholder").

## What the regulatory section actually covers (not just "we should check")

Real, sourced research (see the writeup's own Sources section), grounded in
the current state of this specific codebase, not generic advice:

- **FSSAI**: the 2016 Health Supplements Regulations' 100%-RDA dosage cap
  and Schedule VI ingredient positive-list (neither enforced by this build
  today — the UL ledger checks IOM/FDA limits, not FSSAI's supplement-
  specific cap), and the Central License requirement that applies to this
  product's own marketplace-redirect model, not just to manufacturers.
- **Two separate claims-law regimes**: the FSS (Advertising and Claims)
  Regulations 2018 (claim substantiation, pre-approval, penalties) *and*
  the older, broader Drugs and Magic Remedies (Objectionable
  Advertisements) Act 1954 (bans curing/diagnosing-disease claims
  regardless of whether the product is legally a "drug") — both constrain
  the wording of `Recommendation.why`, which is generated from a real
  trace but isn't legally reviewed.
- **DPDPA 2023**: the questionnaire's medication/condition question is
  exactly the data category the Act is strictest about (explicit,
  informed, affirmative consent) — flagged as a real gap: no consent
  notice shown before that question today, no retention policy on
  `profile_versions.medications_free_text`.
- **4-tier safety model, calibrated against what's actually in `data/`
  right now**, not the state from when the MVP was originally scoped:
  four former "Yellow" candidates (beta-alanine, caffeine, collagen,
  magnesium) now have real eligibility+dosing+safety policies, folded into
  the same 2-state model — concrete evidence the architecture generalizes,
  not just an assertion. Six "Red" compounds (iron, vitamin-d3,
  vitamin-b12, zinc, calcium, folate) exist as entities (needed for the
  multivitamin's UL ledger and iron-overload safety check) but have no
  standalone policy — correctly absent, not silently missing. Three
  concrete things are named as what full Red-tier calibration would
  require: lab-value/risk-marker inputs, a per-compound dose-response
  model authored the same way the existing 11 safety policies were, and
  splitting the UI's single `"escalate"` framing into a Red-vs-Black
  distinction.

## Verification

`components/results/disclaimer.tsx` compiles and renders unchanged (text
identical to before — only the file comment changed, confirmed by diff, not
just by assumption). Full `npx tsc --noEmit`, `eslint`, and `vitest run`
suite re-run clean after this change.

## Not done here (intentionally, per Package I scope)

No code beyond the one disclaimer swap. No `data/` changes — the Red-tier
gap and the FSSAI Schedule VI check are flagged as future work for Package
A / whoever picks up regulatory implementation for real, not implemented
here.
