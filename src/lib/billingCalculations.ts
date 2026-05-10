import type { Bill, BillLineItem, CartItem } from "@/data/types";
import { billLinesSubtotal } from "@/lib/billLineMath";
import { formatLocalCalendarYMD } from "@/lib/localCalendar";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Total quantity (units/packets) from whole crates: crates × unitsPerCrate.
 * Supports fractional unitsPerCrate (Dodla-style pouch counts).
 */
export function calculateUnits(crates: number, unitsPerCrate: number): number {
  if (!Number.isFinite(crates) || !Number.isFinite(unitsPerCrate)) return 0;
  return Math.max(0, crates * unitsPerCrate);
}

/** Line amount: totalQty × unitPrice, rounded to paise (2 decimal places). */
export function calculateTotal(units: number, unitPrice: number): number {
  if (!Number.isFinite(units) || !Number.isFinite(unitPrice)) return 0;
  const raw = units * unitPrice;
  return Math.round(raw * 100) / 100;
}

/** @deprecated Use calculateUnits — kept for existing imports/tests. */
export function totalUnitsFromCrates(crates: number, unitsPerCrate: number): number {
  return calculateUnits(crates, unitsPerCrate);
}

/** @deprecated Use calculateTotal — kept for existing imports. */
export function lineTotalFromUnits(totalUnits: number, unitPrice: number): number {
  return calculateTotal(totalUnits, unitPrice);
}

/** Supports legacy `price` as alias for unit price. */
export function getCartItemUnitPrice(item: CartItem): number {
  return item.unitPrice ?? item.price ?? 0;
}

/**
 * Subtotal from cart lines: Σ (price × litersPerCrate × crates).
 * Safe numeric coercion for API / malformed rows.
 */
export function cartSubtotalSafe(items: CartItem[]): number {
  const subtotal = items.reduce((sum, item) => {
    const price = Number(getCartItemUnitPrice(item)) || 0;
    const liters = Number(item.unitsPerCrate) || 0;
    const qty = Number(item.crates) || 0;
    return sum + price * liters * qty;
  }, 0);
  return roundMoney(subtotal);
}

/**
 * Resolves total units: crates × unitsPerCrate (authoritative), else explicit totalUnits, else legacy quantity.
 */
export function getCartItemTotalUnits(item: CartItem): number {
  const crates = item.crates ?? 0;
  const upc = item.unitsPerCrate ?? 0;
  if (crates > 0 && upc > 0) return calculateUnits(crates, upc);
  if (item.totalUnits != null && item.totalUnits > 0) return item.totalUnits;
  return item.quantity ?? 0;
}

/** Line total: computed from crates when possible; else stored totalPrice; else units × price. */
export function getLineTotalPrice(item: CartItem): number {
  const crates = item.crates ?? 0;
  const upc = item.unitsPerCrate ?? 0;
  const unitPrice = getCartItemUnitPrice(item);
  if (crates > 0 && upc > 0) {
    return calculateTotal(calculateUnits(crates, upc), unitPrice);
  }
  if (item.totalPrice != null) return item.totalPrice;
  return calculateTotal(getCartItemTotalUnits(item), unitPrice);
}

export function cartGrandTotal(items: CartItem[]): number {
  return Math.round(items.reduce((sum, i) => sum + getLineTotalPrice(i), 0) * 100) / 100;
}

export function cartTotalUnits(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + getCartItemTotalUnits(i), 0);
}

export function cartTotalCrates(items: CartItem[]): number {
  return items.reduce((sum, i) => {
    if (i.crates != null && i.crates > 0) return sum + i.crates;
    const inferred = getCartItemCrates(i);
    return sum + (inferred ?? 0);
  }, 0);
}

/**
 * Whole crates when known; else derive from quantity if divisible by unitsPerCrate.
 * Legacy rows may return null (show as "—").
 */
