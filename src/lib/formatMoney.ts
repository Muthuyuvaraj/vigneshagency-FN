/** INR display; shows decimals when needed (e.g. 69.80). */
export function formatRupees(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n - Math.round(n)) < 1e-9) return n.toLocaleString("en-IN");
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Liter quantities (or crate factors); trims unnecessary decimals (e.g. 12.6, 21.6). */
export function formatUnitQty(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n - Math.round(n)) < 1e-9) return Math.round(n).toLocaleString("en-IN");
  return n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
