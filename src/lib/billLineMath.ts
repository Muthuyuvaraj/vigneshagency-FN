import type { BillLineItem } from "@/data/types";

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** One line: price × litersPerCrate × qty (skips invalid rows). */
export function billLineAmount(item: BillLineItem): number {
  const ratePerCrate = Number(item.ratePerCrate);
  const qty = Number(item.qty);
  if (!isNaN(ratePerCrate) && ratePerCrate > 0 && !isNaN(qty)) {
    return roundMoney(ratePerCrate * qty);
  }
  const price = Number(item.price);
  const liters = Number(item.litersPerCrate);
  if (isNaN(price) || isNaN(liters) || isNaN(qty)) {
    console.log("Invalid item:", item);
    return 0;
  }
  return roundMoney(price * liters * qty);
}

/** Σ line amounts — same rules as billing cart reduce. */
export function billLinesSubtotal(items: BillLineItem[]): number {
  const subtotal = items.reduce((sum, item) => {
    const ratePerCrate = Number(item.ratePerCrate);
    const qty = Number(item.qty);
    if (!isNaN(ratePerCrate) && ratePerCrate > 0 && !isNaN(qty)) {
      return sum + ratePerCrate * qty;
    }
    const price = Number(item.price);
    const liters = Number(item.litersPerCrate);
    if (isNaN(price) || isNaN(liters) || isNaN(qty)) {
      console.log("Invalid item:", item);
      return sum;
    }
    return sum + price * liters * qty;
  }, 0);
  return roundMoney(subtotal);
}