export function getCartItemCrates(item: CartItem): number | null {
  if (item.crates != null && item.crates > 0) return item.crates;
  const q = item.quantity;
  const upc = item.unitsPerCrate;
  if (q != null && upc != null && upc > 0 && Number.isInteger(upc) && q % upc === 0) {
    return q / upc;
  }
  return null;
}

export function summarizeCartOrBillItems(items: CartItem[]) {
  return {
    totalCrates: cartTotalCrates(items),
    totalUnits: cartTotalUnits(items),
    revenue: cartGrandTotal(items),
  };
}

/** Derive payment status, pending due, and change to return when customer overpays. */
export function deriveBillPaymentStatus(
  total: number,
  paidAmount: number
): { pendingAmount: number; balanceToReturn: number; status: Bill["status"] } {
  const tot = roundMoney(Math.max(0, total));
  const paid = roundMoney(Math.max(0, Number(paidAmount) || 0));
  const pendingAmount = Math.max(0, roundMoney(tot - paid));
  const balanceToReturn = Math.max(0, roundMoney(paid - tot));
  let status: Bill["status"] = "pending";
  if (tot > 0 && paid >= tot) status = "paid";
  else if (paid > 0) status = "partial";
  return { pendingAmount, balanceToReturn, status };
}

/**
 * Change to return — only when paid amount exceeds total (overpayment).
 * Ignores stale `balanceToReturn` on the bill so underpaid invoices never show a false change row.
 */
export function billBalanceToReturn(
  bill: Pick<Bill, "total" | "paidAmount" | "balanceToReturn">,
  opts?: { total?: number }
): number {
  const tot = roundMoney(Math.max(0, Number(opts?.total ?? bill.total) || 0));
  const paid = roundMoney(Math.max(0, Number(bill.paidAmount) || 0));
  return Math.max(0, roundMoney(paid - tot));
}

/** Create a bill — `items` are API-shaped lines; `subtotal` === `total` (no GST). */
export function createBillFromCart(params: {
  /** Mongo `_id` of dealer (sent as `dealerMongoId` in POST JSON). */
  dealerMongoId: string;
  /** Display dealer ID stored on invoice (e.g. `A-102`); usually `Dealer.dealerCode`. */
  dealerId: string;
  dealerName: string;
  dealerCode: string;
  dealerArea: string;
  dealerPhone: string;
  items: BillLineItem[];
  paidAmount?: number;
  paymentMethod?: string;
}): Bill {
  const items = params.items;
  const subtotal = billLinesSubtotal(items);
  const total = subtotal;
  const id = `B-${Date.now()}`;
  const date = formatLocalCalendarYMD();
  const paidAmount = roundMoney(Math.max(0, Number(params.paidAmount) || 0));
  const { pendingAmount, balanceToReturn, status } = deriveBillPaymentStatus(total, paidAmount);
  const paymentMethod =
    params.paymentMethod && params.paymentMethod !== "none" ? params.paymentMethod : undefined;

  return {
    id,
    dealerMongoId: params.dealerMongoId,
    dealerId: params.dealerId,
    dealerName: params.dealerName,
    dealerCode: params.dealerCode,
    dealerArea: params.dealerArea,
    dealerPhone: params.dealerPhone,
    date,
    items,
    subtotal,
    total,
    paidAmount,
    pendingAmount,
    balanceToReturn: balanceToReturn > 0 ? balanceToReturn : undefined,
    paymentMethod,
    status,
  };
}

/** Build or refresh computed fields for a cart line (crate-first). */
export function withComputedLineTotals(item: CartItem): CartItem {
  const unitPrice = getCartItemUnitPrice(item);
  const crates = item.crates ?? 0;
  const upc = item.unitsPerCrate ?? 0;
  const totalUnits =
    crates > 0 && upc > 0
      ? calculateUnits(crates, upc)
      : (item.totalUnits ?? item.quantity ?? 0);
  const totalPrice = calculateTotal(totalUnits, unitPrice);
  return {
    ...item,
    unitPrice,
    totalUnits,
    totalPrice,
  };
}
