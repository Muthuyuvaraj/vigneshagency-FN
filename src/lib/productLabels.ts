import type { CartItem } from "@/data/types";

/** Label for the SKU size (500ml, 1L, …). Supports legacy `variantSize`. */
export function getVariantLabel(item: Pick<CartItem, "variantName" | "variantSize">): string {
  return (item.variantName ?? item.variantSize ?? "").trim();
}

/** Single invoice line: "Full Cream Milk 500ml" — product + variant, not duplicated product rows. */
export function invoiceLineTitle(item: Pick<CartItem, "productName" | "variantName" | "variantSize">): string {
  const v = getVariantLabel(item);
  if (!v) return item.productName.trim();
  return `${item.productName} ${v}`.trim();
}
