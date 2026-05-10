import type { BillLineItem, CartItem, CrateCartLine } from "@/data/types";
import { withComputedLineTotals } from "@/lib/billingCalculations";
import { billLineAmount, billLinesSubtotal, roundMoney } from "@/lib/billLineMath";

export { roundMoney };

/** @deprecated Use billLineAmount */
export const crateLineAmount = billLineAmount;

/** @deprecated Use billLinesSubtotal */
export const crateCartSubtotal = billLinesSubtotal;

export function crateLineToBillItem(line: CrateCartLine): BillLineItem {
  const { variantId: _v, productId: _p, ...rest } = line;
  return rest;
}

/** For legacy table / CartItem-based helpers. */
export function crateLineToCartItem(line: CrateCartLine): CartItem {
  return withComputedLineTotals({
    productId: line.productId,
    productName: line.name,
    variantId: line.variantId,
    variantName: line.size,
    unitPrice: line.price,
    crates: line.qty,
    unitsPerCrate: line.litersPerCrate,
    totalUnits: 0,
    totalPrice: 0,
  });
}

export function buildCrateLine(
  productId: string,
  productName: string,
  variantId: string,
  variantName: string,
  price: number,
  litersPerCrate: number,
  opts?: { category?: "milk" | "curd"; qtyPerCrate?: number; ratePerCrate?: number }
): CrateCartLine {
  return {
    name: productName,
    size: variantName,
    price,
    litersPerCrate,
    qty: 1,
    variantId,
    productId,
    ...(opts?.category ? { category: opts.category } : {}),
    ...(opts?.qtyPerCrate != null ? { qtyPerCrate: opts.qtyPerCrate } : {}),
    ...(opts?.ratePerCrate != null ? { ratePerCrate: opts.ratePerCrate } : {}),
  };
}
