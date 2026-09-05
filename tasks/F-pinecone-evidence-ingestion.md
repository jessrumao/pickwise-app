# Package F — Pinecone Evidence Ingestion & Retrieval

**Owner:** Sanket (or a parallel chat). **Independent of B0's types** — only needs the app repo to exist (myAI6 cloned in). Can run fully in parallel with B, C, D, E, G.

## The one thing to keep straight

Pinecone's job here is **narrower than in myAI6's original design**. It retrieves cited evidence *text* to display under "Why am I seeing this" — it does not decide anything, and it is only ever queried **after** a recommendation decision has already been made by the rules engine (Package B). Retrieval never reaches the decision. If anything in this package starts influencing what gets recommended rather than how it's explained, that's out of bounds.

## What to ingest

Content changes completely from myAI6's original "owner" framing to the ~20-item ingredient knowledge base:
- `data/claims/*.json` — the evidence records (currently 10; more will land from Package A over time). Each has real citations (paper/guideline + link).
- Whatever underlying paper/guideline text or abstracts Package A sources for those citations.

Use the existing pipeline: `RAGloader/RAG_loader_pipeline.ipynb` (in the cloned myAI6 repo — see Package B0) and its supporting `myAI5_RAG.py`. Ingest per-ingredient or per-citation, `content_type: research_paper` for most of it. Keep the existing **3-namespace parent-child architecture** (`children` ~500 char chunks for relevance search, `propositions` atomic factual statements for score boosting, `parents` ~3000 char rich context fetched on demand) — it's directly reusable, just repointed at new content.

## What to strip / rewrite

- `fetchOwnerProfiles` and any live-owner-profile-fetch tool call — not relevant here, should already be gone if Package B0 did its job; flag it if it isn't.
- `KB_SCOPE` and the "personal chatbot about an owner" prompt framing in `config.ts`/`prompts.ts` — needs to be rewritten for the nutrition/supplement domain. Coordinate with whoever's building the actual query/explanation flow (this may end up being your responsibility if no one else claims it — check with Sanket) since the prompt rewrite and the retrieval rewrite are tightly coupled.

## What's directly reusable, don't rebuild

- Citation verification / Sources box (`components/messages/sources.tsx`, `lib/citations.ts`, citation canonicalization/renumbering) — works as-is for showing evidence with checkmarks under a recommendation card.
- Moderation, rate limiting, streaming pattern — leave on, low effort, not this package's concern.

## Retrieval endpoint

Build (or repurpose) an endpoint/tool that, given a compound/ingredient + the claim IDs a policy cited (from Package B's trace), fetches and returns the relevant evidence prose + citation for display. This is what Package E's "Why?" expandable calls.

## Grade-laundering awareness

Worth knowing even though it's Package B/A's rule to enforce, not yours to build: a policy may cite only a subset of available claims for a compound on purpose (e.g. `elig-epa-dha-general` cites only the Limited general-population claim, not the Strong triglyceride-specific one, because that Strong claim describes a different outcome). When you build the "Why?" retrieval, **surface only the claim(s) the policy actually cited**, not every claim that exists for that compound — otherwise you'll show evidence that looks stronger than what actually justified the recommendation.

## Deliverable / done-when

The claims currently in `data/claims/*.json` are ingested into Pinecone in the 3-namespace structure, and a retrieval call for a given claim ID returns the right evidence prose + citation. `KB_SCOPE`/prompts no longer reference the old owner-chatbot framing.
