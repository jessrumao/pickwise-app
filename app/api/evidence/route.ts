// app/api/evidence/route.ts
//
// Package F's retrieval endpoint: given the claim ids a policy cited, return
// the evidence prose + citations to render under "Why am I seeing this".
// This never decides anything -- it runs strictly after Package B's rules
// engine has already produced a recommendation and its trace. See
// tasks/F-pinecone-evidence-ingestion.md and lib/evidence.ts.

import { NextRequest, NextResponse } from "next/server";
import { getEvidenceForClaims } from "@/lib/evidence";

// A policy cites at most a handful of claims in today's data; this just
// bounds the worst case rather than reflecting any real limit.
const MAX_CLAIM_IDS = 20;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const claimIds = (body as { claimIds?: unknown } | null)?.claimIds;
  if (!Array.isArray(claimIds) || claimIds.length === 0 || !claimIds.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "Body must be { claimIds: string[] }" }, { status: 400 });
  }

  const evidence = await getEvidenceForClaims(claimIds.slice(0, MAX_CLAIM_IDS));
  return NextResponse.json({ evidence });
}
