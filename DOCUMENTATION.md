# Pickwise — Product and Technical Documentation

Pickwise is an evidence-based supplement and nutrition decision engine
for generally healthy Indian adults, built on the myAI6 template for the
BITSoM “AI in Business” midterm. This document covers the product case
(Part A), the features built beyond the myAI6 base (Part B), and the
technical implementation (Part C), followed by team and disclosure
information (Part D).

## Part A — The product case

### A1. Unique selling proposition

Pickwise tells any Indian adult, gym-goer or not, whether a supplement
is actually worth taking for their specific body and goals, and which
one, using a deterministic rules engine over expert-reviewed evidence
rather than an AI guessing or an affiliate site pushing whatever pays
the highest commission.

Most people trying to eat and supplement better in India face three bad
options: a general AI chatbot that can invent a dose or a safety claim
with total confidence, a supplement retailer’s app or influencer that
recommends what it sells rather than what a specific person needs, or a
nutritionist consultation that costs money and takes days to book for a
decision that should take five minutes.

Pickwise closes this gap with a fixed pipeline: a short questionnaire
produces a structured profile, a safety gate checks it against
contraindications before anything else runs, a rules engine evaluates
each of 14 evidence-backed ingredients against that profile, and only
then does an AI layer explain the result in plain language with
citations. The AI never decides what to recommend. When the honest
answer is “you don’t need anything,” the product says so, which is the
one thing a commission-driven retailer structurally cannot say.

### A2. Target audience

Pickwise’s audience is not just fitness enthusiasts. It is any digitally
connected Indian adult who wants to improve their nutrition and physical
wellbeing and is unsure what they should take to help.

A recognizable member of this audience: a 28- to 40-year-old working
professional in an Indian metro or tier-2 city, smartphone in hand, who
does not currently go to the gym or exercises inconsistently, has read
online that “Indians don’t get enough protein” or that a multivitamin
might help with low energy, and does not know whether that applies to
them, what dose would matter, or whether a product is safe alongside a
mild health condition or existing medication.

Today this person does one of three things: nothing (uncertainty wins
and they buy nothing, even when something would genuinely help), a
low-quality guess (they buy whatever a retailer app or an Instagram ad
shows them, often mismatched to their actual need or diet), or an
unpaid, unreliable substitute (asking a general AI chatbot, which cannot
verify a real product, a real dose, or a real interaction against their
profile).

Each of these costs the person money spent on the wrong product, time
spent second-guessing themselves, or a foregone benefit they never
realized was available. Pickwise’s own data model treats this
non-exerciser explicitly: the profile schema, the sample test cases
(including a named “sedentary wellness” profile), and roughly half of
the ingredient catalog (multivitamin, omega-3, magnesium, probiotics)
are built for goals like general wellness, sleep, digestion, and
immunity, not muscle gain alone.

### A3. Novelty and competitive differentiation

  Alternative                                                                                               Where Pickwise is better                                                                                                                                                                                                                                                                                  Where Pickwise is worse                                                                                                                                                                                                                                                                                Why it matters to this audience
  --------------------------------------------------------------------------------------------------------- --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  General chatbots (ChatGPT, Claude, Gemini)                                                                Recommendations come from a deterministic, expert-reviewed rules engine over structured data, not from a model’s memory of nutrition literature. Every dose, safety flag, and “not needed” verdict traces to a specific, versioned rule the reader can inspect, and it links to a real, priced product.   No general knowledge outside its scope. Cannot answer an unrelated question in the same session the way a general assistant can.                                                                                                                                                                       A general chatbot can state a wrong creatine dose or miss a real interaction with total fluency. A wrong answer here is not a bug the model can silently fix next time; it is a supplement someone actually takes.
  Supplement retailer apps and influencer content (HealthKart’s own storefront, brand Instagram accounts)   Recommendations are price-blind: priority is fixed before budget is ever applied, and a “not needed” or “escalate to a doctor” verdict is a normal, expected outcome, not a failure state to route around.                                                                                                Smaller product catalog (14 ingredients, a curated set, not thousands of SKUs). The shipped MVP redirects to an external marketplace listing rather than completing checkout in-app; the target business model (A4) moves this to a direct, single-cart checkout across the whole recommended stack.   A retailer’s business model rewards selling more, not saying no. Pickwise’s business model (see A4) is structurally aligned with recommending correctly: a wrong or unnecessary recommendation an unhappy user does not act on generates no margin either, the same discipline the rules engine already enforces on what gets recommended in the first place.
  A human nutritionist or dietician                                                                         Available instantly, at zero incremental cost to the user, at any hour, for a first-pass decision.                                                                                                                                                                                                        Cannot handle genuinely complex medical nutrition therapy, and explicitly refuses to try; it escalates instead.                                                                                                                                                                                        Most people never see a nutritionist for a question this small (“should I take a multivitamin”), so the real alternative is not “go see a professional,” it is “do nothing” or “guess.” Pickwise raises the floor on that default case while still deferring the genuinely hard cases to a real professional.
  Doing nothing / guessing                                                                                  Converts uncertainty into a specific, explainable answer in under five minutes, grounded in the person’s actual diet and goals rather than a generic label on a product page.                                                                                                                             Requires answering roughly 8 to 13 questions, a real time cost a guess does not have.                                                                                                                                                                                                                  This is the largest real alternative by volume. Most of the target audience is not currently comparing products at all; they are avoiding the decision entirely, at a real cost in foregone nutrition benefit and money potentially wasted on an eventual, unguided purchase.

