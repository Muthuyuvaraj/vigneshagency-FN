import type { Bill, BillLineItem } from "@/data/types";
import { apiUrl } from "./config";

const BILLS_PATH = "/api/mongo-bills";

/** Raw document from Mongo (may use `_id`). */
type MongoBillDoc = Bill & { _id?: string };

/** Prefer non-empty server string; otherwise keep client snapshot (insert responses often omit dealer fields). */
function serverStrElseClient(serverVal: unknown, clientVal: string | undefined): string {
  if (typeof serverVal === "string" && serverVal.trim() !== "") return serverVal.trim();
  return (clientVal ?? "").trim();
}

function serverStrOptElseClient(
  serverVal: unknown,
  clientVal: string | undefined
): string | undefined {
  if (typeof serverVal === "string" && serverVal.trim() !== "") return serverVal.trim();
  if (typeof clientVal === "string" && clientVal.trim() !== "") return clientVal.trim();
  return undefined;
}

function normalizeBill(clientBill: Bill, server: unknown): Bill {
  if (!server || typeof server !== "object") return clientBill;
  const s = server as Record<string, unknown>;
  /** Some drivers return only `{ insertedId, acknowledged }` from insertOne. */
  if (s.insertedId != null && s.id == null && s._id == null) {
    return { ...clientBill, id: String(s.insertedId) };
  }
  const id =
    (typeof s.id === "string" && s.id) ||
    (s._id != null ? String(s._id) : clientBill.id);
  const status =
    s.status === "paid" ||
    s.status === "pending" ||
    s.status === "partial" ||
    s.status === "cancelled"
      ? s.status
      : clientBill.status;
  const total = typeof s.total === "number" ? s.total : clientBill.total;
  const date = typeof s.date === "string" ? s.date : clientBill.date;
  const subtotal = typeof s.subtotal === "number" ? s.subtotal : clientBill.subtotal;
  const gst = typeof s.gst === "number" ? s.gst : clientBill.gst;
  const paidAmount = typeof s.paidAmount === "number" ? s.paidAmount : clientBill.paidAmount;
  const pendingAmount =
    typeof s.pendingAmount === "number" ? s.pendingAmount : clientBill.pendingAmount;
  const balanceToReturn =
    typeof s.balanceToReturn === "number" ? s.balanceToReturn : clientBill.balanceToReturn;
  const paymentMethod =
    typeof s.paymentMethod === "string" ? s.paymentMethod : clientBill.paymentMethod;
  const dealerMongoMerged = serverStrOptElseClient(s.dealerMongoId, clientBill.dealerMongoId);
  const dealerId = serverStrElseClient(s.dealerId, clientBill.dealerId);
  const dealerName = serverStrElseClient(s.dealerName, clientBill.dealerName);
  const dealerCode = serverStrOptElseClient(s.dealerCode, clientBill.dealerCode);
  const dealerArea = serverStrOptElseClient(s.dealerArea, clientBill.dealerArea);
  const dealerPhone = serverStrOptElseClient(s.dealerPhone, clientBill.dealerPhone);
  return {
    ...clientBill,
    id,
    dealerId,
    dealerName,
    ...(dealerMongoMerged != null && dealerMongoMerged !== "" ? { dealerMongoId: dealerMongoMerged } : {}),
    ...(dealerCode != null ? { dealerCode } : {}),
    ...(dealerArea != null ? { dealerArea } : {}),
    ...(dealerPhone != null ? { dealerPhone } : {}),
    date,
    subtotal,
    gst,
    total,
    paidAmount,
    pendingAmount,
    balanceToReturn,
    paymentMethod,
    status,
    ...(Array.isArray(s.items) ? { items: s.items as BillLineItem[] } : {}),
  };
}

