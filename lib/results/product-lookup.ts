// Package E — product display helpers. Wraps knowledgeBase's product/pricing
// maps with the two "don't ship this as if it were verified" rules from
// tasks/E-results-basket-ui.md: never render a product link whose pricing
// entry has urlVerified === false, and flag (never hide) the 3 known
// placeholder-composition records so the vegan-omega-3 flagship case can
// still render while being honest about its status.
import { knowledgeBase, packsNeededPerMonth } from "@/lib/engine";
import type { IngredientId, ProductId, ServingPlan } from "@/types/engine";

// From data/README.md's "known findings" — kept here rather than in data/
// since only Package A writes to data/, and this list is UI display policy,
// not engine input.
export const PLACEHOLDER_COMPOSITION_PRODUCT_IDS: ReadonlySet<ProductId> = new Set([
  "algal-omega3-vegan-60",
  "hkvitals-multivitamin-men-60",
  "hkvitals-pre-probiotic-60",
]);

export interface ProductDisplay {
  productId: ProductId;
  productName: string;
  brand: string;
  priceINR?: number;
  marketplaceUrl?: string;
  linkVerified: boolean;
  compositionIsPlaceholder: boolean;
}

export function getProductDisplay(productId: ProductId): ProductDisplay | undefined {
  const product = knowledgeBase.productById.get(productId);
  if (!product) return undefined;
  const pricing = knowledgeBase.pricingByProductId.get(productId);
  return {
    productId,
    productName: product.productName,
    brand: product.brand,
    priceINR: pricing?.priceINR,
    marketplaceUrl: pricing?.urlVerified ? pricing.marketplaceUrl : undefined,
    linkVerified: pricing?.urlVerified ?? false,
    compositionIsPlaceholder: PLACEHOLDER_COMPOSITION_PRODUCT_IDS.has(productId),
  };
}

// Assumed daily servings for a bundle product with no ServingPlan (e.g. a
// multivitamin — rda_multiple can't resolve to a concrete amount to close a
// gap against). Mirrors lib/engine/recommend.ts's own BUNDLE_ASSUMED_DAILY_SERVINGS —
// duplicated rather than imported since that constant lives in server-only
// engine internals and this is purely a display-layer re-derivation of the
// same number the engine already used when it built the basket.
const BUNDLE_ASSUMED_DAILY_SERVINGS = 1;

export interface MonthlyPacks {
  packsPerMonth: number;
  monthlyCostINR: number;
}

/**
 * Re-derives the same packs/month + monthly cost the engine's budget
 * allocator computed for this product, for display on a recommendation
 * card. Takes a ServingPlan when one exists (real daily servings), or falls
 * back to the one-serving-a-day assumption for ingredient-scoped bundles.
 */
export function monthlyPacksFor(productId: ProductId, servingPlan?: ServingPlan): MonthlyPacks | undefined {
  const product = knowledgeBase.productById.get(productId);
  const price = knowledgeBase.pricingByProductId.get(productId)?.priceINR;
  if (!product || price == null) return undefined;
  const dailyServings = servingPlan?.servings ?? BUNDLE_ASSUMED_DAILY_SERVINGS;
  const packsPerMonth = packsNeededPerMonth(dailyServings, product.servingsPerPack);
  return { packsPerMonth, monthlyCostINR: packsPerMonth * price };
}

// All products that deliver a given ingredient, for the "other options" list
// under a recommendation's chosen product.
export function productsForIngredient(ingredientId: IngredientId): ProductDisplay[] {
  return knowledgeBase.products
    .filter((p) => p.ingredientId === ingredientId)
    .map((p) => getProductDisplay(p.id))
    .filter((p): p is ProductDisplay => p !== undefined);
}