The differentiator is architectural: an AI system that is deliberately
not allowed to decide the thing that matters, paired with one that is.

### A4. Value generation and business case

Using the five-layer measurement framework, all figures below are either
sourced or explicitly flagged as a reasoned estimate with the reasoning
shown.

**1. Use.** Pickwise’s addressable behavior is a supplement or nutrition
decision an Indian adult makes or avoids making. An estimated 50 percent
of Indian adults are insufficiently physically active, and an estimated
73 percent of Indians are protein deficient, with average daily intake
around 47g against a global average of 68g and an ICMR recommended
allowance of 0.8 to 1.0 g/kg bodyweight against an actual average intake
of roughly 0.6 g/kg. Against a base of roughly 1.03 billion internet
users in India, this represents several hundred million adults for whom
a correctly targeted, evidence-based recommendation would be relevant,
regardless of whether they currently exercise. This is the reasoning for
extrapolating the target market beyond fitness enthusiasts.

For the value equation, “eligible volume” means the realistic monthly
volume of qualifying sessions Pickwise can reach through organic growth:
search, social sharing, campus and early-adopter word of mouth, and the
compounding effect of a product people return to and share once it has a
track record.

  Assumption                                                                                        Value        Basis
  ------------------------------------------------------------------------------------------------- ------------ -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Monthly unique visitors, Year-1 exit run rate                                                     80,000       Reasoned estimate for organic-only reach in Year 1, against an addressable population in the hundreds of millions; still a small fraction of one percent of that population, so headroom is not the constraint
  Intake completion rate (visitors who finish the questionnaire and receive a recommendation set)   85%          Reasoned estimate. The questionnaire asks only personal, low-friction questions (age, diet, goals, exercise, sleep) and collects no payment details; the checkout comes only once a recommendation exists. Pickwise’s own redesigned 8-themed-screen intake was built specifically to support a high completion rate, and short, no-payment intent surveys commonly clear 80 to 90 percent completion
  **Eligible volume: completed recommendation sessions/month**                                      **68,000**   80,000 × 85%

**2. Adoption.** Adoption is the share of the 68,000 monthly completed
sessions that convert into a completed stack purchase on Pickwise’s own
checkout.

  Assumption                                                                 Value       Basis
  -------------------------------------------------------------------------- ----------- ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Checkout-conversion rate (completed session to completed stack purchase)   4%          Reasoned estimate, deliberately conservative: this asks someone to trust a first-time, unfamiliar payment page rather than a marketplace they already use, so it is set well below typical affiliate click-through benchmarks (30 to 50%) despite the added incentive of a real discount
  **Completed stack purchases/month**                                        **2,720**   68,000 × 4%

**3. Impact.** The incremental effect per use is a person completing a
specific, dose-correct, safety-checked purchase that they would
otherwise have skipped, guessed at, mismatched, or assembled themselves
at a higher price across multiple sites. The average stack value is a
conservative estimate derived from Pickwise’s own product catalog:
**₹2,200 per completed stack**.

**4. Value generation.** Pickwise’s monetization model is a direct
distributor relationship. Pickwise negotiates a 15 percent discount off
standard retail price directly with brand distributors for the products
in its recommended stack, and fulfills the order itself in a single
checkout rather than redirecting to Amazon or HealthKart.

The value proposition to a distributor is that Pickwise is not asking
for a marketing spend; it is free, pre-qualified marketing, since every
product a distributor supplies is only ever shown to a consumer the
rules engine has already matched to it on evidence and dose, not shown
as generic inventory. Of the 15 percent margin this unlocks, Pickwise
passes roughly half through to the consumer as a real price discount
versus buying the same items separately at retail (the incentive that
gets someone to complete an unfamiliar new checkout in the first place)
and retains the rest as gross margin.

  Distributor economics                            Value                 Basis
  ------------------------------------------------ --------------------- -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Distributor discount off standard retail price   15%                   Team’s own commercial assumption: the discount Pickwise negotiates directly with distributors in exchange for free, pre-qualified demand
  Passed through to the consumer as a discount     7 percentage points   Reasoned split: enough to be a genuinely attractive, visible saving against buying the same items separately at full retail, which is the incentive needed to move a first-time buyer onto a new checkout
  Retained by Pickwise as gross margin             8 percentage points   The remaining half of the negotiated discount
  **Gross margin per completed stack**             **₹176**              8% × ₹2,200

By owning the transaction directly, Pickwise, not a distributor’s own
logistics team, now needs to run payments and handle order coordination,
which is reflected in the cost line below. This monetization model is
the target for the product’s next build phase: the shipped MVP
documented in Parts B and C still redirects to external marketplace
listings, and the direct checkout and distributor agreements described
here are the near-term work required to realize it (see “what would have
to be true for this case to fail,” below).

