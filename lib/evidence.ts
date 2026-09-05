// lib/evidence.ts
//
// Package F -- evidence retrieval for the "Why? (evidence)" panel.
//
// This is the real replacement for the interim stub Package E shipped
// (components/results/recommendation-card.tsx originally read
// `claim.statement` straight from the static `data/claims/*.json` import --
// see docs/status/e-results-basket-ui-status.md, "this is the Package F
// stub the brief calls for").
//
// Retrieval is a metadata/id lookup, never an open semantic search: each
// claim's `vectorRefs` (written by RAGloader/ingest_claims.py at ingestion
// time) names the exact Pinecone parent-chunk record(s) that hold this
// claim's evidence text, and we fetch those ids directly. See
// types/engine.ts's comment on `Claim.vectorRefs`. Retrieval never
// influences what gets recommended -- it only explains a decision the rules
// engine (Package B) already made; see tasks/F-pinecone-evidence-ingestion.md.
//
// A citation's `pinnedQuote` (when present) always wins over retrieval --
// exact text, zero drift risk. Below that, vector retrieval. Below that, the
// claim's own one-line `statement` (e.g. before ingestion has run, or
// PINECONE_API_KEY / ENABLE_VECTOR_SEARCH is off) -- functionally identical
// to Package E's original stub, so nothing regresses while ingestion is
// pending.
//
// IMPORTANT: only ever call this with claim ids a policy actually cited
// (`policy.citesClaims`) -- never every claim that exists for a compound.
// A policy may deliberately cite only a subset (e.g. `elig-epa-dha-general`
// cites the Limited general-population claim, not the Strong
// triglyceride-specific one) and showing the uncited claim would make the
// recommendation look better-supported than it actually was.

import { Pinecone } from "@pinecone-database/pinecone";
import { PINECONE_INDEX_NAME, PINECONE_NS_PARENTS } from "@/config";
import { claimById } from "@/lib/engine/knowledge-base";
import type { Claim } from "@/types/engine";

export interface EvidenceItem {
  claimId: string;
  /** Prose to render under "Why am I seeing this". */
  statement: string;
  citations: Claim["citations"];
  /** Where `statement` came from -- useful for debugging/telemetry, not shown to users. */
  source: "pinned_quote" | "vector_retrieval" | "claim_statement_fallback";
}

// Lazy client, same pattern as lib/pinecone.ts: importing this module must
// never throw when PINECONE_API_KEY is absent (ENABLE_VECTOR_SEARCH=false).
let _index: ReturnType<Pinecone["Index"]> | null = null;
function pineconeIndex() {
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) return null;
  if (!_index) {
    _index = new Pinecone({ apiKey }).Index(PINECONE_INDEX_NAME);
  }
  return _index;
}

async function fetchVectorProse(vectorRefs: string[]): Promise<string | null> {
  const index = pineconeIndex();
  if (!index || vectorRefs.length === 0) return null;
  try {
    const res = (await index.namespace(PINECONE_NS_PARENTS).fetch(vectorRefs)) as any;
    const records = res?.records ?? {};
    const texts = vectorRefs
      .map((id) => records?.[id]?.fields?.content ?? records?.[id]?.metadata?.content)
      .filter((t: unknown): t is string => typeof t === "string" && t.length > 0);
    return texts.length > 0 ? texts.join("\n\n") : null;
  } catch (err) {
    console.error(`[evidence] Pinecone fetch failed for [${vectorRefs.join(", ")}]:`, err);
    return null;
  }
}

/**
 * Evidence prose + citations for ONE claim the caller has already decided to
 * show. Returns null only if `claimId` doesn't exist in the knowledge base
 * at all (never invents a claim).
 */
export async function getEvidenceForClaim(claimId: string): Promise<EvidenceItem | null> {
  const claim = claimById.get(claimId);
  if (!claim) return null;

  const pinned = claim.citations.find((c) => c.pinnedQuote)?.pinnedQuote;
  if (pinned) {
    return { claimId, statement: pinned, citations: claim.citations, source: "pinned_quote" };
  }

  if (claim.vectorRefs && claim.vectorRefs.length > 0) {
    const prose = await fetchVectorProse(claim.vectorRefs);
    if (prose) {
      return { claimId, statement: prose, citations: claim.citations, source: "vector_retrieval" };
    }
  }

  return { claimId, statement: claim.statement, citations: claim.citations, source: "claim_statement_fallback" };
}

/** Batch form -- silently drops any id not found in the knowledge base. */
export async function getEvidenceForClaims(claimIds: string[]): Promise<EvidenceItem[]> {
  const results = await Promise.all(claimIds.map(getEvidenceForClaim));
  return results.filter((r): r is EvidenceItem => r !== null);
}
