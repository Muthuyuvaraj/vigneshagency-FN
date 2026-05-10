import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import type { Bill } from "@/data/types";
import { billLineAmount, billLinesSubtotal } from "@/lib/billLineMath";
import { formatCrateQtyDisplay } from "@/lib/crateQty";
import { deriveBillPaymentStatus } from "@/lib/billingCalculations";
import { formatRupees, formatUnitQty } from "@/lib/formatMoney";
import { SELLER } from "@/data/seller";
import { getInvoiceQrValue } from "@/lib/invoiceThermal";

/** Align PDF with app invoice UI (green primary, greys, light table header). */
const PDF = {
  primary: [46, 125, 50] as [number, number, number], // #2E7D32
  text: [33, 33, 33] as [number, number, number], // #212121
  muted: [117, 117, 117] as [number, number, number], // #757575
  tableHeadBg: [245, 247, 249] as [number, number, number], // #F5F7F9
  border: [224, 224, 224] as [number, number, number], // #E0E0E0
  white: [255, 255, 255] as [number, number, number],
} as const;

function invoiceDisplayTotal(bill: Bill): number {
  const totalFromLines = billLinesSubtotal(bill.items);
  return bill.total === totalFromLines ? bill.total : totalFromLines;
}

function drawA4Header(doc: jsPDF, bill: Bill, marginMm: number, pageWidth: number): number {
  const usable = pageWidth - 2 * marginMm;
  const leftColW = usable * 0.52;
  const gap = 6;
  const rightX = marginMm + leftColW + gap;
  const rightColW = usable - leftColW - gap;

  let yLeft = 16;
  doc.setTextColor(...PDF.primary);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(SELLER.businessName, marginMm, yLeft);
  yLeft += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...PDF.muted);
  doc.text(SELLER.tagline, marginMm, yLeft);
  yLeft += 5;
  for (const line of SELLER.addressLines) {
    doc.text(line, marginMm, yLeft);
    yLeft += 4.2;
  }
  doc.text("Tamil Nadu", marginMm, yLeft);
  yLeft += 4.8;
  doc.text(`Phone: ${SELLER.phone}`, marginMm, yLeft);
  yLeft += 4.2;
  doc.text(`GSTIN: ${SELLER.gstin}`, marginMm, yLeft);

  let yRight = 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PDF.muted);
  doc.text("Bill To:", rightX, yRight);
  yRight += 5.5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PDF.text);
  const nameLines = doc.splitTextToSize(bill.dealerName || "—", rightColW);
  doc.text(nameLines, rightX, yRight);
  yRight += Math.max(nameLines.length, 1) * 4.2 + 2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...PDF.muted);
  if (bill.dealerCode) {
    doc.text(`Dealer ID: ${bill.dealerCode}`, rightX, yRight);
    yRight += 4.2;
  }
  if (bill.dealerArea) {
    doc.text(`Area: ${bill.dealerArea}`, rightX, yRight);
    yRight += 4.2;
  }
  if (bill.dealerPhone) {
    doc.text(`Phone: ${bill.dealerPhone}`, rightX, yRight);
    yRight += 4.2;
  }

  const yBelow = Math.max(yLeft, yRight) + 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PDF.muted);
  doc.text("TAX INVOICE", pageWidth / 2, yBelow, { align: "center" });

  let y = yBelow + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PDF.text);
  doc.text(`Invoice No.: ${bill.id.toUpperCase()}`, marginMm, y);
  doc.text(`Date: ${bill.date}`, pageWidth - marginMm, y, { align: "right" });
  y += 10;
  doc.setTextColor(0, 0, 0);
  return y;
}