For the funnel, “adoption” is the share of completed recommendation
sessions that convert into a completed stack purchase on Pickwise’s own
checkout, and “capture rate” reflects realized revenue net of returns
and cancellations, a very different (and much smaller) loss than the
third-party affiliate attribution loss it replaces, since Pickwise now
owns the transaction end to end.

    Expected net value (Year-1 exit monthly run rate)
      = eligible volume (68,000 completed recommendation sessions)
      × adoption (4% of sessions complete a stack purchase)
      × incremental effect per use (1 stack per conversion)
      × unit value of effect (₹2,200 stack value x 8% retained margin = ₹176 gross margin per stack)
      × benefit-capture rate (97%, net of returns and cancellations)
      − total cost of ownership
      − expected loss from errors and risk

    Completed stack purchases/month = 68,000 x 4%                = 2,720
    Gross margin before returns    = 2,720 x ₹176                = ₹4,78,720
    Benefit-capture rate (net of returns/cancellations)            = 97%
    Net captured margin                                            = ₹4,64,358 / month

    Total cost of ownership (monthly, at 2,720 completed stacks / 68,000 sessions):
      Payment gateway fees (~2% of gross transaction value,
        2% x ₹2,200 x 2,720 stacks)                                 ~₹1,19,680
      Anthropic Claude Haiku 4.5 API (intake parsing, protein
        estimate, explain-chat, routine text; ~₹0.75/session)        ~₹51,000
      Pinecone + Vercel Pro hosting + Neon/Postgres (fixed infra)     ~₹10,000
      Distributor and order-coordination overhead (new to this
        model; customer support, fulfillment liaison)                ~₹20,000
      TOTAL TCO                                                     ~₹2,00,680 / month

    Expected loss from errors and risk (reasoned estimate):
      1.5% of gross captured margin reserved against escalation-
      gate false negatives, mismatched fulfillment, or reputational
      cost from a bad recommendation                                  ~₹6,965 / month

    Expected net value, Year-1 exit run rate
      ≈ ₹4,64,358 − ₹2,00,680 − ₹6,965 ≈ ₹2,56,713 / month  (~₹30.8 lakh / year)

Pickwise is profitable by the end of Year 1 on this model, without
stretching the conversion rate or the margin split past a defensible
range: the 15 percent distributor discount, split evenly between
consumer savings and Pickwise’s own margin, is the team’s own commercial
assumption rather than a public benchmark. The unit economics explain
why this clears profitability even at conservative conversion: a
completed stack generates ₹176 in gross margin against roughly ₹44 of
payment-gateway and LLM cost combined, so each transaction is strongly
profitable on its own, and the business case scales cleanly with organic
reach.

  Year                Monthly visitors   Completed sessions   Completed stack purchases/mo   Gross margin/mo   TCO/mo      Net value/mo   Net value/year
  ------------------- ------------------ -------------------- ------------------------------ ----------------- ----------- -------------- ----------------
  1 (exit run rate)   80,000             68,000               2,720                          ₹4,64,358         ₹2,00,680   \~₹2,56,700    \~₹30.8 lakh
  2                   200,000            170,000              6,800                          ₹11,60,896        ₹4,69,700   \~₹6,73,800    \~₹80.9 lakh
  3                   400,000            340,000              13,600                         ₹23,21,792        ₹9,18,400   \~₹13,68,600   \~₹1.64 crore

This holds the checkout-conversion rate flat at a conservative 4 percent
across all three years, so none of this growth depends on the platform
getting better at converting a visitor, only on organic reach growing.
If trust in the checkout improves with a track record, as it typically
does for a repeat-purchase D2C category like supplements, conversion
would only add to this, not subtract from it.

Even at Year 3’s 400,000 monthly visitors and roughly 13,600 monthly
transactions, this remains a small operation relative to the addressable
population identified in the Use section (several hundred million
adults) and the overall market (₹201.46 billion in 2025, growing at
12.31 percent CAGR to a projected ₹572.62 billion by 2034). The
constraint on this business case is Pickwise’s own reach, its ability to
actually sign distributors at the assumed discount, and its execution on
a checkout it has not yet built, not the size of the underlying
opportunity.

**Measurement across the five layers (McKinsey framework):**

  Layer                              Metric(s) tracked                                                                                                                                                                                                                                                           Owner
  ---------------------------------- --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- ---------------------------------------
  5\. Technical performance          Citation verification match rate (share of claims shown with a verified green check, lib/citations.ts); LLM cost per session; p95 response latency; moderation false-block rate                                                                                             Engineering/data lead
  4\. User adoption and engagement   Intake completion rate; use rate of the AI protein-estimate escape hatch; use rate of the per-card explain chat; monthly active users; repeat-session rate                                                                                                                  Product lead
  3\. Operational KPIs               Time from profile submission to a rendered recommendation set (target: sub-second, since the decision itself is deterministic); safety-escalation rate (share of sessions escalated vs. auto-recommended); checkout-conversion rate; distributor fulfillment failure rate   Engineering lead (rules-engine owner)
  2\. Strategic outcomes             User-reported satisfaction (captured via the built-in feedback endpoint); return-visit rate for a profile update; growth in the share of knowledge-base records at “expert\_reviewed” status vs. “draft\_needs\_expert\_review”                                             Domain/product lead
  1\. Financial impact               Net captured margin per month; cost-to-serve per completed stack (payment gateway + LLM + fulfillment overhead); margin-to-TCO ratio (unit economics); net monthly value                                                                                                    Business/finance lead