/** Map API / Mongo invoice document → `Bill` (handles `_id`, line items). */
export function mongoBillDocToBill(raw: unknown): Bill | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id =
    (typeof o.id === "string" && o.id) ||
    (o._id != null
      ? typeof o._id === "object" && o._id !== null && "$oid" in o._id
        ? String((o._id as { $oid: string }).$oid)
        : String(o._id)
      : "") ||
    "";
  if (!id) return null;

  const lines = Array.isArray(o.items)
    ? (o.items as Record<string, unknown>[]).map(
        (r): BillLineItem => ({
          name: String(r.name ?? ""),
          size: String(r.size ?? ""),
          price: Number(r.price) || 0,
          litersPerCrate: Number(r.litersPerCrate) || 0,
          qty: Number(r.qty) || 0,
          ...(typeof r.category === "string"
            ? { category: r.category as BillLineItem["category"] }
            : {}),
          ...(typeof r.qtyPerCrate === "number" ? { qtyPerCrate: r.qtyPerCrate } : {}),
          ...(typeof r.ratePerCrate === "number" ? { ratePerCrate: r.ratePerCrate } : {}),
        })
      )
    : [];

  const rawStatus = String(o.status ?? "pending").toLowerCase();
  const statusNorm: Bill["status"] =
    rawStatus === "paid" ||
    rawStatus === "partial" ||
    rawStatus === "pending" ||
    rawStatus === "cancelled"
      ? rawStatus
      : rawStatus === "active"
        ? "pending"
        : "pending";

  const scratch: Bill = {
    id,
    dealerId: String(o.dealerId ?? ""),
    dealerMongoId:
      typeof o.dealerMongoId === "string" && o.dealerMongoId.trim() !== ""
        ? o.dealerMongoId.trim()
        : undefined,
    dealerName: String(o.dealerName ?? ""),
    dealerCode:
      typeof o.dealerCode === "string"
        ? o.dealerCode
        : typeof o.dealer_code === "string"
          ? o.dealer_code
          : undefined,
    dealerArea: typeof o.dealerArea === "string" ? o.dealerArea : undefined,
    dealerPhone: typeof o.dealerPhone === "string" ? o.dealerPhone : undefined,
    date: typeof o.date === "string" ? o.date : "",
    items: lines,
    subtotal: typeof o.subtotal === "number" ? o.subtotal : undefined,
    total: typeof o.total === "number" ? o.total : Number(o.total) || 0,
    paidAmount:
      typeof o.paidAmount === "number" ? o.paidAmount : Number(o.paidAmount ?? 0) || 0,
    pendingAmount:
      typeof o.pendingAmount === "number" ? o.pendingAmount : Number(o.pendingAmount ?? 0) || 0,
    balanceToReturn:
      typeof o.balanceToReturn === "number"
        ? o.balanceToReturn
        : typeof o.balanceToReturn === "string"
          ? Number(o.balanceToReturn) || undefined
          : undefined,
    paymentMethod: typeof o.paymentMethod === "string" ? o.paymentMethod : undefined,
    status: statusNorm,
    gst: typeof o.gst === "number" ? o.gst : undefined,
  };
  return normalizeBill(scratch, o);
}

/**
 * Resolve one bill by Mongo id/string id (recent bills dashboard).
 * Try `GET /api/mongo-bills/:id`; if it fails (404/no route), fall back to scanning `GET /api/mongo-bills`.
 */
export async function getBillById(id: string): Promise<Bill | null> {
  const enc = encodeURIComponent(id);
  const direct = await fetch(apiUrl(`${BILLS_PATH}/${enc}`));
  if (direct.ok) {
    const json: unknown = await direct.json();
    const doc = mongoBillDocToBill(json);
    if (doc) return doc;
  }
  try {
    const list = await getBills();
    for (const row of list) {
      const doc = mongoBillDocToBill(row);
      if (doc?.id === id) return doc;
    }
    return null;
  } catch {
    return null;
  }
}

export async function getBills(): Promise<MongoBillDoc[]> {
  const res = await fetch(apiUrl(BILLS_PATH));
  if (!res.ok) {
    throw new Error(await readErrorBody(res));
  }
  return res.json() as Promise<MongoBillDoc[]>;
}

/** POST body: never include `gst` (JSON omits `undefined`; strip legacy field defensively). */
function billPayloadForCreate(data: Bill): Bill {
  const { gst: _omit, ...rest } = data;
  return rest;
}

export async function createBill(data: Bill): Promise<Bill> {
  const res = await fetch(apiUrl(BILLS_PATH), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(billPayloadForCreate(data)),
  });
  if (!res.ok) {
    throw new Error(await readErrorBody(res));
  }
  const json: unknown = await res.json();
  return normalizeBill(data, json);
}

/**
 * Soft-cancel a bill (`status` → `cancelled`). Uses `apiUrl` (Vite proxy in dev).
 */
/**
 * Record additional payment against a bill (`PUT /api/mongo-bills/:id/pay`).
 * Backend may update `paidAmount`, `pendingAmount`, and `status`.
 */
export async function payBill(id: string, amount: number): Promise<Bill> {
  const path = `${BILLS_PATH}/${encodeURIComponent(id)}/pay`;
  const res = await fetch(apiUrl(path), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
  if (!res.ok) {
    throw new Error(await readErrorBody(res));
  }
  const json: unknown = await res.json();
  return json as Bill;
}

export async function cancelBill(id: string): Promise<unknown> {
  const path = `${BILLS_PATH}/${encodeURIComponent(id)}/cancel`;
  const res = await fetch(apiUrl(path), { method: "PUT" });
  if (!res.ok) {
    throw new Error(await readErrorBody(res));
  }
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function readErrorBody(res: Response): Promise<string> {
  try {
    const t = await res.text();
    return t || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}
