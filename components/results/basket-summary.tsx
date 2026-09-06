import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProductDisplay } from "@/lib/results/product-lookup";
import { knowledgeBase } from "@/lib/engine";
import type { BasketItem, BudgetOutcome } from "@/types/engine";

function BasketRow({ item }: { item: BasketItem }) {
  const rec = item.recommendation;
  const name = rec.compoundId
    ? knowledgeBase.compoundById.get(rec.compoundId)?.name
    : rec.ingredientId
      ? knowledgeBase.ingredientById.get(rec.ingredientId)?.name
      : undefined;
  const product = getProductDisplay(item.productId);
  return (
    <li>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span>
          {name ?? rec.compoundId ?? rec.ingredientId} — {product?.productName ?? item.productId}
        </span>
        <span className="text-muted-foreground">
          {item.packsPerMonth} pack{item.packsPerMonth === 1 ? "" : "s"}/mo · ₹{item.monthlyCostINR}/mo
        </span>
      </div>
      {item.packsPerMonth > 1 && (
        <p className="text-xs text-muted-foreground">
          ₹{item.priceINR}/pack × {item.packsPerMonth} to cover this month&apos;s servings
        </p>
      )}
      {product?.compositionIsPlaceholder && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Composition not yet verified by our nutrition expert — treat this listing as indicative.
        </p>
      )}
    </li>
  );
}

export function BasketSummary({ budget }: { budget: BudgetOutcome }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Your basket</CardTitle>
        <p className="text-sm text-muted-foreground">
          {budget.budgetINR != null
            ? budget.budgetIsHardConstraint
              ? `Budget: ₹${budget.budgetINR}/month`
              : `Budget: ₹${budget.budgetINR}/month (flexible — up to ₹${budget.headroomINR} more for something you really need)`
            : "No budget limit set"}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium">Funded (₹{budget.totalFundedCostINR})</p>
          {budget.funded.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing funded this round.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {budget.funded.map((item, i) => (
                <BasketRow key={i} item={item} />
              ))}
            </ul>
          )}
        </div>

        {budget.deferred.length > 0 && (
          <div>
            <p className="text-sm font-medium">
              Deferred — didn&apos;t fit this month&apos;s budget (₹{budget.totalDeferredCostINR})
            </p>
            <p className="text-xs text-muted-foreground">
              Still shown, not dropped — these were the next-highest priority items.
            </p>
            <ul className="mt-1 space-y-1">
              {budget.deferred.map((item, i) => (
                <BasketRow key={i} item={item} />
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
