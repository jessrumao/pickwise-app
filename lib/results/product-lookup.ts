// Package E — product display helpers. Wraps knowledgeBase's product/pricing
// maps with the two "don't ship this as if it were verified" rules from
// tasks/E-results-basket-ui.md: never render a product link whose pricing
// entry has urlVerified === false, and flag (never hide) the 3 known
// placeholder-composition records so the vegan-omega-3 flagship case can
// still render while being honest about its status.
import { knowledgeBase } from "@/lib/engine";
import type { IngredientId, ProductId } from "@/types/engine";

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

// All products that deliver a given ingredient, for the "other options" list
// under a recommendation's chosen product.
export function productsForIngredient(ingredientId: IngredientId): ProductDisplay[] {
  return knowledgeBase.products
    .filter((p) => p.ingredientId === ingredientId)
    .map((p) => getProductDisplay(p.id))
    .filter((p): p is ProductDisplay => p !== undefined);
}
