import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EvidenceAccordion } from "@/components/results/evidence-accordion";
import { getProductDisplay, productsForIngredient } from "@/lib/results/product-lookup";
import { statusDisplay, TONE_BADGE_CLASSES } from "@/lib/results/status-display";
import { findMatchingEscalation } from "@/lib/results/trace-match";
import { RoutineSection } from "@/components/results/routine-section";
import { knowledgeBase } from "@/lib/engine";
import type { Recommendation, SafetyEscalation } from "@/types/engine";

function itemName(rec: Recommendation): string {
  if (rec.compoundId) return knowledgeBase.compoundById.get(rec.compoundId)?.name ?? rec.compoundId;
  if (rec.ingredientId) return knowledgeBase.ingredientById.get(rec.ingredientId)?.name ?? rec.ingredientId;
  return "Unknown item";
}

export function RecommendationCard({
  rec,
  safetyEscalations,
}: {
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

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="font-display">{itemName(rec)}</CardTitle>
          <Badge
            variant="outline"
            className={`font-display text-[10px] tracking-wide ${TONE_BADGE_CLASSES[display.tone]}`}
          >
            {display.label}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{display.framing}</p>
      </CardHeader>
      <CardContent className="space-y-3">
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
              {chosenProduct.priceINR != null && <span>₹{chosenProduct.priceINR}</span>}
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

        {rec.dosing?.timing && rec.status !== "escalate" && (
          <RoutineSection
            compoundName={itemName(rec)}
            timing={rec.dosing.timing}
            servingPlan={rec.servingPlan}
          />
        )}

        {policy && policy.citesClaims.length > 0 && rec.status !== "escalate" && (
          <EvidenceAccordion claimIds={policy.citesClaims} />
        )}
      </CardContent>
    </Card>
  );
}