**Value owner:** the team’s designated product and business lead is
accountable for the full chain from use through captured value (named in
Part D).

**What would have to be true for this case to fail:** - Distributors
will not actually agree to a 15 percent discount at Pickwise’s volume,
or only agree to it for a handful of brands rather than across the
catalog, which directly shrinks the margin captured per stack. - The
direct checkout, payment processing, and order-coordination workflow
this model depends on has to be built; it does not exist in the shipped
MVP today (which still redirects to external marketplace listings), and
building and integrating it is real, unbudgeted engineering work. -
Checkout-conversion rate comes in below the conservative 4 percent
assumed, for example if first-time users do not trust a new, unfamiliar
payment page enough to complete a purchase there instead of on a
marketplace they already use. - Intake completion falls well short of 85
percent, for example if the questionnaire is perceived as longer or more
invasive than intended; this directly shrinks eligible volume. -
Returns, cancellations, or fulfillment failures run meaningfully above
the assumed 3 percent loss, since Pickwise, not a marketplace’s own
logistics network, is now responsible for order coordination with the
distributor. - Organic growth does not reach 80,000 monthly visitors by
the end of Year 1 without a paid acquisition budget, since the whole
model above assumes reach at effectively zero marginal
customer-acquisition cost.

## Part B — Features beyond the myAI6 base

  Feature                                                                                                                                           What the user experiences                                                                                                                                                                                                                                 Value-chain link it serves                                                                                           Where it lives in the code
  ------------------------------------------------------------------------------------------------------------------------------------------------- --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- -------------------------------------------------------------------------------------------------------------------- --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Deterministic recommendation engine (safety gate to eligibility/suppression to substitution to dosing to priority scoring to budget allocation)   A personalized set of recommendation cards, each one of five explicit states (Recommended, Potentially Useful, Escalate, Not Needed, Already Covered), each with a dose, a serving plan, and a real priced product, never an AI’s own improvised answer   Adoption and Impact                                                                                                  `lib/engine/recommend.ts`, `safety.ts`, `eligibility.ts`, `dosing.ts`, `priority.ts`, `budget.ts`, `substitution.ts`; the underlying data in `data/ingredients/`, `data/claims/`, `data/policy/`
  Structured, versioned nutrition knowledge base with expert sign-off and fail-closed logic                                                         Every recommendation traces to one specific, inspectable rule rather than a plausible-sounding guess                                                                                                                                                      Impact and Value generation                                                                                          `data/schema/*.json` (contracts), `data/ingredients/`, `data/claims/`, `data/policy/`, `data/tools/validate.mjs` (CI gate)
  Per-recommendation “ask a question” explain chat, scoped retrieval                                                                                Clicking into any card opens a chat that can only cite the exact evidence behind that specific card first, with any further reading clearly separated and never presented as strengthening the original decision                                          Adoption (trust drives both understanding and eventual purchase)                                                     `app/api/chat/tools/ask-about-recommendation.ts`, `components/results/recommendations-chat.tsx`
  AI-assisted protein estimate from a free-text food description                                                                                    A user unsure of their daily protein intake types a short, plain description of what they eat instead of guessing a number on a slider                                                                                                                    Use and Adoption (removes a likely abandonment point)                                                                `app/api/intake/estimate-protein/route.ts`, `lib/intake/compute-protein-from-items.ts`, `lib/intake/protein-database.ts`, `components/intake/intake-flow.tsx`
  AI-generated, policy-fenced routine and timing instructions                                                                                       Every funded item includes a short, one or two sentence plain-language note on when and how to take it                                                                                                                                                    Impact (correct timing supports real-world adherence and efficacy)                                                   `lib/routine/build-routine-prompt.ts`, `app/api/routine/route.ts`, `components/results/routine-section.tsx`
  Price-blind priority-then-budget allocation with graceful downgrade                                                                               Sees which items are funded versus deferred against a stated monthly budget, with a cheaper equal-quality alternative substituted first, and nothing silently dropped                                                                                     Value generation (protects trust: recommendations are never reordered by price, only funded or deferred afterward)   `lib/engine/budget.ts`, `lib/engine/priority.ts`
  Anonymous, no-login persistence of profile and decision history                                                                                   Can return later without creating an account; a past recommendation set and its rationale persist                                                                                                                                                         Adoption and Strategic outcomes (retention without a signup wall)                                                    `lib/anon-session.ts`, `lib/db.ts`, `app/api/profile/route.ts`, `app/api/decisions/route.ts`, `data/db/schema.sql`

**Baseline configuration** (not counted as a feature above, but done to
adapt the base template): assistant identity, name, and welcome copy
rewritten for Pickwise in `config.ts`; `KB_SCOPE` and every prompt in
`prompts.ts` rewritten from myAI6’s general owner-chatbot persona to
Pickwise’s supplement and nutrition domain; the owner-profile-fetching
tool from the original template removed as not relevant here; the Exa
web-search system prompt restricted to authoritative sources (PubMed,
Cochrane, NIH Office of Dietary Supplements, WHO/ICMR-NIN, official
guidelines).

