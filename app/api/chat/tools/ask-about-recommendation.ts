import { tool } from "ai";
import { z } from "zod";
import { searchPinecone } from "@/lib/pinecone";
import { kbKey } from "@/lib/citations";
import type { UISource, Source } from "@/types/data";

/**
 * The retrieval tool behind a per-card "ask a question" chat, as opposed to
 * the general vectorDatabaseSearch tool (search-vector-database.ts), which
 * searches the whole KB with no notion of "what this recommendation actually
 * rested on."
 *
 * Bound at request time to ONE recommendation card via `citedClaimIds` --
 * the exact claim ids the policy that produced this card's recommendation
 * cited (its `citesClaims`, from Package B's trace). This is the same
 * "never show more than what was actually cited" boundary lib/evidence.ts
 * already enforces for the static "Why?" panel (see
 * tasks/F-pinecone-evidence-ingestion.md's grade-laundering note) -- this
 * tool extends that boundary to open-ended follow-up questions instead of
 * just the exact-id lookup the static panel does.
 *
 * On every call this does TWO separate, filtered searches, never one
 * unscoped search over the whole KB:
 *
 *   1. "cited" tier -- restricted to source_name IN citedClaimIds. This is
 *      semantic search, unlike lib/evidence.ts's exact-id fetch, so it can
 *      answer a real follow-up question ("how confident are we") that
 *      doesn't map to one specific claim id -- but it still can only ever
 *      surface the claims this card actually cites, nothing else.
 *
 *   2. "supplementary" tier -- the broader, vetted research corpus
 *      (RAGloader/ingest_research_papers.py), NOT restricted by
 *      source_name, filtered only by evidenceTier="supplementary". This can
 *      surface a real, vetted paper that was never part of why the
 *      recommendation fired.
 *
 * The two result sets are returned to the model under clearly separate
 * headings, and each collected UISource carries its evidenceTier through
 * (see types/data.ts) so the client Sources box can badge them distinctly
 * without depending on the model's own phrasing to make the distinction --
 * the code-level guarantee is which tier a source's citation number maps to,
 * not anything the model says about it.
 */
export function createAskAboutRecommendation(
  citedClaimIds: string[],
  collect: (s: UISource, content?: string) => void
) {
  return tool({
    description:
      `Answer a follow-up question about THIS SPECIFIC recommendation card. ` +
      `Explains and elaborates on a decision the rules engine already made -- ` +
      `it never overrides or re-derives the recommendation itself. ` +
      `Always searches the exact evidence that justified this recommendation first; ` +
      `if useful, it also surfaces additional vetted research beyond that -- clearly ` +
      `labeled as NOT part of why this was recommended. When you compose your answer, ` +
      `preserve that distinction: never state or imply that the "additional research" ` +
      `results make the recommendation more strongly supported than it actually was -- ` +
      `they are context, not justification. For anything medication-, condition-, or ` +
      `diagnosis-adjacent, defer to speaking with a medical professional rather than ` +
      `reasoning it out yourself.`,
    inputSchema: z.object({
      query: z.string().describe(
        "The user's question, as a natural-language search query (e.g. 'is there stronger evidence than this' or 'what about interactions with medication')."
      ),
    }),

    execute: async ({ query }) => {
      const sections: string[] = [];

      // 1. Cited tier -- restricted to exactly this card's claims.
      if (citedClaimIds.length > 0) {
        const cited = await searchPinecone(query, { source_name: citedClaimIds });
        collectTagged(cited.sources, "cited", collect);
        if (cited.sources.length > 0) {
          sections.push(
            `## Evidence behind this recommendation\n(This is the exact evidence that justified this recommendation. Citations from this section explain "why".)\n\n${cited.text}`
          );
        }
      }

      // 2. Supplementary tier -- broader vetted corpus, unrestricted by source_name.
      const supplementary = await searchPinecone(query, { evidenceTier: "supplementary" });
      collectTagged(supplementary.sources, "supplementary", collect);
      if (supplementary.sources.length > 0) {
        sections.push(
          `## Additional research (NOT part of why this was recommended)\n(Real, vetted research for broader context. Do not cite this as evidence that strengthens the recommendation itself.)\n\n${supplementary.text}`
        );
      }

      if (sections.length === 0) {
        return "No relevant evidence found for this question, in either the cited evidence or the broader research corpus.";
      }
      return sections.join("\n\n");
    },
  });
}

function collectTagged(
  sources: Source[],
  tier: "cited" | "supplementary",
  collect: (s: UISource, content?: string) => void
) {
  for (const s of sources) {
    const content = s.chunks
      .map((c) => [c.text, c.description, c.table_markdown].filter(Boolean).join("\n"))
      .join("\n");
    collect(
      {
        kind: "kb",
        title: (s.source_description || s.source_name || "Knowledge base source").trim(),
        url: s.source_url || kbKey(s.source_name || s.source_description),
        site: s.source_name || "Knowledge base",
        evidenceTier: tier,
      },
      content
    );
  }
}
