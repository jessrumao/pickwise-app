import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getEvidenceForClaim, getEvidenceForClaims } from "@/lib/evidence";
import { claimById } from "@/lib/engine/knowledge-base";

// A real claim, used to exercise the fallback path deterministically. This
// no longer depends on the claim being un-ingested -- deleting
// PINECONE_API_KEY below (beforeEach) already forces the fallback path
// regardless of whether vectorRefs is populated, since lib/evidence.ts never
// attempts a Pinecone fetch when the key is absent.
const REAL_CLAIM_ID = "bcaa-no-incremental-benefit-over-complete-protein";

describe("evidence retrieval", () => {
  const originalKey = process.env.PINECONE_API_KEY;

  beforeEach(() => {
    delete process.env.PINECONE_API_KEY;
  });

  afterEach(() => {
    if (originalKey !== undefined) process.env.PINECONE_API_KEY = originalKey;
  });

  it("returns null for a claim id that doesn't exist -- never invents a claim", async () => {
    const result = await getEvidenceForClaim("not-a-real-claim-id");
    expect(result).toBeNull();
  });

  it("falls back to the claim's own statement when there is no Pinecone key, regardless of vectorRefs", async () => {
    const claim = claimById.get(REAL_CLAIM_ID);
    expect(claim).toBeDefined();

    const result = await getEvidenceForClaim(REAL_CLAIM_ID);
    expect(result).not.toBeNull();
    expect(result!.source).toBe("claim_statement_fallback");
    expect(result!.statement).toBe(claim!.statement);
    expect(result!.citations).toEqual(claim!.citations);
  });

  it("a pinnedQuote citation always wins over retrieval, even with a Pinecone key set", async () => {
    process.env.PINECONE_API_KEY = "test-key";
    const claim = claimById.get(REAL_CLAIM_ID)!;
    const originalCitations = claim.citations;
    // Simulate a pinned quote the way Package A would set one in the JSON.
    claim.citations = [{ ...originalCitations[0], pinnedQuote: "Exact pinned sentence." }, ...originalCitations.slice(1)];

    try {
      const result = await getEvidenceForClaim(REAL_CLAIM_ID);
      expect(result!.source).toBe("pinned_quote");
      expect(result!.statement).toBe("Exact pinned sentence.");
    } finally {
      claim.citations = originalCitations; // don't leak mutation into other tests
    }
  });

  it("getEvidenceForClaims only returns entries for ids that exist, preserving order", async () => {
    const results = await getEvidenceForClaims([REAL_CLAIM_ID, "bogus-id", REAL_CLAIM_ID]);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.claimId === REAL_CLAIM_ID)).toBe(true);
  });
});