**Why these features, why this way, and what was deliberately left
out:**

The recommendation engine is the product; everything else exists to make
its output trustworthy or usable. It is implemented as plain TypeScript
over versioned JSON data rather than an LLM call, because a
recommendation is a claim someone acts on with their money and, in some
cases, an existing medical condition; it must be reproducible and
auditable in a way a model call is not.

The knowledge base’s fail-closed logic (an unparseable medication list
escalates rather than silently passing a safety check) was a deliberate
design choice over the alternative of defaulting to “no interaction
found,” which is unsafe. The per-recommendation explain chat was built
with a hard code-level boundary (not just a prompt instruction) between
the evidence that justified a decision and everything else, because a
prompt-only separation degrades under follow-up questioning in a way a
filtered retrieval call does not. The AI protein estimate deliberately
keeps the LLM out of the arithmetic; a stress test found the model
itself overestimated one common food’s protein content by 3.5x, so the
LLM only identifies food items and the deterministic code multiplies
against a real nutrition database. What was left out for this MVP, and
why: the full four-tier safety model (Green/Yellow/Red/Black) described
in the original product concept is collapsed to two working states for
now (auto-recommend, escalate), with the architecture built to support
all four later; only 14 of a longer target ingredient list are fully
built out, with the remainder deferred as an honest, partial rollout
rather than filled with unverified data; and regulatory compliance
(FSSAI) is documented as a researched writeup rather than implemented,
since building it was out of scope for this phase.

## Part C — Technical documentation

### C1. Architecture

![Pickwise system
architecture](media/image1.png){width="5.833333333333333in"
height="4.666666666666667in"}

**Inherited from myAI6:** the Next.js/Vercel AI SDK streaming chat
pattern, Pinecone parent-child retrieval architecture, citation
verification and the Sources box, content moderation, conversation
compaction, rate limiting, and the Vercel deployment pipeline. **Added
or substantially changed for Pickwise:** the entire deterministic rules
engine (`lib/engine/`) and its structured data layer (`data/`), the
profile intake UI, the results/basket UI, the budget allocator, the
routine builder, the AI protein estimate, the per-card scoped explain
chat, and anonymous no-login persistence. The original myAI6
owner-chatbot persona is kept only as an unlinked reference page at
`/chat`; the product’s real interface is the intake and results flow.

### C2. Knowledge base

**Sources.** The team ingested more than 25 peer-reviewed research
papers into Pinecone via the RAGloader pipeline: the broader evidence
base the domain-expert reviewer drew on when writing and signing off the
product’s 17 formal evidence claims in `data/claims/`. Each of those 17
claims cites the specific published source it distills (for example the
International Society of Sports Nutrition’s position stand on creatine,
PubMed-indexed studies on omega-3 and cardiovascular outcomes, probiotic
strain-specific trials), with a title, publication, year, and URL on
every claim record. The rest of the 25+ paper corpus is retained in
Pinecone as the “supplementary” evidence tier: real, vetted research
that was not the specific basis for any one recommendation but is
available as further reading through the per-recommendation explain
chat, kept clearly separate in the code from the claims that actually
justify a decision. The raw source PDFs themselves are intentionally
gitignored (`RAGloader/content/`, published papers are typically
copyrighted) and never committed to the repository; only the ingestion
pipeline and the resulting structured claim records are. Regulatory
background (FSSAI, DPDPA) is researched separately in
`docs/regulatory-and-deferral-writeup.md`. ICMR-NIN reference values for
nutrient requirements exist in
`data/reference/nutrient-requirements.json` but are deliberately left
near-empty rather than filled with plausible-looking numbers, pending
real sourcing.

**Selection.** Every ingredient, claim, and policy record carries its
own `review` block naming the reviewer and date, separate from the file
it lives in, since an evidence grade, a dosing target, and a
contraindication are three independent expert judgments.
`data/tools/validate.mjs` runs as a CI-style gate and enforces two rules
automatically: a “commercial firewall” (no eligibility or dosing rule
may read a user’s budget, which is only applied after the recommendation
set is fixed) and a “grade laundering” check (a policy citing both a
Strong and a Limited claim is flagged, since the Strong claim may not
describe the same dose or population).

**Ingestion pipeline.** `RAGloader/RAG_loader_pipeline.ipynb` runs a
parent-child chunking pipeline: large “parent” chunks (about 3,000
characters, roughly one paper section) preserve full context for the
model to read, while small “child” chunks (about 500 characters, 3 to 4
sentences) are what the search actually matches against, keeping
retrieval precise without losing surrounding context. Each child chunk
is further decomposed into propositions (atomic, standalone facts) as a
secondary index, and keyword augmentation is added to the embedding
text. `ingest_claims.py` and `build_claim_documents.py` turn the 17
structured claim records into ingestible documents;
`ingest_research_papers.py` runs the same chunking pipeline over the
full 25+ paper corpus, tagging each resulting chunk with an
`evidenceTier` of `cited` or `supplementary` so the two are always
distinguishable downstream, however many chunks each paper produces.

