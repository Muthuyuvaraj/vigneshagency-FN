import type { Bill } from "@/data/types";

const KEY = "va-invoice";

/** Persist generated bill so refresh/share URL still resolves on this device/session. */
export function persistInvoiceDraft(bill: Bill) {
  try {
    sessionStorage.setItem(`${KEY}:${bill.id}`, JSON.stringify(bill));
  } catch {
    /* quota / private mode */
  }
}

export function loadInvoiceDraft(id: string): Bill | null {
  try {
    const raw = sessionStorage.getItem(`${KEY}:${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as Bill;
  } catch {
    return null;
  }
}