/** A4 PDF for Download/Share (mobile-friendly). */
export async function buildInvoicePdfBlob(bill: Bill): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = drawA4Header(doc, bill, margin, pageWidth);

  // Items table
  const displayTotal = invoiceDisplayTotal(bill);
  const body = bill.items.map((item) => {
    const crates = item.qty;
    const units = item.qty * item.litersPerCrate;
    return [
      item.name,
      item.size || "—",
      formatCrateQtyDisplay(crates),
      formatUnitQty(units),
      formatRupees(item.price),
      formatRupees(billLineAmount(item)),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["Product", "Variant", "Crates", "Liters", "Rs/liter", "Total"]],
    body,
    foot: [
      [
        { content: "Total", colSpan: 5, styles: { halign: "right", fontStyle: "bold" } },
        { content: `Rs. ${formatRupees(displayTotal)}`, styles: { halign: "right", fontStyle: "bold" } },
      ],
    ],
    showFoot: "lastPage",
    styles: {
      fontSize: 9,
      cellPadding: 2,
      valign: "middle",
      overflow: "linebreak",
      lineWidth: 0.15,
      lineColor: [...PDF.border],
      textColor: [...PDF.text],
      fillColor: [...PDF.white],
    },
    headStyles: {
      fillColor: [...PDF.tableHeadBg],
      textColor: [...PDF.muted],
      fontStyle: "bold",
    },
    footStyles: {
      fillColor: [...PDF.tableHeadBg],
      textColor: [...PDF.text],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { halign: "left", cellWidth: 70 },
      1: { halign: "left", cellWidth: 22, textColor: [...PDF.muted] },
      2: { halign: "center", cellWidth: 18 },
      3: { halign: "center", cellWidth: 18 },
      4: { halign: "right", cellWidth: 22 },
      5: { halign: "right", cellWidth: 26 },
    },
    margin: { left: margin, right: margin },
  });

  const docWithTable = doc as jsPDF & { lastAutoTable?: { finalY: number } };
  const afterTable = (docWithTable.lastAutoTable?.finalY ?? y) + 10;

  // Totals (crates + liters) shown under table
  let totalCrates = 0;
  let totalQty = 0;
  for (const item of bill.items) {
    totalCrates += item.qty;
    totalQty += item.qty * item.litersPerCrate;
  }

  const rightX = pageWidth - margin;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...PDF.muted);
  doc.text(`Total Crates: ${formatCrateQtyDisplay(totalCrates)}`, margin, afterTable);
  doc.text(`Total Liters: ${formatUnitQty(totalQty)}`, margin + 60, afterTable);
  doc.setTextColor(0, 0, 0);

  // Payment summary
  const paid = bill.paidAmount ?? 0;
  const { pendingAmount: pending, balanceToReturn: change } = deriveBillPaymentStatus(displayTotal, paid);
  const paymentLine =
    bill.status === "cancelled"
      ? "Payment: Cancelled — not payable"
      : bill.status === "paid"
        ? change > 0
          ? `Payment: Received in full — return change Rs. ${formatRupees(change)}`
          : "Payment: Received in full"
        : bill.status === "partial"
          ? `Payment: Partial — paid Rs. ${formatRupees(paid)}, pending Rs. ${formatRupees(pending)}`
          : `Payment: Pending — Rs. ${formatRupees(pending)}`;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...PDF.muted);
  doc.text(paymentLine, margin, afterTable + 10);
  doc.text(`Status: ${bill.status.toUpperCase()}`, pageWidth / 2, afterTable + 14.5, { align: "center" });
  doc.setTextColor(0, 0, 0);

  // QR bottom-right (optional but kept)
  const qrDataUrl = await QRCode.toDataURL(getInvoiceQrValue(bill), {
    width: 240,
    margin: 0,
    color: { dark: "#000000", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });
  const qrMm = 28;
  const qrX = pageWidth - margin - qrMm;
  const qrY = afterTable + 18;
  doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrMm, qrMm);

  return doc.output("blob");
}

export async function downloadInvoicePdf(bill: Bill, filename?: string): Promise<void> {
  const blob = await buildInvoicePdfBlob(bill);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? `Invoice-${bill.id}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export type ShareInvoiceResult =
  | { ok: true; mode: "shared" | "shared_text" | "downloaded" }
  | { ok: false; reason: "cancelled" | "unsupported" };

/**
 * Shares the invoice PDF via the Web Share API when available (mobile: WhatsApp, Telegram, Mail, Drive, etc.).
 * Falls back to downloading the PDF when file share is not supported (typical on desktop browsers).
 */
export async function shareInvoicePdf(bill: Bill): Promise<ShareInvoiceResult> {
  const blob = await buildInvoicePdfBlob(bill);
  const filename = `Invoice-${bill.id}.pdf`;
  const file = new File([blob], filename, { type: "application/pdf" });
  const title = `Invoice ${bill.id.toUpperCase()}`;
  const totalStr = formatRupees(invoiceDisplayTotal(bill));
  const text = `${title} — ${bill.dealerName}. Total Rs. ${totalStr}`;

  if (!navigator.share) {
    await downloadInvoicePdf(bill, filename);
    return { ok: true, mode: "downloaded" };
  }

  try {
    const canFiles =
      typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });

    if (canFiles) {
      await navigator.share({ title, text, files: [file] });
      return { ok: true, mode: "shared" };
    }

    await navigator.share({
      title,
      text: `${text}\n\n(Open the app and use Download to save the PDF if needed.)`,
      url: window.location.href,
    });
    return { ok: true, mode: "shared_text" };
  } catch (e: unknown) {
    if (e && typeof e === "object" && "name" in e && (e as { name: string }).name === "AbortError") {
      return { ok: false, reason: "cancelled" };
    }
    await downloadInvoicePdf(bill, filename);
    return { ok: true, mode: "downloaded" };
  }
}