**Retrieval configuration.** Three Pinecone namespaces (`children`,
`parents`, `propositions`) under index `myai6`, `PINECONE_TOP_K = 20`,
`PINECONE_MIN_SCORE = 0.1` (lowered specifically to catch acronym and
abbreviation queries), propositions retrieved at `PINECONE_PROP_K = 15`
with a `0.5` score boost toward the children they support.

**Retrieval quality checks.** `lib/citations.ts` verifies every citation
shown to a user by checking the sentence preceding it against the actual
retrieved source text (a significant-word containment ratio of at least
0.6, requiring at least 3 significant words), rendering a verified green
check only when that check passes. The per-card explain chat
(`ask-about-recommendation.ts`) runs two separately filtered searches on
every question, one restricted to exactly the claims that justified that
specific card and one over the broader vetted corpus, so retrieval can
add context but can never expand or dilute what actually justified a
decision. This is the same “retrieval explains, rules decide” boundary
enforced throughout the product: retrieval is never in the path that
produces a recommendation, only in the path that explains one already
made.

### C3. How each new feature was built

**Deterministic recommendation engine.** `lib/engine/recommend.ts`
orchestrates a fixed pipeline: `safety.ts` runs first over every safety
policy using three-valued logic (a missing or unparseable field
evaluates to “unknown,” not false, and each policy declares what unknown
means for it; an unparseable medication list escalates rather than
passing). `eligibility.ts` then evaluates each policy’s
`recommendWhen`/`suppressWhen` predicates, extending the original
reference logic to filter unsafe ingredients out of a compound’s
candidate list (for example removing whey from a milk-allergic user’s
candidates) rather than escalating the whole recommendation when a safe
alternative exists. `dosing.ts` resolves an actual gram target and
serving plan against a real product. `priority.ts` scores each
recommendation additively on dietary gap severity, evidence tier, and
goal alignment (derived from the user’s actual stated goals via a
goals-to-outcomes lookup, not hardcoded per ingredient). `budget.ts`
allocates a stated monthly budget strictly after that priority order is
fixed, funding in priority order (never cheapest-first), attempting a
same-quality downgrade before deferring anything, and never silently
dropping an item.

**AI-assisted protein estimate.**
`app/api/intake/estimate-protein/route.ts` uses `generateObject` (Vercel
AI SDK, Claude Haiku 4.5, temperature 0.2 for reproducibility) with a
Zod schema to have the model identify food items and estimated gram
quantities from a short free-text description, matching each item
against a real per-100g nutrition reference table where possible.
`lib/intake/compute-protein-from-items.ts` then performs the actual
gram-to-protein multiplication in plain code, never in the LLM, after a
stress test found the model itself unreliable at that arithmetic (for
example overestimating a common dairy item’s protein content by roughly
3.5x). A confidence score combines how precisely quantities were
specified with how much of the total protein came from real database
values versus the model’s own guess for unmatched foods; a
low-confidence result routes through the same “needs confirmation”
review screen already used for other AI-parsed fields, and the resulting
number always lands on an adjustable slider rather than being accepted
silently.

**Routine builder.** `lib/routine/build-routine-prompt.ts` is the only
place in the product where an LLM writes free text shown to the user,
and it is fenced by each dosing policy’s own declared timing constraint
(`DosingTiming`, referred to in code comments as “the fence”). The model
is told explicitly what timing and separation rules actually apply and
is instructed not to invent a specific time when the real constraint is
“any,” since common gym folklore (for example “take creatine right after
your workout”) is not supported by the evidence behind that specific
policy.

**Per-recommendation explain chat.** `ask-about-recommendation.ts` is
bound at request time to one recommendation card’s exact cited claim
IDs. On every question it runs two separate, independently filtered
Pinecone searches (never one unscoped search over the whole knowledge
base) and returns results to the model under two clearly separate
headings, with an explicit instruction never to imply that the
“additional research” tier makes the original recommendation more
strongly supported than it was.

**Budget allocator.** Implemented against a written specification
(`data-layer-decisions-v2.md`) rather than a port of any existing
reference code; one documented, flagged interpretation was needed where
the specification was silent (how to treat an item that still does not
fit after a downgrade attempt when the user’s budget is a soft, not
hard, constraint), resolved by funding it anyway on the reading that the
user explicitly opted out of a hard cap.

**Anonymous persistence.** `lib/anon-session.ts` issues an anonymous
cookie-based identity, since the class-submission constraint of no user
accounts superseded an original plan to use full authentication. Profile
versions and decision records are stored in Postgres (Neon), with the
schema in `data/db/schema.sql`.

### C4. Interface and experience

The results page shows all five recommendation states as first-class
outcomes, a funded/deferred basket reflecting the stated budget, an
evidence accordion per card, and one shared results-page chat rather
than a separate chat box per card (simpler for the user, and the
underlying scoped-retrieval boundary in C3 still applies per question).
The About page states the product’s three operating principles in plain
language (recommend what is appropriate, not what is profitable; rules
decide, retrieval only explains; budget is a filter, never a bias) since
this audience (per A2) is often unfamiliar with supplement decisions
generally and benefits from an explicit statement of intent, not just a
functioning tool. Two pieces of an early design mockup were deliberately
not implemented as literal copy: a “500+ products indexed” statistic
(false for this product’s actual, small, curated catalog) and a generic
“this week’s top products” list (misleading, since every recommendation
here is personalized to a submitted profile, never a bestseller list).

