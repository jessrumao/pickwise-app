import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProductDisplay } from "@/lib/results/product-lookup";
import { knowledgeBase } from "@/lib/engine";
import type { BasketItem, BudgetOutcome } from "@/types/engine";

const DAYS_PER_MONTH = 30;

function BasketRow({ item }: { item: BasketItem }) {
  const rec = item.recommendation;
  const name = rec.compoundId
    ? knowledgeBase.compoundById.get(rec.compoundId)?.name
    : rec.ingredientId
      ? knowledgeBase.ingredientById.get(rec.ingredientId)?.name
      : undefined;
  const product = getProductDisplay(item.productId);
  const daysCovered = Math.round(item.coverageFraction * DAYS_PER_MONTH);

  return (
    <li className="rounded-md border border-border/60 p-2.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">
          {name ?? rec.compoundId ?? rec.ingredientId} — {product?.productName ?? item.productId}
        </span>
        <span className="whitespace-nowrap text-muted-foreground">
          {item.packsPerMonth} pack{item.packsPerMonth === 1 ? "" : "s"} · ₹{item.monthlyCostINR}/mo
        </span>
      </div>
      {item.packsPerMonth > 1 && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          ₹{item.priceINR}/pack × {item.packsPerMonth}
        </p>
      )}
      {item.coverageFraction < 1 && (
        <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
          Covers about {daysCovered} of {DAYS_PER_MONTH} days at your budget — you&apos;ll need to
          restock before the month is out.
        </p>
      )}
      {item.downgradedFromProductId && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          Switched brands to fit your budget better.
        </p>
      )}
      {product?.compositionIsPlaceholder && (
        <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
          Composition not yet verified by our nutrition expert — treat this listing as indicative.
        </p>
      )}
    </li>
  );
}

// Given a strong visual accent (brand border + a large total-cost figure)
// per explicit product feedback — this is the single most important number
// on the results page ("what am I actually getting, and what does it cost"),
// and previously looked identical to every recommendation card above it.
export function BasketSummary({ budget }: { budget: BudgetOutcome }) {
  return (
    <Card className="border-2 border-brand/50">
      <CardHeader className="flex items-start justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <CardTitle className="font-display">Your basket</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {budget.budgetINR != null
              ? budget.budgetIsHardConstraint
                ? `Budget: ₹${budget.budgetINR}/month`
                : `Budget: ₹${budget.budgetINR}/month (flexible — up to ₹${budget.headroomINR} more for something you really need)`
              : "No budget limit set"}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-2xl font-extrabold text-brand">₹{budget.totalFundedCostINR}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">per month</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div>
          <p className="text-sm font-medium">Funded</p>
          {budget.funded.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing funded this round.</p>
          ) : (
            <ul className="mt-1.5 space-y-1.5">
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
            <ul className="mt-1.5 space-y-1.5">
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
