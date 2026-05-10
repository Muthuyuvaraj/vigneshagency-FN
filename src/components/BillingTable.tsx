import { Minus, Plus } from "lucide-react";
import type { CrateCartLine } from "@/data/types";
import { crateLineToCartItem, crateLineAmount } from "@/lib/crateCart";
import {
  getCartItemTotalUnits,
  getCartItemUnitPrice,
} from "@/lib/billingCalculations";
import { formatRupees, formatUnitQty } from "@/lib/formatMoney";
import { CRATE_QTY_STEP, formatCrateQtyDisplay } from "@/lib/crateQty";

type BillingTableProps = {
  items: CrateCartLine[];
  onCrateDelta: (variantId: string, delta: number) => void;
  layout?: "cards" | "table";
};

export function BillingTable({ items, onCrateDelta, layout = "cards" }: BillingTableProps) {
  if (items.length === 0) return null;

  if (layout === "cards") {
    return (
      <ul className="space-y-3 overflow-x-hidden">
        {items.map((line) => {
          const item = crateLineToCartItem(line);
          const unitPrice = getCartItemUnitPrice(item);
          const totalUnits = getCartItemTotalUnits(item);
          const lineTotal = crateLineAmount(line);
          return (
            <li
              key={line.variantId}
              className="rounded-xl border border-border/80 bg-card p-3 space-y-3 shadow-sm"
            >
              <div className="space-y-1">
                <p className="font-semibold text-foreground text-sm leading-snug break-words">
                  {line.name} {line.size}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  ₹{formatRupees(unitPrice)} per liter · {formatUnitQty(line.litersPerCrate)} L/crate
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onCrateDelta(line.variantId, -CRATE_QTY_STEP)}
                    disabled={line.qty <= 0}
                    className="h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 rounded-xl bg-muted flex items-center justify-center active:scale-95 transition-transform touch-manipulation disabled:opacity-40 disabled:pointer-events-none"
                    aria-label="Decrease crates by ¼"
                  >
                    <Minus className="h-5 w-5 text-foreground" />
                  </button>
                  <div className="flex flex-col items-center justify-center min-w-[3rem]">
                    <span className="text-xl font-bold text-foreground tabular-nums leading-none">
                      {formatCrateQtyDisplay(line.qty)}
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">crates</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCrateDelta(line.variantId, CRATE_QTY_STEP)}
                    className="h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform touch-manipulation"
                    aria-label="Increase crates by ¼"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>

                <div className="text-right min-w-[5rem]">
                  <p className="text-xs text-muted-foreground">{formatUnitQty(totalUnits)} L</p>
                  <p className="text-base font-bold text-foreground tabular-nums">₹{formatRupees(lineTotal)}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="hidden lg:block overflow-x-auto">
      <div className="border rounded-lg overflow-hidden text-[10px] min-w-[640px]">
        <div className="grid grid-cols-7 gap-x-1 bg-muted px-2 py-2 font-semibold text-muted-foreground uppercase">
          <span>Product</span>
          <span className="text-center">Variant</span>
          <span className="text-center">L/crate</span>
          <span className="text-center">Crates</span>
          <span className="text-center">Total L</span>
          <span className="text-right">₹/liter</span>
          <span className="text-right">Total</span>
        </div>
        {items.map((line) => {
          const item = crateLineToCartItem(line);
          return (
            <div key={line.variantId} className="grid grid-cols-7 gap-x-1 px-2 py-2 border-t items-center">
              <span className="text-foreground font-medium text-xs break-words">{line.name}</span>
              <span className="text-center text-muted-foreground text-xs">{line.size}</span>
              <span className="text-center tabular-nums">{formatUnitQty(line.litersPerCrate)}</span>
              <div className="flex justify-center">
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => onCrateDelta(line.variantId, -CRATE_QTY_STEP)}
                    disabled={line.qty <= 0}
                    className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center active:scale-95 touch-manipulation disabled:opacity-40 disabled:pointer-events-none"
                    aria-label="Decrease crates by ¼"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-6 text-center font-bold tabular-nums text-xs">
                    {formatCrateQtyDisplay(line.qty)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onCrateDelta(line.variantId, CRATE_QTY_STEP)}
                    className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center active:scale-95 touch-manipulation"
                    aria-label="Increase crates by ¼"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <span className="text-center font-medium tabular-nums text-xs">
                {formatUnitQty(getCartItemTotalUnits(item))}
              </span>
              <span className="text-right tabular-nums">₹{formatRupees(getCartItemUnitPrice(item))}</span>
              <span className="text-right font-semibold text-foreground text-xs">
                ₹{formatRupees(crateLineAmount(line))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default BillingTable;