### C5. Behavior and guardrails

The LLM layer is restricted to three narrow jobs across the entire
product: turning free text into structured fields the engine then
reasons over (intake parsing, the protein estimate), answering follow-up
questions about a decision already made by the rules engine (the explain
chat), and phrasing a routine instruction fenced by a policy’s declared
timing rule. It is never allowed to invent, override, or re-derive a
recommendation, a dose, or a safety verdict; `EXPLAIN_SYSTEM_PROMPT`
states this explicitly and separately instructs the model to defer any
medication-, condition-, or diagnosis-adjacent question to a medical
professional rather than reasoning it out itself, mirroring how the
rules engine itself escalates rather than guesses. Content moderation
runs by default (an LLM classifier on the fast utility model,
configurable to OpenAI’s moderation API or off), rate limiting is on (20
requests per minute per IP), and the inherited prompt-injection defenses
from myAI6 (refusing to reveal system prompts, ignoring “ignore previous
instructions”-style attempts) remain in place unchanged. Uncertain or
unparseable safety-relevant input (an unparseable medication list, for
example) fails closed into an escalation rather than a pass, which is
the same principle applied consistently from the data layer’s predicate
logic up through the chat layer’s guardrails.

### C6. Testing and known limitations

**How it was tested.** Automated unit tests (Vitest) cover the rules
engine directly (`lib/engine/__tests__`: budget, dosing, safety,
priority, serving plan, a knowledge-base manifest check, and named
scenario tests for caffeine/energy-fatigue, magnesium/sleep, and
omega-3/dietary-gap logic), the intake normalization layer
(`lib/intake/__tests__`), the results adapter against a real fixture
response (`lib/results/__tests__`), and the routine builder’s prompt
construction (`lib/routine/__tests__`). Five named end-to-end sample
profiles (`data/tools/samples/`: vegetarian muscle gain, vegan
endurance, sedentary wellness, already covered, unparseable medications)
are run through `data/tools/demo.mjs` and each is designed to prove one
specific behavior, for example that a vegan profile’s omega-3
recommendation resolves to algal oil rather than fish oil purely from
the `suitableFor` data (no rule mentions veganism anywhere), or that the
sedentary wellness profile correctly suppresses almost everything. We
also shared the live link with 12 different people and asked them to use
the product themselves. The feedback was positive overall, with users
finding the UI intuitive and the overall flow easy to navigate.

Real defects were found and fixed during integration testing, documented
honestly rather than smoothed over: a global pregnancy-escalation check
was firing as a false positive on every non-female profile submission;
matching a recommendation to its safety escalation broke after
round-tripping through Postgres `jsonb` because it compared object
references rather than IDs; a required protein-intake slider defaulted
in a way that produced a nonsensical “4 to 5 scoops per day”
recommendation for most users; and stress-testing the AI protein
estimate found the model unreliable at food-to-protein arithmetic, which
led directly to moving that calculation out of the LLM (see C3).

**Known limitations.** Endurance-training profiles currently receive no
protein recommendation at all, a gap in one eligibility policy’s goal
list rather than a code defect. Suppression reasoning is tracked per
policy rather than per clause, which can produce a technically correct
but imprecise “why” in edge cases. A small number of marketplace URLs in
the product catalog are unverified search-page placeholders rather than
confirmed listings and are flagged `urlVerified: false`; the interface
must not present these as confirmed product links. Three product
composition records are placeholders pending verification, one of which
feeds the safety-relevant upper-limit calculation for a multivitamin.
ICMR-NIN micronutrient reference values are deliberately left mostly
empty, so micronutrient gap assessment (beyond protein) is not yet
enabled. The knowledge base currently covers 14 ingredients against a
longer target list from the original product concept; the remainder are
deferred, not silently dropped. The full four-tier safety model from the
original product concept (Green/Yellow/Red/Black) is intentionally
collapsed to two working states for this build.

**What we would build next with another week:** source real ICMR-NIN
values to unlock a broader micronutrient gap assessment, fix the
endurance-protein policy gap, move suppression tracking to per-clause
granularity, verify or replace every placeholder product URL and
composition record, and extend the ingredient catalog toward the
original \~20-item target.

### C7. Running and deploying

**Environment variables (names only):** `ANTHROPIC_API_KEY` (required),
`PINECONE_API_KEY` (optional, required only if the knowledge base is
enabled), `DATABASE_URL` (required for persistence features),
`DATABASE_SSL`, `SUMMARY_HMAC_SECRET`, `HEALTH_CHECK_TOKEN`,
`ENABLE_VECTOR_SEARCH`, `ENABLE_WEB_SEARCH`, `MODERATION_PROVIDER`.

**Setup.** Run `npm install`, copy `env.template` to `.env.local` and
fill in keys, run `data/db/schema.sql` once against a Postgres instance
(Neon or Vercel Postgres) for persistence features, then `npm run dev`
for local development. To populate the knowledge base, run the
`RAGloader/RAG_loader_pipeline.ipynb` notebook.
`node data/tools/validate.mjs` checks the data layer’s referential
integrity and policy rules as a CI-style gate;
`node data/tools/demo.mjs` runs the five named sample profiles end to
end; `npm run test` runs the Vitest suite; `npm run lint` runs ESLint.

