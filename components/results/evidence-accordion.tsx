"use client";

// components/results/evidence-accordion.tsx
//
// Package F's real evidence retrieval, behind the same "Why? (evidence)"
// accordion Package E stubbed with a direct `claimById` read (see
// docs/status/e-results-basket-ui-status.md). Fetches lazily, only on first
// open, from /api/evidence -- and only for the claim ids the caller passes
// in (a policy's `citesClaims`), never every claim for a compound.
//
// If the fetch fails for any reason (Pinecone unreachable, ingestion not
// run yet, offline), this falls back to the same local `claimById` read
// Package E's stub used, so the panel degrades to identical-looking output
// rather than breaking.

import * as React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { knowledgeBase } from "@/lib/engine";
import type { Claim } from "@/types/engine";

interface EvidenceEntry {
  claimId: string;
  statement: string;
  citations: Claim["citations"];
}

export function EvidenceAccordion({ claimIds }: { claimIds: string[] }) {
  const [entries, setEntries] = React.useState<EvidenceEntry[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const fetchedRef = React.useRef(false);

  // Same shape the old stub rendered -- used both as the initial paint and
  // as the fallback if /api/evidence fails.
  const fallback: EvidenceEntry[] = React.useMemo(
    () =>
      claimIds
        .map((id) => knowledgeBase.claimById.get(id))
        .filter((c): c is Claim => Boolean(c))
        .map((c) => ({ claimId: c.id, statement: c.statement, citations: c.citations })),
    [claimIds]
  );

  async function handleOpenChange(value: string) {
    if (value !== "why" || fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    try {
      const res = await fetch("/api/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimIds }),
      });
      if (!res.ok) throw new Error(`evidence fetch failed: ${res.status}`);
      const data = (await res.json()) as { evidence?: EvidenceEntry[] };
      if (Array.isArray(data.evidence) && data.evidence.length > 0) {
        setEntries(data.evidence);
      }
    } catch (err) {
      console.error("[EvidenceAccordion] falling back to local claim data:", err);
      // entries stays null -> render uses `fallback` below.
    } finally {
      setLoading(false);
    }
  }

  const display = entries ?? fallback;

  return (
    <Accordion type="single" collapsible onValueChange={handleOpenChange}>
      <AccordionItem value="why">
        <AccordionTrigger className="text-sm">Why? (evidence)</AccordionTrigger>
        <AccordionContent className="space-y-3">
          {loading && !entries && <p className="text-xs text-muted-foreground">Loading evidence…</p>}
          {display.map((claim) => (
            <div key={claim.claimId} className="space-y-1">
              <p className="text-sm">{claim.statement}</p>
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {claim.citations.map((c, i) => (
                  <li key={i}>
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline">
                      {c.title}
                    </a>{" "}
                    — {c.source}
                    {c.year ? `, ${c.year}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
