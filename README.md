# Pickwise

**An evidence-based supplement and nutrition decision engine, built India-first for generally healthy adults.**

Tell Pickwise your goals, diet, and lifestyle. It tells you plainly whether a supplement actually makes sense, and which one — backed by a real citation, not an influencer's opinion or a retailer's margin. It is also comfortable saying **"you don't need anything right now."** That's the point: Pickwise is not a supplement store with a quiz bolted on. It's a decision layer that sits *in front of* the market and is willing to recommend nothing.

> Recommend what is appropriate — not what is profitable.

---

## Core principle: rules decide, AI only explains

This is not "a chatbot with a supplement knowledge base." The recommendation itself is produced by a deterministic rules engine — expert-reviewed eligibility, dosing, and safety policies evaluated against your structured profile. An LLM is used only for three narrow, non-decision-making jobs:

1. **Parsing** free-text intake answers (current supplements, allergies, medications) into structured fields.
2. **Explaining** a recommendation the rules engine already made, grounded in the exact evidence that justified it.
3. **Phrasing** a daily routine for the basket you were actually funded, fenced by the dosing policy's own timing rules.

The AI never invents a recommendation, a dose, or a safety judgment. If you ask "why wasn't creatine recommended for me," the explain-mode chat retrieves the real evidence and reasons about it — it does not re-run the decision.

---

## Product flow

```
Landing (/)
    │
    ▼
Intake (/intake) ── a themed, multi-step questionnaire
    │                 (goals, diet, lifestyle, budget, allergies, safety)
    ▼
Rules engine (lib/engine) ── runs server-side, never in the browser
    │
    │  1. Safety gate         — global/targeted escalation (medications, pregnancy, ...)
    │  2. Eligibility          — does this profile's goal/context match a policy?
    │  3. Substitution         — which ingredients deliver this compound for this diet?
    │  4. Dosing & serving plan — target amount, dietary gap, rounded real-world serving
    │  5. Priority scoring     — gap severity + evidence strength + goal alignment
    │  6. Budget allocation    — monthly, pack-aware, price-blind, priority order
    ▼
Results (/results) ── funded basket, per-item reasoning, a combined daily routine,
                        and a chat scoped to explaining what's on screen
```

### The five outcomes

Every recommendation lands in exactly one of these — `not_needed` and `escalate` are first-class outcomes, not edge cases:

| Status | Meaning |
|---|---|
| `recommended` | Rule matched, evidence grade Moderate or Strong |
| `potentially_useful` | Rule matched, but evidence grade is Limited/Insufficient |
| `not_needed` / `already_covered` | The rule explicitly does **not** fire — e.g. BCAA when protein intake is already adequate |
| `escalate` | A safety policy fired (or failed closed on unknown input) — *"we recommend speaking with a medical professional"*, shown as a legitimate outcome, not an error |
| `not_shown` | Not relevant to this profile at all (no goal/context match) |

---

## The budget allocator

The budget is a **monthly, pack-aware constraint**, applied strictly *after* the recommendation set and priority order are fixed — it never decides what gets suggested, only what's funded this round.

- **Price-blind, priority order.** Funds in priority order, never cheapest-first. A cheap, low-priority item never jumps ahead of an expensive, high-priority one.
- **Packs are the real purchasable unit.** A product's cost is `packs needed this month × price per pack`, where packs needed = `ceil(daily servings × 30 ÷ servings per pack)` — you cannot buy a fraction of a pack.
- **Partial-month funding beats deferring outright.** If a full month of the top brand doesn't fit, the allocator searches every real (brand × quantity) combination — including fewer packs of the same product — and funds whichever one covers the most of the month within budget, honestly labeled with how many days it actually covers. The per-serving dose is never reduced, only how many days it lasts before a restock is needed.
- **Flexible budget, bounded.** If you mark your budget as flexible rather than a hard cap, the allocator adds `min(15% of your budget, ₹1000)` of headroom — enough to let one more genuinely-needed item in, never unlimited overage.
- **Nothing is silently dropped.** Anything that doesn't fit is `deferred`, still shown with its real price, never hidden.

---

## Evidence & citations

Recommendation cards show a compact evidence badge (`Strong · 3 sources`) rather than the full citation text inline — full detail lives in the results-page chat, so evidence isn't shown twice. Ask "why was this recommended" or "is there other research on this," and the chat retrieves:

