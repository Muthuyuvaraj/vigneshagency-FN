import type { Bill } from "@/data/types";
import { billLinesSubtotal } from "@/lib/billLineMath";
import { SELLER } from "@/data/seller";
import { formatRupees } from "@/lib/formatMoney";

/** Same total rule as invoice screen / PDF. */
export function invoiceDisplayTotal(bill: Bill): number {
  // Prefer persisted total (supports GST-inclusive bills). Fallback to recompute for legacy/mismatch rows.
  if (Number.isFinite(bill.total)) return bill.total;
  return billLinesSubtotal(bill.items);
}

export function thermalBillTotals(bill: Bill): {
  totalCrates: number;
  totalQty: number;
  grandTotal: number;
} {
  let totalCrates = 0;
  let totalQty = 0;
  for (const item of bill.items) {
    totalCrates += item.qty;
    totalQty += item.qty * item.litersPerCrate;
  }
  return {
    totalCrates,
    totalQty,
    grandTotal: invoiceDisplayTotal(bill),
  };
}

/** QR payload: invoice URL when in browser; compact text fallback otherwise (e.g. PDF tooling). */
export function getInvoiceQrValue(bill: Bill): string {
  if (typeof globalThis !== "undefined" && "location" in globalThis && globalThis.location?.origin) {
    return `${globalThis.location.origin}/invoice/${bill.id}`;
  }
  const total = formatRupees(invoiceDisplayTotal(bill));
  return [
    SELLER.businessName,
    `Invoice: ${bill.id.toUpperCase()}`,
    `Date: ${bill.date}`,
    `Dealer: ${bill.dealerName}`,
    `Total: Rs. ${total}`,
    `GSTIN: ${SELLER.gstin}`,
  ].join("\n");
}

const STOP_WORDS = new Set([
  "and",
  "of",
  "the",
  "with",
  "for",
  "to",
  "in",
  "fresh",
  "set",
  "milk",
  "curd",
]);

/**
 * Thermal-friendly short product label.
 * Examples:
 * - "Full Cream Milk" -> "FC Milk"
 * - "Fresh Curd" -> "Curd"
 */
export function shortThermalProductLabel(name: string): string {
  const clean = name.replace(/\s+/g, " ").trim();
  if (!clean) return name;

  const words = clean.split(" ").filter(Boolean);
  if (words.length === 1) return words[0]!;

  const meaningful = words.filter((w) => !STOP_WORDS.has(w.toLowerCase()));
  const firstTwo = (meaningful.length >= 2 ? meaningful.slice(0, 2) : words.slice(0, 2)).filter(Boolean);
  const abbr = firstTwo.map((w) => w[0]!.toUpperCase()).join("");

  // Ensure we keep "Milk"/"Curd" if present (readability)
  const lowerWords = words.map((w) => w.toLowerCase());
  const keep =
    lowerWords.includes("milk") ? "Milk" : lowerWords.includes("curd") ? "Curd" : words.at(-1) ?? "";

  // If abbreviation is too short/odd, fall back to first word.
  if (abbr.length < 2) return [words[0], keep].filter(Boolean).join(" ");
  return [abbr, keep].filter(Boolean).join(" ");
}

/**
 * Shortcut code for the product name (for receipt line).
 * Example: "Full Cream Milk" -> "FCM"
 */
export function thermalProductShortcut(name: string): string {
  const clean = name.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const words = clean.split(" ").filter(Boolean);
  const meaningful = words.filter((w) => !STOP_WORDS.has(w.toLowerCase()));
  const source = meaningful.length > 0 ? meaningful : words;
  const code = source.map((w) => w[0]!.toUpperCase()).join("");
  return code.slice(0, 6);
}
