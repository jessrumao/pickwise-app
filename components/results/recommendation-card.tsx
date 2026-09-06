import { Badge } from "@/components/ui/badge";
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { getProductDisplay, productsForIngredient, monthlyPacksFor } from "@/lib/results/product-lookup";
import { statusDisplay, TONE_BADGE_CLASSES } from "@/lib/results/status-display";
import { findMatchingEscalation } from "@/lib/results/trace-match";
import { knowledgeBase } from "@/lib/engine";
import type { Recommendation, SafetyEscalation } from "@/types/engine";

function itemName(rec: Recommendation): string {
  if (rec.compoundId) return knowledgeBase.compoundById.get(rec.compoundId)?.name ?? rec.compoundId;
  if (rec.ingredientId) return knowledgeBase.ingredientById.get(rec.ingredientId)?.name ?? rec.ingredientId;
  return "Unknown item";
}

// One AccordionItem per recommendation — collapsed by default (see
// results-view.tsx's Accordion wrapper). The basket already answers "what
// am I getting and what does it cost"; this section answers "why", and
// collapsing it by default keeps the page compact and leaves the
// results-page chat visible without a wall of scrolling past open reasoning
// nobody asked to read yet.
export function RecommendationCard({
  value,
  rec,
  safetyEscalations,
}: {
  value: string;
  rec: Recommendation;
  safetyEscalations: SafetyEscalation[];
}) {
  const display = statusDisplay(rec.status);
  if (!display) return null; // not_shown: engine deliberately didn't surface this

  const policy = knowledgeBase.eligibilityPolicyById.get(rec.policyId);
  const escalation = rec.status === "escalate" ? findMatchingEscalation(rec, safetyEscalations) : undefined;

  const chosenProduct = rec.servingPlan ? getProductDisplay(rec.servingPlan.productId) : undefined;
  const otherProducts = (rec.candidateIngredients ?? [])
    .flatMap((c) => productsForIngredient(c.ingredientId))
    .filter((p) => p.productId !== chosenProduct?.productId);
  const monthlyPacks = chosenProduct ? monthlyPacksFor(chosenProduct.productId, rec.servingPlan) : undefined;

  return (
    <AccordionItem value={value} className="rounded-md border border-border px-3">
      <AccordionTrigger className="hover:no-underline">
        <div className="flex flex-1 flex-wrap items-center justify-between gap-2 pr-2">
          <span className="font-display text-sm">{itemName(rec)}</span>
          <Badge
            variant="outline"
            className={`font-display text-[10px] tracking-wide ${TONE_BADGE_CLASSES[display.tone]}`}
          >
            {display.label}
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{display.framing}</p>

        {rec.status === "escalate" ? (
          <p className="text-sm">
            {escalation?.userMessage ??
              "A safety rule matched for this item — please check with a medical professional before starting it."}
          </p>
        ) : (
          <>
            {display.tone !== "escalate" && (
              <Badge variant="outline" className="text-xs">
                Evidence: {rec.grade}
                {policy && policy.citesClaims.length > 0 && (
                  <>
                    {" "}
                    · {policy.citesClaims.length} source{policy.citesClaims.length === 1 ? "" : "s"}
                  </>
                )}
              </Badge>
            )}
            <p className="text-sm">{rec.why}</p>
          </>
        )}

        {rec.servingPlan && (
          <p className="text-sm font-medium">
            {rec.servingPlan.servings} serving{rec.servingPlan.servings === 1 ? "" : "s"} (
            {rec.servingPlan.delivered}
            {rec.servingPlan.unit}) per day
            {rec.servingPlan.flooredUpToMinEffective && " — rounded up to the minimum effective dose"}
          </p>
        )}

        {chosenProduct && (
          <div className="rounded-md border p-3 text-sm">
            <p className="font-medium">
              {chosenProduct.brand} — {chosenProduct.productName}
            </p>
            <div className="mt-1 flex items-center gap-2 text-muted-foreground">
              {monthlyPacks ? (
                <span>
                  ₹{monthlyPacks.monthlyCostINR}/mo ({monthlyPacks.packsPerMonth} pack
                  {monthlyPacks.packsPerMonth === 1 ? "" : "s"} × ₹{chosenProduct.priceINR})
                </span>
              ) : (
                chosenProduct.priceINR != null && <span>₹{chosenProduct.priceINR}</span>
              )}
              {chosenProduct.marketplaceUrl ? (
                <a
                  href={chosenProduct.marketplaceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  View product
                </a>
              ) : (
                <span>Link coming soon</span>
              )}
            </div>
            {chosenProduct.compositionIsPlaceholder && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                This product&apos;s exact composition is still pending expert review — treat the
                numbers above as indicative, not final.
              </p>
            )}
            {otherProducts.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Other options: {otherProducts.map((p) => p.productName).join(", ")}
              </p>
            )}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
