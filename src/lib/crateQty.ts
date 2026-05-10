/** Crate quantity step for billing (+ / −). */
export const CRATE_QTY_STEP = 0.25;

/** Fractional crate part only (segmented picker). */
export const CRATE_FRACTION_OPTIONS = [
  { value: 0, label: "0" },
  { value: 0.25, label: "¼" },
  { value: 0.5, label: "½" },
  { value: 0.75, label: "¾" },
] as const;

/** Snap to 2 decimal places (paise-style for qty). */
export function normalizeCrateQty(qty: number): number {
  return Math.round(Math.max(0, qty) * 100) / 100;
}

/** Snap total crates to nearest ¼, then split into whole + {0, ¼, ½, ¾}. */
export function splitCrateQty(qty: number): { whole: number; frac: number } {
  const q = normalizeCrateQty(qty);
  const snapped = Math.round(q * 4) / 4;
  const whole = Math.floor(snapped + 1e-9);
  let frac = normalizeCrateQty(snapped - whole);
  frac = Math.round(frac * 4) / 4;
  if (frac >= 1 - 1e-9) {
    return { whole: whole + 1, frac: 0 };
  }
  return { whole, frac };
}

/** Whole crates + fractional part (one of 0, 0.25, 0.5, 0.75). */
export function mergeCrateQty(whole: number, frac: number): number {
  const w = Math.max(0, Math.floor(whole + 1e-9));
  const f = Math.round(Math.max(0, frac) * 4) / 4;
  return normalizeCrateQty(w + f);
}

function quarterGlyph(frac: number): string | null {
  if (Math.abs(frac - 0.25) < 0.001) return "¼";
  if (Math.abs(frac - 0.5) < 0.001) return "½";
  if (Math.abs(frac - 0.75) < 0.001) return "¾";
  return null;
}

/**
 * Nice display for crate counts: ¼, ½, ¾, 5¾, or integer / decimal fallback.
 */
export function formatCrateQtyDisplay(qty: number): string {
  const q = normalizeCrateQty(qty);
  const whole = Math.floor(q + 1e-9);
  const frac = normalizeCrateQty(q - whole);
  const g = quarterGlyph(frac);
  if (g && whole === 0) return g;
  if (g && whole > 0) return `${whole}${g}`;
  if (frac < 1e-6 && Number.isInteger(whole)) return String(whole);
  return q.toFixed(2).replace(/\.?0+$/, "");
}