- **Cited evidence** — the exact claims that justified *this* recommendation.
- **Additional research** — real, vetted research beyond that, clearly labeled as *not* part of why the recommendation fired, so it's never mistaken for stronger justification than it actually has.

Citations render as numbered inline links with a code-rendered Sources box (deterministic, independent of the model's own markdown) and a green checkmark when the cited sentence is verifiably supported by the retrieved source text.

---

## Quickstart

### 1. Clone and install

```bash
git clone https://github.com/jessrumao/pickwise-app.git
cd pickwise-app
npm install
```

### 2. Set environment variables

```bash
cp env.template .env.local
```

| Variable | Required for | Source |
|---|---|---|
| `ANTHROPIC_API_KEY` | Intake parsing, routine phrasing, explain-mode chat, moderation | [console.anthropic.com](https://console.anthropic.com) |
| `PINECONE_API_KEY` | Evidence retrieval (the explain-mode chat's citations) | [app.pinecone.io](https://app.pinecone.io) |
| `DATABASE_URL` | Persisting profiles/decisions (`/api/profile`, `/api/decisions`) — Postgres (Neon or Vercel Postgres); run `data/db/schema.sql` against it once | your Postgres provider |
| `EXA_API_KEY` | Optional — supplementary web search in the (non-product) general chat reference page | [dashboard.exa.ai](https://dashboard.exa.ai) |

There is no login — a visitor is identified by an anonymous cookie-issued id (`lib/anon-session.ts`), not an account.

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Ingest the evidence base

The ~20-ingredient knowledge base (protein, creatine, omega-3, magnesium, probiotics, multivitamins, and more) is ingested into Pinecone via `RAGloader/RAG_loader_pipeline.ipynb`, one document per source citation.

---

## Project structure

```
pickwise-app/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── about/page.tsx              # Product philosophy
│   ├── intake/page.tsx             # Questionnaire flow
│   ├── results/page.tsx            # Recommendation basket + explain chat
│   ├── chat/page.tsx               # Reference implementation of a general chatbot
│   │                                # (not linked from navigation — kept as a pattern
│   │                                # reference, not part of the product flow)
│   ├── terms/page.tsx
│   └── api/
│       ├── profile/route.ts        # Persist a submitted profile version
│       ├── decisions/route.ts      # Re-run the engine server-side, persist the result
│       ├── intake/
│       │   ├── parse/route.ts             # AI: free text -> structured fields
│       │   └── estimate-protein/route.ts  # AI: estimate protein from a food description
│       ├── routine/route.ts        # AI: phrase one combined daily routine for the basket
│       ├── evidence/route.ts       # Retrieve cited evidence for a policy's claims
│       ├── chat/route.ts           # Explain-mode chat + the /chat reference page's chat
│       ├── feedback/route.ts       # Thumbs up/down logging
│       └── health/route.ts         # Liveness / dependency health check
├── components/
│   ├── intake/intake-flow.tsx      # Multi-step form, review screen, submission
│   ├── results/                    # Basket summary, recommendation cards, routine,
│   │                                # explain-mode chat, disclaimer
│   ├── site/                       # Shared nav + step-sidebar (intake <-> results)
│   └── messages/, ai-elements/     # Chat rendering (citations, sources, tool calls)
├── lib/
│   ├── engine/                     # The rules engine (see below)
│   ├── intake/                     # Form schema, profile assembly, free-text helpers
│   ├── results/                    # Product display, demo profiles, decision adapters
│   ├── routine/                    # Routine-prompt builder (the one place an LLM writes free text)
│   ├── anon-session.ts             # Cookie-based anonymous user id, no login
│   ├── db.ts                       # Postgres access
│   └── ai/                         # Model registry, routing, tool assembly
├── data/                           # The expert-governed knowledge base (see below)
├── RAGloader/                      # Notebook pipeline: ingest evidence into Pinecone
├── config.ts                       # Design/tuning parameters
├── prompts.ts                      # AI behavior prompts (general chat + explain mode)
└── types/engine.ts                 # Shared TS contracts, zod-validated against data/
```

### `lib/engine/` — the rules engine

| File | Purpose |
|---|---|
| `recommend.ts` | Top-level orchestrator: profile in, full recommendation set + budget outcome out |
| `safety.ts` | Global and targeted safety escalation |
| `eligibility.ts` | Recommend/suppress logic per policy |
| `substitution.ts` | Which ingredients deliver a compound, filtered by diet |
| `dosing.ts` | Target amount, dietary gap, product ranking by true monthly cost |
| `serving-plan.ts` | Rounds a dose into a real, purchasable serving count |
| `monthly-cost.ts` | Packs-per-month math and the partial-month quantity search |
| `priority.ts` | Additive priority score: gap tier + evidence tier + goal alignment |
| `budget.ts` | The allocator described above |
| `predicate.ts` | The rule-evaluation engine every policy's `appliesWhen`/`trigger` runs on |
| `knowledge-base.ts` | Loads and indexes everything under `data/` |

### `data/` — the expert-governed knowledge base

This is the layer a domain expert (not an engineer) owns and reviews — every JSON file is validated against `data/schema/*.schema.json`.

| Directory | Contents |
|---|---|
| `entities/` | Compounds (the nutrient itself, e.g. protein) and goals/outcomes vocabulary |
| `ingredients/` | Ingredient records (e.g. whey protein, algal oil) — what delivers a compound |
| `claims/` | Individual evidence statements with citations and an evidence grade |
| `policy/eligibility/`, `policy/dosing/`, `policy/safety/` | The actual rules — predicate ASTs evaluated against a profile |
| `products/` | The real product catalogue and its pricing feed |
| `tools/samples/` | Real sample profiles used by both the engine's own tests and the results-page demo picker |

---

## Testing

```bash
npm run test        # vitest run — engine, data-layer, citation, and routing tests
npm run test:watch  # watch mode
npx tsc --noEmit     # type check
```

Tests favor running real sample profiles through the real engine over hand-asserted fixtures — e.g. `recommend.samples.test.ts` reproduces documented worked examples end to end, and `knowledge-base.manifest.test.ts` catches a data file added without a matching import.

---

## Deployment

Push to GitHub, connect the repo on [Vercel](https://vercel.com), and set the same environment variables there. Every push to `main` triggers a deployment. See `env.template` for the full list, including optional feature switches (`ENABLE_VECTOR_SEARCH`, `MODERATION_PROVIDER`) and security options (`HEALTH_CHECK_TOKEN`, `SUMMARY_HMAC_SECRET`).

---

## What's deliberately deferred

Per the project's own scope decisions — not oversights:

- **Safety tiers**: today's engine implements a 2-state model (auto-recommendable / escalate to a professional). The full 4-tier model (Green/Yellow/Red/Black) from the original design discussion is documented as the target architecture, not yet fully calibrated across every ingredient.
- **Regulatory (FSSAI, etc.)**: not implemented; a disclaimer covers this today. Flagged as necessary future work, not something to solve after the fact.
- **Live/refreshed product pricing**: prices are periodically updated, not scraped live — `priceIsIndicative` on each pricing entry reflects this.
- **Personalization/feedback loop**: outcomes aren't yet fed back into the recommendation logic.

---

## Tech stack

- **Framework**: Next.js 16 (Turbopack), React 19
- **AI SDK**: Vercel AI SDK v6 — Anthropic Claude (default), with OpenAI/Fireworks as swappable vendors
- **Vector DB**: Pinecone (evidence retrieval for the explain-mode chat)
- **Persistence**: Postgres (Neon or Vercel Postgres), no login — anonymous cookie-based identity
- **UI**: Radix UI, Tailwind CSS 4
- **Validation**: Zod, end to end from `data/` through the engine to the UI
- **Ingestion**: Python notebook pipeline (Unstructured, vision-model enrichment, Cloudinary image hosting)

---

## Acknowledgment

This project was forked from and builds on [myAI6](https://github.com/dringel/myAI6), a RAG chatbot template by [Daniel M. Ringel](https://www.ringel.ai) — the streaming API pattern, Pinecone parent-child retrieval architecture, and citation-verification pipeline originate there. `app/chat/page.tsx` is kept as a reference implementation of that original general-purpose pattern.

## License

[MIT License](LICENSE), inherited from the myAI6 template (Copyright (c) 2026 Daniel M. Ringel) — please acknowledge use of any or all of this code, per its terms.
