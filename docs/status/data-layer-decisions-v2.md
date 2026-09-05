# Data-Layer Design Decisions — v2

Companion to `mvp-plan.md`. Captures the architecture decisions made while working through the "Retrieval Explains, Rules Decide" design artifact and the follow-on auth/persistence discussion. Treat this as the current source of truth for the data layer; `mvp-plan.md` reflects the earlier 3-day-build framing and should be read alongside this, not instead of it.

## Core principle (unchanged)

Recommendations only ever come from exact, structured lookups — never from vector/embedding retrieval. Pinecone holds evidence prose (chunked papers, guidelines) and is only ever queried *after* a decision is made, either to back it with citations or to answer a user's open-ended follow-up question. This "retrieval never reaches the decision" rule now applies to three things, not one: evidence retrieval, LLM-generated dosing, and price/budget.

## Six-layer stack

L0 Reference tables (ICMR-NIN RDA/EAR/UL) → L1 Entities (compounds, ingredients, goals, outcomes) → L2 Evidence claims → L3 Policy (eligibility, dosing, timing, safety — expert-signed) → L4 Products (composition + separate pricing feed) → L5 Decision records (immutable, versioned).

## Settled

- **Compound tier**: implemented in full, not stubbed. `entities/compounds.json` is a real entity; ingredients declare `delivers[]`; products carry numeric `deliversPerServing[]`. This is what makes vegan substitution a query, UL (upper limit) checks arithmetic, and ₹-per-effective-dose computable.
- **Storage for L0–L4**: versioned JSON in git, imported at build time on Vercel. Git SHA = KB version, used for pinning in decision records. Expert review happens via pull request.
- **Rule authoring**: predicate AST (JSON), not eval'd expression strings. Validatable against the profile schema at build time, and the evaluator returns the clause trace that the LLM uses to phrase (never invent) the explanation.
- **Scope**: supplements + gap math (e.g. "you need ~130g protein/day, you're getting ~90"). Food recommendations explicitly deferred — they roughly double the data layer.
- **Dose vs. serving plan vs. routine**: three distinct things. *Amount* (e.g. 40g protein/day) is computed by policy × body weight, never by the LLM. *Serving plan* (40g ÷ 24g/scoop = 1.5 scoops) is arithmetic + a rounding rule, never the LLM. *Routine* (fitting that into someone's actual day) is the one place the LLM writes free text, fenced by an evidence-backed timing constraint in L3 (e.g. `separate_from: calcium`) so it can't invent clinically wrong timing advice.
- **Budget**: applied strictly after the recommendation set is fixed, price-blind. A budget allocator fills the basket in priority order (never cheapest-first). Anything that doesn't fit is shown as "deferred" with its price, not silently dropped. Downgrades to a cheaper SKU are allowed only above a quality floor (see below) — never below it.
- **L5 (decision records) storage**: Postgres (Vercel Postgres / Neon), not git — git can't hold runtime writes from a serverless function. This was chosen over rendering-without-persisting because persistence is needed to demo reproducibility and the adherence/outcome feedback loop.
- **User accounts / persistence**: real accounts, built for the MVP (not faked, not deferred) — the point is a user can create a profile, leave, and come back to find it and their past recommendations still there.
- **Auth method**: Auth.js (NextAuth), **email magic link only** — no Google OAuth, no password. Chosen for being Next.js/Vercel-native (no new vendor beyond the Postgres DB already in use for L5), cheap (no per-message SMS cost like phone OTP), and low build effort before the deadline. Google sign-in can be added later as an additional provider with minimal extra code if wanted.
- **Profile versioning**: snapshot-per-edit, not overwrite-in-place. Every profile change creates a new `profile_versions` row; a decision record foreign-keys to the exact `profile_version_id` used to produce it. This is what makes a 6-month-old recommendation actually reproducible — the profile that generated it doesn't get silently mutated by later edits.
- **Rounding policy**: round to the closest number, no per-compound tolerance bands. E.g. 40g ÷ 24g/scoop = 1.67 → rounds to 1.5 scoops (closer than 2); 1.89 → rounds to 2 (closer than 1.5). One uniform rule rather than an expert-tuned tolerance band per compound. Build note: this assumes servings can be split into halves (a scoop with a half-mark, a tablet that can be split) — a `splittable` boolean is therefore required on each product record, and non-splittable products fall back to whole units.
- **Quality floor**: a cheaper SKU may only be substituted in if it still meets the required effective dose. No separate third-party-testing requirement — dose met is the only gate.
- **Priority formula**: `priority_score = gap_tier + evidence_tier + goal_alignment`, additive rather than multiplicative so it stays explainable in one sentence. *Gap tier*: severe/moderate/mild shortfall vs. requirement, scored 3/2/1. *Evidence tier*: reuses the existing Strong/Moderate/Limited/Insufficient claim rating, scored 3/2/1/0. *Goal alignment*: does the compound serve the user's stated primary goal (2), a secondary goal (1), or neither (0). Sort descending, fund in that order until budget runs out. No hard override for true nutrient deficiencies (intake below EAR) — deficiencies compete on the same score as everything else rather than auto-jumping the queue, keeping this to one rule instead of two. Worked example matching the design doc's own sample: protein (severe/strong/primary) = 3+3+2 = 8; creatine (moderate/strong/primary) = 2+3+2 = 7; omega-3 (mild/moderate/secondary) = 1+2+1 = 4 — reproduces the funded-then-deferred ordering already sketched there.
- **`bodyWeightKg` and `monthlyBudgetINR`**: confirmed. `bodyWeightKg` is added to the user profile (required — protein and creatine dosing are weight-scaled and nothing computes without it). `monthlyBudgetINR` is added as a decision-making input consumed by the budget allocator, not by the rules engine. Both live on `profile_versions`, so a weight or budget change creates a new snapshot like any other profile edit.

## Resulting schema shape (Postgres)

- `users` — identity, managed by Auth.js (id, email, created_at).
- `profile_versions` — one row per edit: (id, user_id, created_at, body_weight_kg, goals, diet, medications, monthly_budget_inr, …). "Current profile" = latest row for that user_id.
- `decision_records` — (id, user_id, profile_version_id FK, created_at, kb_sha, ruleset_sha, trace jsonb, recommendation jsonb, budget_outcome jsonb, adherence/outcome fields appended later).

## Consequences to test (not to re-decide)

These are edges that follow from settled calls. Each should be exercised with a test profile before the demo; none of them reopen a decision.

1. **Deficiency vs. performance under a tight budget.** Vegan user, muscle-gain goal, B12 intake below EAR. B12 scores 3+3+0 = 6 (severe gap, strong evidence, no goal alignment); protein scores 8. On a ₹2,000 budget, ₹1,900 of whey funds first and a ₹200 B12 defers. If that reads wrong in testing, the smallest fix that stays inside the single-rule design is to let `goal_alignment` score 2 for "prevents a documented deficiency risk" — rather than adding a second override rule.
2. **The quality floor reads label claims, not verified content.** Underfilling and adulteration are documented problems in the Indian supplement category, so "effective dose met" is really "label-claimed dose met." Acceptable for the MVP; worth one honest line in the writeup, and a natural v2 improvement given third-party-testing is already a field in the product schema.
3. **Rounding down past a threshold on non-splittable products.** Nearest-half is safe for protein (36g against a 40g gap is fine) but not for a compound with a threshold below which it doesn't work and a product that can't be halved — a 2-capsule target rounding to 1. Covered by the `splittable` flag plus a per-compound `minEffectiveDose`, without needing a second rounding rule.

## Notes on myAI6 reuse (unchanged from artifact)

Pinecone 3-namespace retrieval, the RAGloader notebook, citation verification/Sources box, and moderation/rate-limiting/streaming UI are all reusable as-is. `fetchOwnerProfiles`, owner prompts, and `KB_SCOPE` should be stripped. The LLM tool-loop must never carry recommendations — myAI6's chat/RAG pattern sits *beside* the recommendation engine, never underneath it.
