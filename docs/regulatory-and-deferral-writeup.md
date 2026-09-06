# Regulatory Considerations & Scope Deferrals

Package I deliverable (`tasks/I-regulatory-and-writeup.md`). Written for the
BITSoM ABM Term 4 assignment writeup, and mirrored here so it travels with
the codebase. Source material: `Supplement Recommendation Engine — Core
Idea & Discussion Handoff.md`, `MVP-Plan.md`, `data-layer-decisions-v2.md`,
`data/README.md`, and the current state of `data/` and `lib/engine/` as of
2026-09-06 (Package A's expert sign-off + Packages B/C/D/E already
verified working end-to-end).

## 1. In-product disclaimer

This is the copy shipped in `components/results/disclaimer.tsx`, shown on
every results screen:

> **Not medical advice.** This tool suggests supplements based on the
> information you provided and published evidence — it does not diagnose
> any condition and is not a substitute for a doctor. The supplements and
> claims shown here are not evaluated by FSSAI or the FDA for the specific
> benefits described. Where this tool says to talk to a doctor first, that
> means exactly that — please don't start or stop anything based on this
> page alone.

This covers the four things the brief calls for: not medical advice, not a
diagnosis, not FSSAI/FDA-evaluated, and that an escalation is a real
instruction to see a professional, not a soft suggestion.

## 2. Regulatory considerations

The company is India-first, so Indian food, advertising, and data-privacy
law all apply from day one — even though none of it is implemented in this
build (see §3). This section is deliberately specific rather than a
"we should check regulations" placeholder.

### 2.1 FSSAI — what actually governs a supplement product in India

The controlling regulation is the **Food Safety and Standards (Health
Supplements, Nutraceuticals, Foods for Special Dietary Use, Food for
Special Medical Purpose, Functional Food and Novel Food) Regulations,
2016**, in force since January 1, 2018. Three things from it are directly
relevant to what this product would need before it could sell anything for
real, not just recommend it:

- **Dosage is capped, not just suggested.** A health supplement's vitamin
  and mineral content is capped at **100% of RDA per recommended daily
  serving** — a product can't be formulated (or a dose recommended) above
  that on the theory that "more is better." This is the same principle
  `data/reference/nutrient-requirements.json`'s upper-limit ledger is
  built around, but the ledger currently enforces IOM/FDA upper limits, not
  the FSSAI 100%-RDA supplement-specific cap — a real product build would
  need to check both, and the stricter one wins.
- **Ingredients are a positive list, not "anything safe."** Only
  ingredients named in **Schedule VI** (at the standardization and daily
  usage level specified there), or botanicals under Schedules IV/VI, may be
  used in a health supplement. A recommendation engine that's ingredient-
  and dose-aware (as this one already is, via `data/entities/compounds.json`
  and `data/ingredients/*.json`) is well-positioned to add a Schedule VI
  eligibility check as one more predicate — but that check doesn't exist
  today.
- **A Central FSSAI License is mandatory regardless of turnover** for
  nutraceutical/health-supplement manufacturers and importers, *and*
  separately for e-commerce platforms that merely link to or facilitate
  sales of food products — which is exactly what this product's "real
  marketplace URL" product records (`data/products/products.json`) point
  at today, without any licensing relationship in place. Before the
  marketplace-redirect model in `MVP-Plan.md` §1 becomes a real commerce
  flow (not just an outbound link), the platform itself would need this
  license, and would need to verify each linked seller holds one too.

### 2.2 Claims and advertising — two overlapping laws, not one

- The **Food Safety and Standards (Advertising and Claims) Regulations,
  2018** require every health/nutritional claim to be truthful,
  unambiguous, and backed by statistically significant results from
  peer-reviewed, GCP-run clinical studies — and require **pre-approval**
  before a claim is made at all. Claims cannot imply a product is
  "recommended by medical/health professionals," and anything that reads as
  a *disease risk reduction* claim falls under CDSCO's jurisdiction, not
  FSSAI's, at all. Non-compliance carries a ₹10 lakh penalty per misleading
  claim (compoundable up to ₹25 lakh).
- Separately, the **Drugs and Magic Remedies (Objectionable
  Advertisements) Act, 1954** — older, broader than food law, and still
  live — bans advertising that claims to cure, diagnose, or prevent any of
  a scheduled list of conditions, regardless of whether the product is
  legally a "drug" or a "food." This is the law that actually constrains
  how a `why` explanation string can be worded, not just the FSSAI claims
  regulation — a defensible-sounding evidence citation is not the same
  thing as a compliant advertisement.

