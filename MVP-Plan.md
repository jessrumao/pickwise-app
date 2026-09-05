# Supplement Recommendation Engine — 3-Day MVP Plan

Context: BITSoM ABM Term 4 class assignment, 3 days to build, doubling as the seed of a real venture. Building on the myAI6 repo (Next.js 16 + Vercel AI SDK + Pinecone) as the technical base. Friend (life-sciences background) is standing in as the domain expert; every rule/claim should cite real research so the "expert governance" and "evidence transparency" principles from the handoff doc are visibly present in the demo, not just asserted.

## 1. Scope decisions (locked from discussion)

- **Marketplace redirect**: real product links (Amazon.in, HealthKart, etc.) — no cart/checkout built. Recommendation ends in an outbound link to an actual listing.
- **Ingredient universe**: full green list (~20 items) from the handoff doc. Flagged risk: this is ambitious for 3 days — see the phasing note in Section 5 for how to hit this without stalling on day 1.
- **Safety tiers for MVP**: collapse the handoff's 4-tier model (Green/Yellow/Red/Black) down to a working 2-state MVP — **Auto-recommendable** and **Escalate to professional** — with the full 4-tier model documented as the target architecture and "future work" in the writeup. Trying to correctly calibrate Yellow vs Red risk boundaries for 20 ingredients in 3 days is not realistic; showing that the architecture *supports* that distinction (even if today's ruleset only implements 2 of the 4 states) is enough for a class MVP and keeps the trust story ("we say no") intact.
- **Regulatory (FSSAI etc.)**: not implemented in the 3-day build. Add a visible disclaimer + a "regulatory considerations" section in the writeup showing awareness, per the handoff's instruction not to ignore it — but don't burn build time on it now.
- **AI's role**: parsing free-text profile answers into structured fields, retrieving/explaining evidence with citations, and generating natural-language explanations. The AI does **not** decide recommendations — that's rule logic over structured data, per the handoff's core architecture principle.

## 2. Data model (the actual product)

Three structured artifacts to build, independent of any UI:

**A. User profile schema** — age, sex, dietary pattern, exercise/training frequency & type, primary goal(s), sleep, existing supplement use, dietary intake pattern (rough), allergies, relevant health context, medications/conditions flag (yes/no + free text, used only for escalation, not diagnosis).

**B. Ingredient knowledge base** — one structured record per ingredient (~20 records), each with: ingredient name, form(s), indication(s)/goal(s) it serves, evidence tier (Strong/Moderate/Limited/Insufficient), a plain-language "why" template, dosing guidance (range + typical serving), contraindications/interactions (used for escalation), auto-recommend eligibility rule (a simple boolean expression over profile fields), and 2-4 citations (paper/guideline + link). This is the file your friend should own/review — it's the expert-governance layer made concrete.

**C. Product catalog** — small table per ingredient (2-4 real products each is plenty): product name, brand, form, effective amount per serving, price, a quality signal if available (third-party tested Y/N, certifications), real marketplace URL, and a short "why ranked here" note. Ranking formula per the handoff (suitability × evidence × safety × product quality × value) can be a simple weighted score for MVP — doesn't need to be sophisticated, just explainable.

## 3. Decision logic (deterministic, not LLM)

For each ingredient in the knowledge base, evaluate the profile against its auto-recommend rule:
- Rule matches + Strong/Moderate evidence → **Recommended**
- Rule partially matches or evidence is Limited → **Potentially useful**
- Contraindication flag or medication/condition flag hits → **Escalate** (the "Black" case — "we recommend speaking with our medical professional," shown as a legitimate outcome, not an error)
- No relevant goal/context → **Not shown / not needed** (this is the differentiator — the engine should visibly *not* recommend things, e.g. BCAA when protein intake is already adequate)

This can be plain TypeScript/JSON rule evaluation — no ML needed for the MVP. The RAG/Pinecone layer's job is narrower than in myAI6's original design: it retrieves the cited evidence text to display under "Why am I seeing this," not to decide anything.

## 4. Technical adaptation of myAI6

**Keep as-is**: chat-less parts aren't needed, but keep the Next.js scaffold, streaming API pattern, Pinecone 3-namespace retrieval (repurposed to hold the ~20 ingredients' cited research instead of "owner" content), citation verification/Sources box (directly reusable for showing evidence with checkmarks), moderation (keep for safety, low effort to leave on), rate limiting, env-var config pattern.

**Strip**: owner-profile fetching (`fetchOwnerProfiles`), the confidentiality-about-tech-stack prompt rules (not relevant here), the multi-conversation sidebar (probably unnecessary for a single recommendation flow, though harmless to leave).

**Add (net-new work)**:
1. A profile intake flow (form or guided conversational form) → produces the structured User Profile object.
2. A rules-engine module that takes the profile + ingredient knowledge base and returns per-ingredient statuses.
3. A results UI: recommendation cards (status, why, evidence strength badge, expected benefit, dosing guidance, "Why?" expandable with citations) each linking to ranked real products.
4. Ingestion of the friend's sourced research into Pinecone via the existing RAGloader notebook (one document per ingredient or per citation, `content_type: research_paper` mostly).
5. `KB_SCOPE` and prompts rewritten for the nutrition/supplement domain, replacing the "personal chatbot about an owner" framing entirely.

## 5. Suggested 3-day sequencing

**Day 1 — Data & logic, not UI.** Finalize the questionnaire fields. Draft the ingredient knowledge base for all ~20 green-list items, but sequence it: get 5-6 highest-confidence items (whey, creatine, multivitamin, omega-3, probiotics, BCAA-as-a-"not recommended"-example) fully done first — evidence tier, rule, citations, products — since that's what proves the concept end-to-end. Keep going through the rest of the list with the remaining time; a partially-populated full list (e.g. 20 defined, 12 fully cited) is fine and honest to present. Have your friend working in parallel on evidence/citations for whichever ingredients aren't done yet.

**Day 2 — Build.** Fork myAI6. Build profile intake + rules engine + results UI against the ingredients that are fully data-complete first, then wire in the rest as data finishes. Ingest cited sources into Pinecone via the notebook. Get one profile → full recommendation output working end-to-end before adding breadth.

**Day 3 — Integration, testing, polish, writeup.** Run 3-4 varied test profiles (e.g. the vegetarian muscle-gain example from the handoff, a sedentary wellness-goal user, a user with a flagged medication) and check the outputs make sense and escalate correctly. Fix obvious rule gaps. Polish the UI. Write the assignment documentation: what's implemented vs. deferred (4-tier safety model, regulatory work, personalization/feedback loop), and why those deferrals are deliberate scope decisions rather than oversights — that framing is itself part of demonstrating the product thinking from the handoff doc.

## 6. Open items to nail down before/at Day-1 start

- Exact questionnaire wording/fields (can draft directly).
- The ~20-item knowledge base template structure (can draft as JSON/table now).
- Which specific real products (brand + link) to pull from Amazon/HealthKart per ingredient.
- How much of the myAI6 codebase your friend can also touch vs. it being solo-built.
