import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import QRCode from "react-qr-code";
import AppLayout from "@/components/AppLayout";
import { bills } from "@/data/mockData";
import type { Bill } from "@/data/types";
import { ArrowLeft, Printer, Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { getBillById } from "@/api/billApi";
import { downloadInvoicePdf, shareInvoicePdf } from "@/lib/invoicePdf";
import { billLineAmount, billLinesSubtotal } from "@/lib/billLineMath";
import { formatCrateQtyDisplay } from "@/lib/crateQty";
import { deriveBillPaymentStatus } from "@/lib/billingCalculations";
import { loadInvoiceDraft, persistInvoiceDraft } from "@/lib/invoiceDraft";
import { formatRupees, formatUnitQty } from "@/lib/formatMoney";
import { SELLER } from "@/data/seller";
import { getInvoiceQrValue, thermalBillTotals, thermalProductShortcut } from "@/lib/invoiceThermal";

type LocationState = { bill?: Bill };

function resolveBillLocally(idParam: string | undefined, routerState: unknown): Bill | undefined {
  if (!idParam) return undefined;
  const state = routerState as LocationState | null;
  const fromNav = state?.bill;
  if (fromNav && String(fromNav.id) === String(idParam)) return fromNav;
  const draft = loadInvoiceDraft(idParam);
  if (draft) return draft;
  return bills.find((b) => b.id === idParam || (b as { _id?: string })._id === idParam);
}

const InvoicePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [shareBusy, setShareBusy] = useState(false);
  /** `undefined` = still fetching from API · `Bill | null` = done */
  const [apiBill, setApiBill] = useState<Bill | null | undefined>(undefined);

  const localBill = useMemo(
    () => resolveBillLocally(id, location.state),
    [id, location.state]
  );

  useEffect(() => {
    if (localBill) {
      setApiBill(null);
      return;
    }
    if (!id) {
      setApiBill(null);
      return;
    }

    let cancelled = false;
    setApiBill(undefined);

    void (async () => {
      try {
        const fetched = await getBillById(id);
        if (cancelled) return;
        if (fetched) persistInvoiceDraft(fetched);
        setApiBill(fetched);
      } catch (e) {
        if (!cancelled) {
          setApiBill(null);
          toast.error(e instanceof Error ? e.message : "Could not load invoice", {
            description: "Check that the API is running (port 3001).",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, localBill]);

  const bill = localBill ?? (apiBill === undefined ? undefined : apiBill);

  const loadingNeeded = !!(id && !localBill && apiBill === undefined);

  if (loadingNeeded) {
    return (
      <AppLayout title="Invoice">
        <p className="text-muted-foreground">Loading invoice…</p>
      </AppLayout>
    );
  }

  if (!bill) {
    return (
      <AppLayout title="Invoice">
        <p className="text-muted-foreground">Invoice not found.</p>
      </AppLayout>
    );
  }

  const totalFromLines = billLinesSubtotal(bill.items);
  const displayTotal = bill.total === totalFromLines ? bill.total : totalFromLines;
  const paidForSummary = bill.paidAmount ?? 0;
  const { pendingAmount: summaryPending, balanceToReturn: changeToReturn } = deriveBillPaymentStatus(
    displayTotal,
    paidForSummary
  );

  const { totalCrates, totalQty, grandTotal } = thermalBillTotals(bill);
  const qrValue = getInvoiceQrValue(bill);

  const handlePrint = () => {
    const node = document.querySelector(".invoice-thermal");
    if (!node) {
      window.print();
      return;
    }

    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) {
      window.print();
      return;
    }

    // Minimal 80mm-only print document: shows proper thermal preview in mobile/desktop.
    const printCss = `
      @page { size: 80mm auto; margin: 0; }
      html, body { width: 80mm; margin: 0; padding: 0; background: #fff; color: #000; }
      * { -webkit-print-color-adjust: economy; print-color-adjust: economy; }
      .invoice-thermal, .invoice-thermal * { color: #000 !important; border-color: #000 !important; box-shadow: none !important; }
      .invoice-thermal { width: 80mm; max-width: 80mm; margin: 0 auto; padding: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
      .no-break { break-inside: avoid; page-break-inside: avoid; }
    `;

    win.document.open();
    win.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Print</title>
    <style>${printCss}</style>
  </head>
  <body>
    ${node.outerHTML}
    <script>
      window.onload = () => {
        window.focus();
        window.print();
        setTimeout(() => window.close(), 250);
      };
    </script>
  </body>
</html>`);
    win.document.close();
  };

  const handleDownloadPdf = async () => {
    try {
      await downloadInvoicePdf(bill);
      toast.success("PDF downloaded");
    } catch {
      toast.error("Could not create PDF");
    }
  };

  const handleSharePdf = async () => {
    setShareBusy(true);
    try {
      const result = await shareInvoicePdf(bill);
      if (!result.ok) {
        if ("reason" in result && result.reason === "cancelled") return;
        toast.error("Sharing is not available on this device");
        return;
      }
      if (result.mode === "downloaded") {
        toast.message("PDF saved", {
          description: "Your browser could not open the share sheet. Use the saved file to send via WhatsApp, Telegram, or email.",
        });
      } else if (result.mode === "shared_text") {
        toast.message("Link shared", {
          description: "If the PDF was not attached, use Download and attach the file manually.",
        });
      } else {
        toast.success("Ready to share");
      }
    } catch {
      toast.error("Could not share invoice");
    } finally {
      setShareBusy(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4 print:space-y-0">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-muted-foreground touch-target print:hidden"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* Thermal receipt — same DOM for screen + Print (80mm) */}
        <article
          className="invoice-thermal max-w-[80mm] mx-auto w-full bg-white text-black font-mono text-[11px] leading-snug px-2.5 py-3 sm:py-3 print:p-1 print:text-[10px] print:leading-tight"
          style={{ pageBreakInside: "avoid" }}
        >
          <header className="text-center space-y-0.5">
            <p className="text-xs font-bold tracking-wide sm:text-[12px] text-primary print:text-black print:text-[11px]">
              {SELLER.businessName}
            </p>
            <p className="text-[10px] text-neutral-800 print:text-[9px]">{SELLER.tagline}</p>
            <p className="text-[10px] print:text-[9px]">Phone: {SELLER.phone}</p>
            <p className="text-[10px] print:text-[9px]">GSTIN: {SELLER.gstin}</p>
          </header>

          <div className="border-t border-black my-2 print:my-1.5" aria-hidden />

          <div className="space-y-1 text-[10px] print:text-[9px]">
            <div className="grid grid-cols-[auto_1fr] gap-x-2">
              <span className="text-neutral-600">Invoice No</span>
              <span className="tabular-nums">{bill.id.toUpperCase()}</span>
              <span className="text-neutral-600">Date</span>
              <span className="tabular-nums">{bill.date}</span>
              <span className="text-neutral-600">Dealer</span>
              <span className="break-words">{bill.dealerName}</span>
            </div>
          </div>

          <div className="border-t border-black my-2 print:my-1.5" aria-hidden />

          <ul className="space-y-2 print:space-y-1.5">
            {bill.items.map((item, i) => {
              const crates = item.qty;
              const units = item.qty * item.litersPerCrate;
              const lineTotal = billLineAmount(item);
              const code = thermalProductShortcut(item.name);
              const title = [`${item.name} (${code})`, item.size].filter(Boolean).join(" ");
              const isCurd = item.category === "curd" || item.name.toLowerCase().includes("curd");
              return (
                <li key={`${item.name}-${item.size}-${i}`} className="break-inside-avoid">
                  <p className="font-medium text-[11px] sm:text-[12px] print:text-[10px] leading-tight">{title}</p>
                  {isCurd ? (
                    <p className="text-[10px] tabular-nums text-neutral-900 print:text-[9px]">
                      Crates: {formatCrateQtyDisplay(crates)} · Total Liter: {formatUnitQty(units)} · Rate:{" "}
                      {item.ratePerCrate != null ? `₹${formatRupees(item.ratePerCrate)}/crate` : `₹${formatRupees(item.price)}/L`} ·
                      Amount: ₹{formatRupees(lineTotal)}
                    </p>
                  ) : (
                    <p className="text-[10px] tabular-nums text-neutral-900 print:text-[9px]">
                      {formatCrateQtyDisplay(crates)} x {formatUnitQty(units)} x {formatRupees(item.price)} ={" "}
                      {formatRupees(lineTotal)}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="border-t border-black my-2 print:my-1.5" aria-hidden />

          <div className="font-mono text-[10px] tabular-nums print:text-[9px]">
            <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
              <span>Total Crates</span>
              <span className="text-right">{formatCrateQtyDisplay(totalCrates)}</span>
              <span>Total Qty</span>
              <span className="text-right">{formatUnitQty(totalQty)}</span>
              <span className="font-bold pt-0.5">Grand Total</span>
              <span className="text-right font-bold pt-0.5">{formatRupees(grandTotal)}</span>
            </div>
          </div>

          <div className="border-t border-black my-2 print:my-1.5" aria-hidden />

          {bill.status !== "cancelled" ? (
            <div className="text-[10px] space-y-0.5 text-neutral-900 print:text-[9px]">
              <p>Paid: ₹{formatRupees(bill.paidAmount ?? 0)}</p>
              <p>Pending: ₹{formatRupees(summaryPending)}</p>
              {paidForSummary > displayTotal && changeToReturn > 0 ? (
                <p>Return: ₹{formatRupees(changeToReturn)}</p>
              ) : null}
              {bill.paymentMethod ? <p className="capitalize">Method: {bill.paymentMethod}</p> : null}
            </div>
          ) : (
            <p className="text-[10px] print:text-[9px]">Cancelled — not payable</p>
          )}

          <p className="text-[10px] mt-1 print:text-[9px]">Status: {bill.status.toUpperCase()}</p>

          <div className="flex flex-col items-center gap-1.5 mt-3 print:mt-2">
            <QRCode
              value={qrValue}
              size={112}
              level="M"
              fgColor="#000000"
              bgColor="#ffffff"
              className="h-auto max-h-[28vw] w-[112px] max-w-[min(80mm,28vw)] print:max-h-[22mm] print:w-[22mm]"
            />
            <p className="text-[9px] text-neutral-700 print:text-[8px]">Thank you</p>
          </div>
        </article>

        <div className="grid grid-cols-3 gap-3 print:hidden">
          <button
            type="button"
            onClick={handlePrint}
            className="bg-primary text-primary-foreground rounded-xl p-3 flex flex-col items-center gap-1 touch-target active:scale-95 transition-transform"
          >
            <Printer className="h-5 w-5" />
            <span className="text-xs font-medium">Print</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="bg-info text-info-foreground rounded-xl p-3 flex flex-col items-center gap-1 touch-target active:scale-95 transition-transform"
          >
            <Download className="h-5 w-5" />
            <span className="text-xs font-medium">Download</span>
          </button>
          <button
            type="button"
            onClick={handleSharePdf}
            disabled={shareBusy}
            className="bg-card border text-foreground rounded-xl p-3 flex flex-col items-center gap-1 touch-target active:scale-95 transition-transform disabled:opacity-60"
          >
            <Share2 className="h-5 w-5" />
            <span className="text-xs font-medium">{shareBusy ? "…" : "Share"}</span>
          </button>
        </div>
      </div>
    </AppLayout>
  );
};

export default InvoicePage;