This is directly relevant to this codebase's own design rule: every
`Recommendation.why` string is generated by `explain()` over a real
predicate trace (`lib/engine/predicate.ts`), never invented — which is
necessary for defensibility but not sufficient for compliance. A real
launch would need every claim's *wording*, not just its evidentiary basis,
legally reviewed against both Acts before it ships, likely by adding a
claim-wording review step alongside the existing per-judgment `review`
block already in the schema (`data/schema/claim.schema.json`).

### 2.3 Data privacy — the questionnaire collects exactly the category the law is strictest about

The intake questionnaire (`data/questionnaire.md`) asks about medications
and health conditions specifically for safety escalation. Under the
**Digital Personal Data Protection Act, 2023**, this is squarely the kind
of data (health/medical information) that triggers the Act's heightened
notice-and-consent bar: consent must be free, specific, informed,
unconditional, and given through a clear affirmative action, preceded by a
clear notice — a pre-ticked checkbox or a buried clause in a terms page
does not qualify. Today, `medicationsOrConditionsFlag`'s free text is
explicitly documented as "used only for escalation, never diagnosis, never
stored beyond that use" (`tasks/D-profile-intake-ui.md`) at the
*application-logic* level, but there is currently no explicit DPDPA-style
consent notice shown before that question is asked, and no data-retention
policy governing how long `profile_versions.medications_free_text`
persists in Postgres. Both would be required before real users' data, not
sample profiles, flow through this schema.

### 2.4 Why the 4-tier safety model is the target architecture

The original design (`...Handoff.md` §6–10) is a four-state model:
**Green** (automated), **Yellow** (risk-based additional screening),
**Red** (requires deficiency/risk assessment before a high-dose or
therapeutic recommendation), and **Black** (outside automated scope
entirely — escalate). The 3-day MVP scope decision
(`MVP-Plan.md` §1) deliberately collapsed this to **2 states** — Auto-
recommendable and Escalate — because correctly calibrating the Yellow/Red
boundary for a wide ingredient list in three days isn't realistic, and a
wrong boundary is worse than an honestly narrow one.

**This is genuinely still true today, but the picture has moved since the
MVP was scoped.** As of this writeup, `data/policy/` has real eligibility,
dosing, *and* safety policies for four ingredients that were originally
proposed as Yellow-tier (`beta-alanine`, `caffeine`, `collagen-peptides`,
`magnesium` — each with its own contraindication rule, e.g.
`safety-caffeine-cardiac-anxiety.json`, `safety-magnesium-renal.json`).
Folding a Yellow-tier ingredient into the existing 2-state model, with a
real safety policy gating it, is exactly what "the architecture supports
the distinction even if today's ruleset only implements 2 of the 4 states"
(per the original MVP-plan framing) was meant to make possible — and it's
now demonstrated with real ingredients, not just asserted.

The Red tier is the part that's genuinely not there yet: `iron`,
`vitamin-d3`, `vitamin-b12`, `zinc`, `calcium`, and `folate` exist as
**entities** (`data/entities/compounds.json`) — needed so the multivitamin
policy's upper-limit ledger and `safety-multivitamin-iron-overload.json`
can reason about them — but none has its own standalone eligibility/dosing
policy, so none of them can be *recommended* as a standalone supplement
today. That's the correct state for an unimplemented Red tier: present
enough in the data model to not require a schema change later, absent
enough that nothing is auto-recommended without real governance.

**What full Red-tier calibration would actually require**, concretely:

