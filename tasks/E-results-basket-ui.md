# Package E — Results / Basket UI

**Owner:** Sanket (or a parallel chat). **Needs B0's types**; can build against `data/tools/samples/*.json` + `node data/tools/demo.mjs` output shape as fixtures while Package B is still in progress, then swap in the real engine once B lands.

## What this is

The results page: per-ingredient recommendation cards, plus the budget-allocated basket view. This is the product's actual differentiator on screen — it needs to visibly show the engine saying "no" as often as it says "yes."

## Recommendation cards

Per `mvp-plan.md` §4, each card needs:
- **Status** — Recommended / Escalate / Not needed / Already covered (confirm exact status enum against B0's published `Recommendation` type once it lands).
- **Evidence strength badge** — Strong/Moderate/Limited/Insufficient, sourced from the claim(s) the policy cites.
- **Expected benefit / "why" text** — generated from the engine's clause trace, **never invented**. If Package G or the LLM layer isn't ready, a template string built directly from the trace is a fine placeholder — the point is this text must be traceable to the trace, not written by the UI.
- **Dosing guidance** — the serving plan output (e.g. "1.5 scoops (36g) per day").
- **"Why?" expandable** — citations, pulled via Package F's Pinecone retrieval once that exists; stub with the citation list already present in `data/claims/*.json` in the meantime.
- **Product link(s)** — ranked real products from `data/products/products.json`, linking out to the real marketplace URL. **Do not render a product whose `urlVerified` is `false`** (4 of them currently are, per `data/README.md`) — either hide those or show a "link coming soon" state instead of a broken/generic search-page link. Same caution for the 3 placeholder composition records (`algal-omega3-vegan-60`, `hkvitals-multivitamin-men-60`, `hkvitals-pre-probiotic-60`) — check with Package A on status before shipping them as if verified.

## The "not needed" / "escalate" cases need to be first-class, not an afterthought

This is the actual point of the product. Design these states with as much care as "Recommended":
- **Escalate** ("we recommend speaking with a medical professional") should read as a legitimate, non-alarming outcome — not an error state.
- **Not needed / already covered** should be visually calm and clearly explained (e.g. BCAA: "not needed — your protein intake already covers this"), not just omitted from the list. Users should see the engine *considered* something and chose not to recommend it — that's the trust-building moment.

## Basket / budget view

Once the priority-ordered, budget-allocated basket exists (Package B's `BudgetOutcome`): show funded items and clearly separate **deferred items with their price** (never silently drop them — per the settled design, deferred items must be visible, just not funded this round).

## Regulatory disclaimer

Package I is writing the copy for a disclaimer that needs to live somewhere on this page (not medical advice, escalation ≠ diagnosis, etc.) — check with them for final text rather than writing your own; don't skip it, it's part of the trust story.

## File overlap warning

You and Package D both touch `app/` and `components/` — different routes (results vs. intake), keep to your own subtree.

## Deliverable / done-when

Given a `UserProfile` (or one of the 5 sample profiles), the page renders the full card set including at least one Recommended, one Escalate, and one Not Needed/Already Covered case correctly, plus a basket view showing funded vs. deferred items with prices.