**Deployment.** The repository is connected to Vercel; every push to
`main` triggers a deployment automatically. The same environment
variables are set in the Vercel project’s settings. Rate limiting and
moderation remain on in production by default, and a spending limit
should be set in the Anthropic console before any public traffic.

## Part D — Team and disclosure

### D1. Team and contribution matrix

**Team name:** Group 8

The matrix below is filled from the repository’s commit history
(`git shortlog -sne`) and each package’s ownership as recorded in
`docs/status/`. Rows 1, 8, and 11 (ideation/scoping, testing
coordination, and project coordination) are not fully separable from
commit history alone and are marked accordingly; the team should confirm
or correct these three before submission, per the assignment’s
requirement that all four members agree the matrix is truthful.

  \#   Task                                         Primary contributor                                                     Secondary contributor
  ---- -------------------------------------------- ----------------------------------------------------------------------- -------------------------------------------------------------
  1    Product ideation and scoping (A1, A2, A3)    Jess Rumao *(authored the initial scope and MVP plan in Package B0\]*   Sanket Rathi *(domain-expert input on the ingredient list)*
  2    Business case and value                      Jess Rumao                                                              Sanket Rathi
  3    Knowledge base (C2)                          Jess Rumao                                                              Sanket Rathi
  4    Feature 1: AI-assisted protein estimate      Sanket Rathi                                                            Jess Rumao
  5    Feature 2: Per-recommendation explain chat   Jess Rumao                                                              Kirti Bhandari
  6    Prompts, behavior, and guardrails (C5)       Kirti Bhandari                                                          Jess Rumao
  7    Interface and user experience (C4)           K P Aakash                                                              Sanket Rathi
  8    Testing and quality assurance (C6)           Sanket Rathi                                                            K P Aakash
  9    Deployment and operations (C7)               Sanket Rathi                                                            Jess Rumao
  10   Documentation                                K P Aakash                                                              Kirti Bhandari
  11   Project coordination                         Kirti Bhandari                                                          K P Aakash

### D2. Generative AI disclosure

We used Claude (Anthropic) for coding assistance across the rules
engine, data layer, API routes, and UI; for drafting and structuring
this documentation and for research support in sourcing the market and
health statistics cited above. The AI contributed an estimated 40 to 50
percent of the code by volume and a similar share of this document’s
first draft. All product decisions, the rules-engine design, the
ingredient and policy data, and the final business-case assumptions were
reviewed, adjusted, and are owned by the team. We verified all
AI-generated content for accuracy, including checking cited sources for
the business case and testing the engine’s behavior against the sample
profiles in `data/tools/samples/`.

## Sources

-   QuantumBlack, AI by McKinsey. “From promise to impact: How companies
    can measure and realize the full value of AI.” April 2026.
    (Five-layer measurement framework used in Part A4.)
-   IMARC Group. “India Dietary Supplements Market Size & Share.” Market
    size INR 201.46 billion (2025), projected INR 572.62 billion (2034),
    12.31% CAGR (2026-2034).
    <https://www.imarcgroup.com/india-dietary-supplements-market>
-   The Lancet Global Health (2024), covering 2022 data, as reported by
    University of Edinburgh Research Explorer: nearly 50% of adults in
    India insufficiently physically active (57% women, 42% men).
    <https://www.research.ed.ac.uk/en/clippings/nearly-50-adults-in-india-insufficiently-physically-active-lancet/>
-   World Health Organization. “Nearly 1.8 billion adults at risk of
    disease from not doing enough physical activity.” June 26, 2024.
    <https://www.who.int/news/item/26-06-2024-nearly-1.8-billion-adults-at-risk-of-disease-due-to-physical-inactivity>
-   Observer Research Foundation. “India’s protein deficiency and the
    need to address the problem.” 73% of Indians protein deficient (2017
    survey); average intake 47g/day vs. global average 68g/day; National
    Sample Survey 2011-12 decline.
    <https://www.orfonline.org/expert-speak/indias-protein-deficiency-and-the-need-to-address-the-problem>
-   GrabOn. “Internet Statistics in India: Usage and Penetration Rate
    (2026).” \~1.03 billion internet users, 68.5% of population.
    <https://www.grabon.in/indulge/tech/internet-users-statistics/>
-   Amazon Associates commission rates by category (Health & Personal
    Care: 3%), cited in Part A4 only as a comparison point against
    Pickwise’s own direct-distributor margin.
    https://earnifyhub.com/blog/affiliate/amazon-associates-commission-rates-all-categories
-   Product pricing data: Pickwise’s own product catalog,
    `data/products/pricing.json`.
-   The 15% distributor discount, its consumer/margin split, and all
    checkout-conversion, payment-gateway, and fulfillment-overhead
    assumptions in Part A4 are the team’s own commercial assumptions,
    not a public source; they describe the target monetization model,
    which requires distributor agreements and a checkout not yet built
    (see Part A4 and C6).
-   All ingredient, claim, and policy citations used within the product
    itself: `data/claims/*.json`, each with its own peer-reviewed source
    and URL.