1. **Lab-value or validated-risk-marker inputs** — a standalone iron or
   B12 recommendation without a deficiency signal is exactly the "may have
   a higher risk of inadequate intake" → "should take a high-dose standalone
   supplement" leap the handoff doc explicitly warns against (§9). Today's
   questionnaire has no lab-value fields at all, by deliberate design
   decision (`data/questionnaire.md`'s stated non-goals) — this would need
   to be added, which is itself a UX and data-sensitivity decision (lab
   results are a materially more sensitive data category than a
   self-reported goal or diet pattern).
2. **A dose-response / interaction risk model per Red-tier compound**,
   expert-authored the same way the current 11 safety policies are — e.g.
   iron-overload risk isn't just "has a condition," it's dose- and
   duration-dependent, which the current three-valued predicate model
   (`data/schema/predicate.schema.json`) can express but nobody has
   authored yet for these six compounds specifically.
3. **A distinct `escalate_with_reason` framing for Red vs. Black** in the UI
   and copy — today `RecommendationStatus`'s `"escalate"` value
   (`types/engine.ts`) doesn't distinguish "we need one more data point
   before we can say yes" (Red) from "this needs a clinician's judgment,
   full stop" (Black); `lib/results/status-display.ts` currently renders
   every escalation with the same amber, non-alarming framing, which is
   right for Black but would undersell how close a Red case might be to a
   safe answer if more data were available.

None of this is a rewrite — the predicate engine, the `review`-block
governance pattern, and the compound/policy separation the data layer
already has are the right substrate for it. It's expert time and new input
fields, not new architecture.

## 3. What's implemented vs. deferred, and why

Each of these was a deliberate scope call made explicit in
`MVP-Plan.md`/`data-layer-decisions-v2.md`, not an oversight discovered
late.

- **4-tier safety model → collapsed to 2 states (Auto-recommendable /
  Escalate).** Calibrating Yellow vs. Red risk boundaries correctly for a
  real ingredient list needs expert time that a 3-day build doesn't have,
  and a wrong boundary actively erodes the "we say no when appropriate"
  trust story the product depends on — narrower-but-correct beat
  wider-but-guessed. See §2.4 for exactly what's needed to extend it.
- **Regulatory / FSSAI → not implemented, awareness only.** Building real
  FSSAI compliance (Schedule VI ingredient checks, claim pre-approval,
  central licensing) before validating the product concept would be
  solving a distribution problem before there's anything to distribute.
  §2.1–2.3 above is the concrete version of "awareness," not a placeholder.
- **Personalization / adherence-outcome feedback loop → deferred.**
  `decision_records` (`data/db/schema.sql`) already has
  `adherence_reported`/`outcome_reported`/`feedback_at` columns reserved
  for exactly this, per `data-layer-decisions-v2.md` — but nothing writes
  or reads them yet. The loop needs a return-visit UX and a way to ask
  "did you actually take this, did it help" without over-claiming clinical
  evidence from self-reported outcomes, which is its own design problem,
  not just a missing feature.
- **Food recommendations → explicitly out of scope, supplements + gap math
  only.** `data-layer-decisions-v2.md` estimates this would roughly double
  the data layer (a food composition database, portion-size reasoning, a
  different UX for "eat more chicken" vs. "take this supplement"). Adding
  it before the supplement-only version is validated would be scope
  creep against the class deadline, not product strategy.
- **Lab-value inputs (blood test results) → out of scope for the
  questionnaire.** `data/questionnaire.md`'s explicit non-goals rule this
  out for the MVP. This is also §2.4's blocker for the Red safety tier —
  the two deferrals are the same underlying decision, not two unrelated
  ones.
- **Third-party testing / quality verification beyond label-claimed dose →
  the product schema has a field for it, but the quality floor only checks
  "dose met."** Per `data-layer-decisions-v2.md` consequence #2: underfilling
  and adulteration are documented problems in the Indian supplement
  category, so "effective dose met" today really means "label-claimed dose
  met." Verifying actual content would need either the platform's own lab
  testing budget or a trusted third-party-certification data feed, neither
  of which exists yet — the schema field is there so this can be turned on
  without another migration once one does.

## Sources

- [Food Safety and Standards (Health Supplements, Nutraceuticals, ...) Regulations, 2016 — overview](https://corpbiz.io/learning/fssai-regulations-for-nutraceuticals/)
- [FSSAI RDA dosage limits for nutraceuticals](https://morulaa.com/nutraceuticals-supplements-fssai-registration-india-rda-limits/)
- [FSSAI Advertising and Claims Regulations, 2018 — claim substantiation and approval](https://cliniexperts.com/regulatory-update/food-safety-and-standards-advertising-and-claims-regulations-2018/)
- [FSSAI Advertisement Claim Approval process and penalties](https://cliniexperts.com/india-regulatory-services/food/fssai-advertisement-claim-approval-for-food-supplements-nutraceuticals/)
- [Central FSSAI License requirement for e-commerce and nutraceutical FBOs](https://www.psrcompliance.com/blog/central-fssai-license-for-ecommerce-food-business)
- [Drugs and Magic Remedies (Objectionable Advertisements) Act, 1954 — Wikipedia summary](https://en.wikipedia.org/wiki/Drugs_and_Magic_Remedies_(Objectionable_Advertisements)_Act,_1954)
- [Digital Personal Data Protection Act, 2023 — consent framework](https://ksandk.com/data-protection-and-data-privacy/consent-under-dpdp-act-2023-compliance-strategies/)
- [DPDPA and healthcare/sensitive data compliance](https://www.dpdpa.com/blogs/dpdpa_compliance_healthcare_hospitals_guide.html)
