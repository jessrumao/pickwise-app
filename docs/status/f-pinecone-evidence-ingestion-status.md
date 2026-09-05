# Package F status — Pinecone evidence ingestion & retrieval (2026-09-05)

Replaces Package E's interim stub (a direct `claimById.get(claimId).statement`
read) with real Pinecone-backed retrieval, wired the way
`tasks/F-pinecone-evidence-ingestion.md` and `types/engine.ts`'s
`Claim.vectorRefs` comment specify: **retrieval is a metadata/id lookup on
`vectorRefs`, never an open semantic search**, and it only ever runs after
Package B's rules engine has already produced a recommendation — it explains
a decision, it never makes one.

## What's built and tested (works today, no credentials needed)

- `RAGloader/build_claim_documents.py` — pure local transform, no creds.
  Reads every `data/claims/*.json` and writes a clean markdown document to
  `RAGloader/content/claims/<claim-id>.md` (statement, grade rationale,
  citations). Already run once; all 17 current claims have a generated doc
  committed under `RAGloader/content/claims/`. Re-run whenever Package A
  edits a claim's statement/citations, before re-ingesting.
- `lib/evidence.ts` — `getEvidenceForClaim(s)`. Precedence: a citation's
  `pinnedQuote` (exact text, zero drift) > fetching the claim's `vectorRefs`
  by id from the Pinecone `parents` namespace > the claim's own one-line
  `statement` (today's behavior for every claim, since none are ingested
  yet — see below). Never invents a claim: an unknown id returns `null`
  and is silently dropped from a batch.
- `app/api/evidence/route.ts` — `POST { claimIds: string[] }` →
  `{ evidence: EvidenceItem[] }`. This is what Package E's "Why?" expandable
  now calls.
- `components/results/evidence-accordion.tsx` — replaces the inline
  accordion Package E had in `recommendation-card.tsx`. Fetches
  `/api/evidence` lazily, only when the panel is first opened, only for the
  claim ids the caller passes (`policy.citesClaims` — never every claim for
  a compound, per the grade-laundering note below). On any fetch failure
  (offline, Pinecone unreachable, ingestion not run) it falls back to the
  exact same local `claimById` read Package E's stub used, so the panel
  degrades to identical output rather than breaking.
- `lib/__tests__/evidence.test.ts` — 4 tests: unknown id → null, no
  `vectorRefs`/no key → statement fallback, `pinnedQuote` always wins even
  with a key set, batch drops unknown ids and preserves order.
- Full suite: 151/151 passing (`npx vitest run`), `tsc --noEmit` clean.

## What's NOT done — needs a live Pinecone + Anthropic key, which this
## session doesn't have

`RAGloader/ingest_claims.py` is written and syntax-checked but **not run
against a real index** — no `PINECONE_API_KEY` / `ANTHROPIC_API_KEY` /
Pinecone index exist in this dev environment. Whoever holds those
credentials (Sanket, per the task brief) needs to:

1. Create the Pinecone index if it doesn't exist yet: name `myai6`
   (must match `config.ts`'s `PINECONE_INDEX_NAME`), integrated embedding
   model `llama-text-embed-v2`.
2. `export PINECONE_API_KEY=... ANTHROPIC_API_KEY=...` (same keys the app
   uses — see `env.template`).
3. `cd RAGloader && python ingest_claims.py` — ingests all 17 claims into
   the 3-namespace structure and writes each claim's resulting Pinecone
   parent-chunk id(s) back into `data/claims/<id>.json`'s `vectorRefs`
   field. Pass one or more claim ids as arguments to ingest just those
   (fast iteration).

Until that runs, `Claim.vectorRefs` is empty for all 17 claims, so
`lib/evidence.ts` falls back to the claim's own `statement` for every
claim — **functionally identical to Package E's original stub**. Nothing
regresses; the "Why?" panel looks and behaves the same either way. Once
ingestion runs, the panel starts rendering the richer Pinecone-retrieved
prose instead, with zero code changes needed on the retrieval or UI side.

## KB_SCOPE / prompts.ts owner-chatbot framing — explicitly left alone

`config.ts`/`prompts.ts` both carry a `TODO(Package D/G)` marking
`KB_SCOPE`, `AI_NAME`/`OWNER_NAME` framing, and the `EXA_SYSTEM_PROMPT`
owner-profile clause as belonging to "whichever package first needs a
working prompt." The task brief flags this might land on F if no one else
claims it. As of this note, `package-g` exists on the remote (someone is
actively working on Package G in parallel), so this was deliberately **not
touched here** to avoid a merge collision on shared config files — check
with whoever owns G before editing `config.ts`/`prompts.ts`.

## Grade-laundering guard (brief's warning, restated)

A policy may cite only a subset of the claims that exist for a compound on
purpose. `EvidenceAccordion` and `/api/evidence` only ever operate on the
claim ids the caller passes in (`policy.citesClaims`); nothing in this
package widens that set. If a future caller ever passes "every claim for
this compound" instead of the policy's actual `citesClaims`, that's a bug
in the caller, not something F's retrieval guards against internally.

## For whoever picks up G, H next

- `lib/evidence.ts`'s `EvidenceItem.source` field (`pinned_quote` /
  `vector_retrieval` / `claim_statement_fallback`) is there for debugging
  and isn't shown to users — useful if H's integration testing wants to
  assert real retrieval is actually happening post-ingestion, not silently
  falling back.
- Re-run `build_claim_documents.py` + `ingest_claims.py` together whenever
  Package A adds or edits a claim; they're two steps on purpose (the first
  is safe/free to re-run anytime, the second costs API calls).
