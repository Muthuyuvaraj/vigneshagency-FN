import { useMemo, useState } from "react";
import { useProducts } from "@/hooks/useProducts";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { useDealers } from "@/hooks/useDealers";
import type { CrateCartLine, Product } from "@/data/types";
import { formatRupees, formatUnitQty } from "@/lib/formatMoney";
import {
  CRATE_FRACTION_OPTIONS,
  formatCrateQtyDisplay,
  mergeCrateQty,
  normalizeCrateQty,
  splitCrateQty,
} from "@/lib/crateQty";
import { ChevronDown, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { buildCrateLine, crateCartSubtotal, crateLineAmount, crateLineToBillItem } from "@/lib/crateCart";
import { createBillFromCart, deriveBillPaymentStatus } from "@/lib/billingCalculations";
import { Input } from "@/components/ui/input";
import { persistInvoiceDraft } from "@/lib/invoiceDraft";
import { createBill as createBillApi } from "@/api/billApi";

const AGENCY_NAME = "Vignesh Agency";

type CurdVariant = {
  id: string;
  variant: string;
  qtyPerCrate: number;
  literPerCrate: number;
  ratePerCrate?: number;
  ratePerLiter?: number;
};

const CURD_VARIANTS: CurdVariant[] = [
  { id: "curd-125g", variant: "125g", qtyPerCrate: 90, literPerCrate: 11, ratePerCrate: 704 },
  { id: "curd-475g", variant: "475g", qtyPerCrate: 28, literPerCrate: 11, ratePerLiter: 64 },
  { id: "curd-1kg", variant: "1KG", qtyPerCrate: 12, literPerCrate: 12, ratePerLiter: 64 },
];

const BillingPage = () => {
  const navigate = useNavigate();
  const { dealers, loading: dealersLoading, error: dealersError } = useDealers();
  const { products, loading: productsLoading, error: productsError } = useProducts();
  const [selectedDealerId, setSelectedDealerId] = useState("");
  const [cart, setCart] = useState<CrateCartLine[]>([]);
  const [savingBill, setSavingBill] = useState(false);
  const [cartExpanded, setCartExpanded] = useState(true);
  const [paidAmountStr, setPaidAmountStr] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("none");

  const selectedDealer = useMemo(
    () => dealers.find((d) => d.id === selectedDealerId),
    [dealers, selectedDealerId]
  );

  const milkCatalog = useMemo(() => products.filter((p) => p.category === "milk"), [products]);

  const getCartCrates = (variantId: string) => cart.find((l) => l.variantId === variantId)?.qty ?? 0;

  const setVariantCratesQty = (
    productId: string,
    productName: string,
    variantId: string,
    variantName: string,
    price: number,
    litersPerCrate: number,
    extra: { category: "milk" | "curd"; qtyPerCrate?: number; ratePerCrate?: number },
    qty: number
  ) => {
    const q = normalizeCrateQty(qty);
    setCart((prev) => {
      if (q <= 0) return prev.filter((l) => l.variantId !== variantId);
      const existing = prev.find((l) => l.variantId === variantId);
      if (existing) {
        return prev.map((l) => (l.variantId === variantId ? { ...l, qty: q } : l));
      }
      const line = buildCrateLine(productId, productName, variantId, variantName, price, litersPerCrate, extra);
      return [...prev, { ...line, qty: q }];
    });
  };

  /** +/− adjust full crates; fractional part stays on ¼ / ½ / ¾ row. */
  const bumpWholeCratesLine = (
    productId: string,
    productName: string,
    variantId: string,
    variantName: string,
    price: number,
    litersPerCrate: number,
    extra: { category: "milk" | "curd"; qtyPerCrate?: number; ratePerCrate?: number },
    direction: 1 | -1
  ) => {
    const crates = getCartCrates(variantId);
    const { whole, frac } = splitCrateQty(crates);
    if (direction > 0) {
      setVariantCratesQty(
        productId,
        productName,
        variantId,
        variantName,
        price,
        litersPerCrate,
        extra,
        mergeCrateQty(whole + 1, frac)
      );
      return;
    }
    if (crates <= 0) return;
    if (whole > 0) {
      setVariantCratesQty(
        productId,
        productName,
        variantId,
        variantName,
        price,
        litersPerCrate,
        extra,
        mergeCrateQty(whole - 1, frac)
      );
    } else {
      setVariantCratesQty(productId, productName, variantId, variantName, price, litersPerCrate, extra, 0);
    }
  };

  const bumpWholeCrates = (
    product: Product,
    variantId: string,
    variantName: string,
    price: number,
    litersPerCrate: number,
    extra: { category: "milk" | "curd"; qtyPerCrate?: number; ratePerCrate?: number },
    direction: 1 | -1
  ) => bumpWholeCratesLine(product.id, product.name, variantId, variantName, price, litersPerCrate, extra, direction);

  const setCrateFractionLine = (
    productId: string,
    productName: string,
    variantId: string,
    variantName: string,
    price: number,
    litersPerCrate: number,
    extra: { category: "milk" | "curd"; qtyPerCrate?: number; ratePerCrate?: number },
    frac: number
  ) => {
    const crates = getCartCrates(variantId);
    const { whole } = splitCrateQty(crates);
    setVariantCratesQty(
      productId,
      productName,
      variantId,
      variantName,
      price,
      litersPerCrate,
      extra,
      mergeCrateQty(whole, frac)
    );
  };

  const setCrateFraction = (
    product: Product,
    variantId: string,
    variantName: string,
    price: number,
    litersPerCrate: number,
    extra: { category: "milk" | "curd"; qtyPerCrate?: number; ratePerCrate?: number },
    frac: number
  ) => setCrateFractionLine(product.id, product.name, variantId, variantName, price, litersPerCrate, extra, frac);

  const subtotal = useMemo(() => crateCartSubtotal(cart), [cart]);
  const paidAmount = paidAmountStr === "" ? 0 : Number(paidAmountStr) || 0;
  const { pendingAmount, balanceToReturn, status: paymentDisplayStatus } = useMemo(
    () => deriveBillPaymentStatus(subtotal, paidAmount),
    [subtotal, paidAmount]
  );

  const cratesInCart = useMemo(() => cart.reduce((s, l) => s + l.qty, 0), [cart]);
  const litersInCart = useMemo(
    () => cart.reduce((s, l) => s + l.qty * l.litersPerCrate, 0),
    [cart]
  );

  const generateBill = async () => {
    if (!selectedDealerId) {
      toast.error("Please select a dealer");
      return;
    }
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    const items = cart.map(crateLineToBillItem);
    const preSubtotal = crateCartSubtotal(cart);
    const preTotal = preSubtotal;
    if (isNaN(preSubtotal) || isNaN(preTotal)) {
      alert("Calculation error - check product data");
      return;
    }
    const dealer = dealers.find((d) => d.id === selectedDealerId);
    /** Mongo dealers `_id` — never use this as invoice display `dealerId` (`A-102` lives in dealerCode). */
    const dealerMongoId = dealer ? String(dealer.id).trim() : selectedDealerId.trim();
    /** Display dealer id stored on invoice (e.g. A-102) — not BSON. */
    const dealerDisplayId = dealer?.dealerCode?.trim() ?? "—";
    const bill = createBillFromCart({
      dealerMongoId,
      dealerId: dealerDisplayId,
      dealerName: dealer?.name ?? "Dealer",
      dealerCode: dealer?.dealerCode ?? dealerDisplayId,
      dealerArea: dealer?.area ?? "",
      dealerPhone: dealer?.phone ?? "",
      items,
      paidAmount,
      paymentMethod,
    });
    setSavingBill(true);
    try {
      const saved = await createBillApi(bill);
      persistInvoiceDraft(saved);
      toast.success("Bill saved to server");
      setCart([]);
      setPaidAmountStr("");
      setPaymentMethod("none");
      navigate(`/invoice/${saved.id}`, { state: { bill: saved } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save bill";
      toast.error(msg, { description: "Check that the API is running (port 3001) and CORS allows this origin." });
    } finally {
      setSavingBill(false);
    }
  };

  return (
    <AppLayout>
      <div
        className={`space-y-5 -mx-4 -mt-4 px-4 pt-4 min-h-[60vh] ${
          cart.length > 0
            ? cartExpanded
              ? "pb-[min(52vh,22rem)]"
              : "pb-36"
            : "pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]"
        }`}
      >
        {/* Header — Create Bill / agency / dealer pill */}
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground tracking-tight">Create Bill</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{AGENCY_NAME}</p>
          </div>
          <div className="relative shrink-0 max-w-[48%]">
            <select
              value={selectedDealerId}
              onChange={(e) => setSelectedDealerId(e.target.value)}
              disabled={dealersLoading}
              className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
              aria-label="Select dealer store"
            >
              <option value="">{dealersLoading ? "Loading…" : "Select store"}</option>
              {dealers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <div
              className={`rounded-full px-3 py-2 text-center text-xs font-semibold truncate border ${
                selectedDealer
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border"
              }`}
            >
              {selectedDealer?.name ?? (dealersLoading ? "Loading…" : "Select store")}
            </div>
          </div>
        </header>

        {dealersError && !dealersLoading && (
          <p className="text-sm text-destructive text-center">{dealersError}</p>
        )}

        {productsLoading && (
          <p className="text-sm text-muted-foreground text-center py-8">Loading products…</p>
        )}

        {productsError && !productsLoading && (
          <p className="text-sm text-destructive text-center py-2">{productsError}</p>
        )}

        {!productsLoading && products.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No products added yet</p>
        )}

        <div className="space-y-6">
          {/* MILK (unchanged UI) */}
          {!productsLoading && milkCatalog.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.2em] pl-0.5">
                MILK
              </h2>
              <div className="space-y-3">
                {milkCatalog.flatMap((product) =>
                  product.variants.map((v) => {
                      const crates = getCartCrates(v.id);
                      const lineUnits = crates * v.unitsPerCrate;
                      const extra = { category: "milk" as const };
                      const displayTitle = `${product.name} ${v.variantName}`.replace(/\s+/g, " ").trim();
                      const { whole, frac } = splitCrateQty(crates);
                      const fracGlyph =
                        frac > 1e-6
                          ? CRATE_FRACTION_OPTIONS.find((o) => Math.abs(o.value - frac) < 1e-6)?.label ?? null
                          : null;
                      const showCrateHint =
                        product.id === milkCatalog[0]?.id &&
                        v.id === milkCatalog[0]?.variants[0]?.id;
                      return (
                        <div
                          key={v.id}
                          className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="text-sm font-semibold text-foreground leading-snug flex-1 min-w-0">
                              {displayTitle}
                            </h3>
                            <span className="shrink-0 text-[10px] font-medium capitalize px-2.5 py-1 rounded-full bg-primary/15 text-primary border border-primary/25">
                              {product.category}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-3">
                            ₹{formatRupees(v.unitPrice)}/L · {formatUnitQty(v.unitsPerCrate)} L/crate
                          </p>
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <div className="min-h-[2rem] flex items-center">
                              {crates > 0 ? (
                                <span className="inline-flex items-center rounded-lg bg-primary/15 text-primary text-xs font-semibold tabular-nums px-2.5 py-1 border border-primary/25">
                                  {formatUnitQty(lineUnits)} L
                                </span>
                              ) : (
                                <span className="text-[11px] text-muted-foreground">—</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  bumpWholeCrates(product, v.id, v.variantName, v.unitPrice, v.unitsPerCrate, extra, -1)
                                }
                                disabled={crates <= 0}
                                className="h-10 w-10 min-h-[44px] min-w-[44px] rounded-xl border border-border bg-secondary/80 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40 disabled:pointer-events-none touch-manipulation"
                                aria-label="Decrease full crates"
                              >
                                <Minus className="h-5 w-5 text-foreground" />
                              </button>
                              <div className="min-w-[2.75rem] text-center px-0.5 flex flex-col items-center justify-center min-h-[2.5rem]">
                                <span className="text-xl font-bold text-foreground tabular-nums leading-none">
                                  {crates <= 0 ? "0" : String(whole)}
                                </span>
                                <span className="block text-[11px] font-semibold text-foreground tabular-nums leading-tight mt-0.5 min-h-[1rem]">
                                  {fracGlyph ? (
                                    fracGlyph
                                  ) : (
                                    <span className="text-[9px] font-normal text-muted-foreground">crates</span>
                                  )}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  bumpWholeCrates(product, v.id, v.variantName, v.unitPrice, v.unitsPerCrate, extra, 1)
                                }
                                className="h-10 w-10 min-h-[44px] min-w-[44px] rounded-xl bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform touch-manipulation"
                                aria-label="Increase full crates"
                              >
                                <Plus className="h-5 w-5" />
                              </button>
                            </div>
                          </div>
                          <div
                            className="grid grid-cols-4 gap-1.5 rounded-xl border border-border bg-muted/40 p-1"
                            role="group"
                            aria-label="Partial crates"
                          >
                            {CRATE_FRACTION_OPTIONS.map((opt) => {
                              const active = Math.abs(frac - opt.value) < 1e-6;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() =>
                                    setCrateFraction(
                                      product,
                                      v.id,
                                      v.variantName,
                                      v.unitPrice,
                                      v.unitsPerCrate,
                                      extra,
                                      opt.value
                                    )
                                  }
                                  aria-pressed={active}
                                  className={`rounded-lg py-2.5 text-sm font-semibold tabular-nums transition-colors touch-manipulation ${
                                    active
                                      ? "bg-primary text-primary-foreground shadow-sm"
                                      : "bg-card text-foreground border border-border/80 hover:bg-muted"
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                          {showCrateHint ? (
                            <p className="text-[10px] text-muted-foreground mt-2 text-center leading-snug">
                              Tap ¼ ½ ¾ for partial crates · crates label below
                            </p>
                          ) : null}
                        </div>
                      );
                  })
                )}
              </div>
            </section>
          ) : null}

          {/* CURD (simple crate billing as per client requirement) */}
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.2em] pl-0.5">
              CURD
            </h2>
            <div className="space-y-3">
              {CURD_VARIANTS.map((v) => {
                const crates = getCartCrates(v.id);
                const totalLiter = crates * v.literPerCrate;
                const amount =
                  v.ratePerCrate != null ? crates * v.ratePerCrate : totalLiter * (v.ratePerLiter ?? 0);
                const { whole, frac } = splitCrateQty(crates);
                const fracGlyph =
                  frac > 1e-6
                    ? CRATE_FRACTION_OPTIONS.find((o) => Math.abs(o.value - frac) < 1e-6)?.label ?? null
                    : null;
                const curdExtra = {
                  category: "curd" as const,
                  qtyPerCrate: v.qtyPerCrate,
                  ratePerCrate: v.ratePerCrate,
                };
                const curdPrice = v.ratePerLiter ?? 0;
                const showCurdCrateHint = v.id === CURD_VARIANTS[0]?.id;

                return (
                  <div key={v.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-sm font-semibold text-foreground leading-snug flex-1 min-w-0">
                        Curd {v.variant}
                      </h3>
                      <span className="shrink-0 text-[10px] font-medium px-2.5 py-1 rounded-full bg-primary/15 text-primary border border-primary/25">
                        curd
                      </span>
                    </div>

                    <div className="text-xs text-muted-foreground space-y-0.5 mb-3">
                      <p>Qty/Crate: {formatUnitQty(v.qtyPerCrate)}</p>
                      <p>{formatUnitQty(v.literPerCrate)} Liter/Crate</p>
                      {v.ratePerCrate != null ? (
                        <p>Rate/Crate: ₹{formatRupees(v.ratePerCrate)}</p>
                      ) : (
                        <p>Rate/Liter: ₹{formatRupees(v.ratePerLiter ?? 0)}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="min-h-[2rem] flex flex-col justify-center">
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          Total Liter: <span className="text-foreground font-semibold">{formatUnitQty(totalLiter)}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          Total Amount: <span className="text-foreground font-semibold">₹{formatRupees(amount)}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            bumpWholeCratesLine(
                              "curd",
                              "Curd",
                              v.id,
                              v.variant,
                              curdPrice,
                              v.literPerCrate,
                              curdExtra,
                              -1
                            )
                          }
                          disabled={crates <= 0}
                          className="h-10 w-10 min-h-[44px] min-w-[44px] rounded-xl border border-border bg-secondary/80 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40 disabled:pointer-events-none touch-manipulation"
                          aria-label="Decrease full crates"
                        >
                          <Minus className="h-5 w-5 text-foreground" />
                        </button>
                        <div className="min-w-[2.75rem] text-center px-0.5 flex flex-col items-center justify-center min-h-[2.5rem]">
                          <span className="text-xl font-bold text-foreground tabular-nums leading-none">
                            {crates <= 0 ? "0" : String(whole)}
                          </span>
                          <span className="block text-[11px] font-semibold text-foreground tabular-nums leading-tight mt-0.5 min-h-[1rem]">
                            {fracGlyph ? (
                              fracGlyph
                            ) : (
                              <span className="text-[9px] font-normal text-muted-foreground">crates</span>
                            )}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            bumpWholeCratesLine(
                              "curd",
                              "Curd",
                              v.id,
                              v.variant,
                              curdPrice,
                              v.literPerCrate,
                              curdExtra,
                              1
                            )
                          }
                          className="h-10 w-10 min-h-[44px] min-w-[44px] rounded-xl bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform touch-manipulation"
                          aria-label="Increase full crates"
                        >
                          <Plus className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    <div
                      className="grid grid-cols-4 gap-1.5 rounded-xl border border-border bg-muted/40 p-1"
                      role="group"
                      aria-label="Partial crates"
                    >
                      {CRATE_FRACTION_OPTIONS.map((opt) => {
                        const active = Math.abs(frac - opt.value) < 1e-6;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              setCrateFractionLine(
                                "curd",
                                "Curd",
                                v.id,
                                v.variant,
                                curdPrice,
                                v.literPerCrate,
                                curdExtra,
                                opt.value
                              )
                            }
                            aria-pressed={active}
                            className={`rounded-lg py-2.5 text-sm font-semibold tabular-nums transition-colors touch-manipulation ${
                              active
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "bg-card text-foreground border border-border/80 hover:bg-muted"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    {showCurdCrateHint ? (
                      <p className="text-[10px] text-muted-foreground mt-2 text-center leading-snug">
                        Tap ¼ ½ ¾ for partial crates · crates label below
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {cart.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-40 safe-bottom overflow-x-hidden pointer-events-none">
          <div className="max-w-lg mx-auto px-3 sm:px-4 pointer-events-auto">
            <div className="rounded-t-2xl border border-border bg-card shadow-2xl overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
              <button
                type="button"
                onClick={() => setCartExpanded((e) => !e)}
                className="w-full flex items-center gap-2 bg-primary text-primary-foreground px-3 py-3.5 text-left active:opacity-95 touch-manipulation"
              >
                <ShoppingCart className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
                <span className="text-sm font-semibold shrink-0">Cart</span>
                <span className="rounded-full bg-primary-foreground/20 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums shrink-0">
                  {formatCrateQtyDisplay(cratesInCart)} crates
                </span>
                <span className="flex-1 min-w-0 text-right text-sm font-bold tabular-nums">
                  ₹{formatRupees(subtotal)}
                </span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 opacity-90 transition-transform ${cartExpanded ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>

              {cartExpanded && (
                <>
                  <div className="max-h-[min(40vh,280px)] overflow-y-auto overscroll-contain px-3 py-2 space-y-0 border-t border-border/60 bg-card">
                    {cart.map((line) => {
                      const totalL = line.qty * line.litersPerCrate;
                      return (
                        <div
                          key={line.variantId}
                          className="flex items-start justify-between gap-3 py-3 border-b border-border/50 last:border-0"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground leading-snug break-words">
                              {line.name} {line.size}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                              {formatCrateQtyDisplay(line.qty)} crates · {formatUnitQty(totalL)} L
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-foreground tabular-nums shrink-0">
                            ₹{formatRupees(crateLineAmount(line))}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-2 px-3 pb-2 space-y-3 border-t border-border/60 pt-3 bg-card">
                    <h3 className="text-sm font-semibold text-foreground">Payment</h3>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      placeholder="Enter paid amount"
                      value={paidAmountStr}
                      onChange={(e) => setPaidAmountStr(e.target.value)}
                      className="h-11 rounded-xl"
                    />
                    <div className="relative">
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full h-11 px-3 pr-9 rounded-xl border border-input bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="none">Select method</option>
                        <option value="cash">Cash</option>
                        <option value="gpay">GPay</option>
                        <option value="bank">Bank</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                    <div className="text-xs space-y-1 text-muted-foreground">
                      <p>
                        Paid: <span className="font-medium text-foreground tabular-nums">₹{formatRupees(paidAmount)}</span>
                      </p>
                      <p>
                        Pending:{" "}
                        <span className="font-medium text-foreground tabular-nums">₹{formatRupees(pendingAmount)}</span>
                      </p>
                      {balanceToReturn > 0 ? (
                        <p className="text-sm font-semibold text-primary tabular-nums pt-1">
                          Balance to return: ₹{formatRupees(balanceToReturn)}
                        </p>
                      ) : null}
                      <p className="pt-0.5">
                        Status:{" "}
                        <span className="text-foreground font-medium">
                          {paymentDisplayStatus === "paid"
                            ? balanceToReturn > 0
                              ? "Paid ✓ (give change)"
                              : "Paid ✓"
                            : paymentDisplayStatus === "partial"
                              ? "Partial"
                              : "Pending"}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 px-3 py-3 border-t border-border bg-card">
                    <button
                      type="button"
                      onClick={() => {
                        setCart([]);
                        setPaidAmountStr("");
                        setPaymentMethod("none");
                      }}
                      className="h-11 w-11 shrink-0 rounded-xl border border-destructive/40 text-destructive flex items-center justify-center active:scale-95 touch-target"
                      aria-label="Clear cart"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="flex-1 min-w-0 text-right pr-1">
                      <p className="text-[10px] text-muted-foreground">
                        {formatCrateQtyDisplay(cratesInCart)} crates · {formatUnitQty(litersInCart)} L
                      </p>
                      <p className="text-base font-bold text-primary tabular-nums">₹{formatRupees(subtotal)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={generateBill}
                      disabled={savingBill}
                      className="h-11 shrink-0 rounded-xl bg-primary text-primary-foreground px-4 text-sm font-semibold flex items-center gap-2 active:scale-95 touch-target disabled:opacity-60"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      {savingBill ? "Saving…" : "Generate"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default BillingPage;
