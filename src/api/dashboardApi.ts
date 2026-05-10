import { apiUrl } from "./config";
import { formatLocalCalendarYMD } from "@/lib/localCalendar";

const DASHBOARD_PATH = "/api/dashboard";

/** Row returned by `GET /api/dashboard` for recent activity (Mongo may use `_id`). */
export type DashboardRecentBill = {
  _id?: string;
  id?: string;
  dealerMongoId?: string;
  dealerId?: string;
  customerName?: string;
  dealerName?: string;
  total: number;
  date: string;
  status?: string;
};

/** Normalized dashboard stats (see `GET /api/dashboard`). */
export type DashboardData = {
  totalSales: number;
  pending: number;
  dealers: number;
  products: number;
  recentBills: DashboardRecentBill[];
  /** Today / week / month sales for the hero card breakdown (optional from API). */
  salesToday: number;
  salesWeek: number;
  salesMonth: number;
  /** Count of unpaid bills (optional; else derived from `recentBills`). */
  unpaidBillsCount: number;
};

/** Raw JSON from backend — supports current and legacy field names. */
type DashboardApiResponse = {
  totalSales?: number;
  pending?: number;
  dealers?: number;
  products?: number;
  recentBills?: unknown[];
  todaySales?: number;
  pendingAmount?: number;
  totalDealers?: number;
  totalProducts?: number;
  salesToday?: number;
  todaySalesAmount?: number;
  salesWeek?: number;
  weekSales?: number;
  salesMonth?: number;
  monthSales?: number;
  unpaidBillsCount?: number;
  pendingBillsCount?: number;
};

/** String from API / Mongo (may be `$oid`), or `undefined` if empty. */
function stringOrMongoId(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "object" && v !== null && "$oid" in v) {
    const oid = (v as { $oid: unknown }).$oid;
    if (oid != null && typeof oid !== "object") {
      const s = String(oid).trim();
      return s.length ? s : undefined;
    }
  }
  const s = typeof v === "string" ? v.trim() : String(v).trim();
  return s.length ? s : undefined;
}

function coalesceNonEmptyString(...candidates: unknown[]): string | undefined {
  for (const c of candidates) {
    if (typeof c !== "string") continue;
    const t = c.trim();
    if (t && t !== "—") return t;
  }
  return undefined;
}

/** 24-char hex BSON ObjectId (likely not human-readable dealer name). */
function looksLikeMongoObjectIdHex(s: string): boolean {
  return /^[a-f\d]{24}$/i.test(s.trim());
}

function resolveRecentBillStoreName(raw: Record<string, unknown>): string | undefined {
  const dealerRaw = raw["dealer"];
  /** Some APIs store readable shop title in `dealer` as plain string instead of nesting. */
  if (typeof dealerRaw === "string") {
    const d = dealerRaw.trim();
    if (d.length > 0 && !looksLikeMongoObjectIdHex(d)) return d;
  }

  let nested: Record<string, unknown> | undefined;
  if (dealerRaw && typeof dealerRaw === "object" && dealerRaw !== null) {
    nested = dealerRaw as Record<string, unknown>;
  }

  return coalesceNonEmptyString(
    raw["dealerName"],
    raw["customerName"],
    nested?.["name"],
    nested?.["dealerName"],
    nested?.["shopName"],
    nested?.["storeName"],
    nested?.["businessName"],
    nested?.["title"],
    raw["shopName"],
    raw["partyName"],
    raw["billToParty"],
    raw["outletName"],
    raw["retailerName"],
    raw["BuyerName"],
    raw["buyerName"],
    raw["storeName"],
    raw["store"],
    raw["customer"],
    raw["billTo"],
    raw["name"],
    raw["dealer_name"],
    raw["customer_name"],
    raw["shop_name"],
    raw["store_name"]
  );
}

function normalizeRecentBillEntry(entry: unknown): DashboardRecentBill {
  const raw = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;

  const totalN = Number(raw["total"]);
  const total = Number.isFinite(totalN) ? totalN : 0;

  const dr = raw["date"];
  let date = "";
  if (typeof dr === "string") date = dr;
  else if (dr instanceof Date && !Number.isNaN(dr.getTime())) date = dr.toISOString();

  const _id = stringOrMongoId(raw["_id"]);
  const id = stringOrMongoId(raw["id"]) ?? _id;

  const dealerFromNested =
    raw["dealer"] && typeof raw["dealer"] === "object" && raw["dealer"] !== null
      ? stringOrMongoId(
          (raw["dealer"] as Record<string, unknown>)["id"] ??
            (raw["dealer"] as Record<string, unknown>)["_id"]
        )
      : undefined;

  const dealerField = raw["dealer"];
  const dealerIdFromOidString =
    typeof dealerField === "string" && looksLikeMongoObjectIdHex(dealerField)
      ? dealerField.trim()
      : undefined;

  const dealerId =
    stringOrMongoId(raw["dealerId"]) ??
    stringOrMongoId(raw["dealer_id"]) ??
    dealerFromNested ??
    dealerIdFromOidString ??
    /** Some summaries only echo display code, not `_id`. */
    stringOrMongoId(raw["dealerCode"]) ??
    stringOrMongoId(raw["dealer_code"]);

  const status = typeof raw["status"] === "string" ? raw["status"] : undefined;
  /**
   * Primary invoice/dashboard labels (camelCase bills + summary rows that omit `dealerName`
   * and only send `customerName`).
   */
  /** Fields stored on the invoice document in Mongo — not from joining dealers. */
  const invoiceTier = coalesceNonEmptyString(
    raw["dealerName"],
    raw["DealerName"],
    raw["dealer_name"],
    raw["shopName"],
    raw["storeName"],
    raw["shop_name"],
    raw["store_name"],
    raw["customerName"],
    raw["CustomerName"],
    raw["customer_name"]
  );
  const resolvedName = invoiceTier ?? resolveRecentBillStoreName(raw);

  const dealerMongoId =
    stringOrMongoId(raw["dealerMongoId"]) ?? stringOrMongoId(raw["dealer_mongo_id"]);

  return {
    _id: _id ?? id,
    id: id ?? _id,
    dealerMongoId,
    dealerId,
    dealerName: resolvedName,
    customerName: resolvedName,
    total,
    date,
    status,
  };
}

function countUnpaidFromRecent(bills: DashboardRecentBill[] | undefined): number {
  if (!Array.isArray(bills)) return 0;
  return bills.filter((b) => {
    const s = (b.status ?? "pending").toLowerCase();
    return s !== "paid" && s !== "cancelled";
  }).length;
}

/** Plain `YYYY-MM-DD` compares to today’s local key; datetimes fall back to local calendar of parsed instant. */
function billIsOnLocalToday(dateStr: string, todayKey: string): boolean {
  const s = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s === todayKey;
  const ts = Date.parse(s);
  if (Number.isNaN(ts)) return false;
  return formatLocalCalendarYMD(ts) === todayKey;
}

/**
 * When the backend omits `salesToday`, sum bill totals whose `date` falls on today's
 * calendar day locally. Excludes cancelled bills. Matches how shop staff expect "today."
 */
function deriveSalesTodayFromRecent(bills: DashboardRecentBill[]): number {
  const todayKey = formatLocalCalendarYMD();
  let sum = 0;
  for (const b of bills) {
    if (!billIsOnLocalToday(String(b.date ?? ""), todayKey)) continue;
    const s = (b.status ?? "").toLowerCase();
    if (s === "cancelled") continue;
    const t = Number(b.total);
    if (!Number.isNaN(t)) sum += t;
  }
  return Math.round(sum * 100) / 100;
}

function normalizeDashboard(raw: DashboardApiResponse): DashboardData {
  const recentBillsRaw = Array.isArray(raw.recentBills) ? raw.recentBills : [];
  const recentBills = recentBillsRaw.map(normalizeRecentBillEntry);
  const totalSales = Number(raw.totalSales ?? raw.todaySales ?? 0) || 0;
  const hasGranularToday = raw.salesToday != null || raw.todaySalesAmount != null;
  const derivedTodaySales = deriveSalesTodayFromRecent(recentBills);
  /** Never force 0 just because `totalSales` exists without `salesToday` — derive from `recentBills` instead. */
  const salesToday = hasGranularToday
    ? Number(raw.salesToday ?? raw.todaySalesAmount ?? 0) || 0
    : derivedTodaySales;
  const salesWeek = Number(raw.salesWeek ?? raw.weekSales ?? totalSales) || 0;
  const salesMonth = Number(raw.salesMonth ?? raw.monthSales ?? totalSales) || 0;
  const apiUnpaid = raw.unpaidBillsCount ?? raw.pendingBillsCount;
  const unpaidBillsCount =
    typeof apiUnpaid === "number" && !Number.isNaN(apiUnpaid)
      ? apiUnpaid
      : countUnpaidFromRecent(recentBills);

  return {
    totalSales,
    pending: Number(raw.pending ?? raw.pendingAmount ?? 0) || 0,
    dealers: Number(raw.dealers ?? raw.totalDealers ?? 0) || 0,
    products: Number(raw.products ?? raw.totalProducts ?? 0) || 0,
    recentBills,
    salesToday,
    salesWeek,
    salesMonth,
    unpaidBillsCount,
  };
}

async function readErrorBody(res: Response): Promise<string> {
  try {
    const t = await res.text();
    return t || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export async function getDashboard(): Promise<DashboardData> {
  const res = await fetch(apiUrl(DASHBOARD_PATH));
  if (!res.ok) {
    throw new Error(await readErrorBody(res));
  }
  const raw = (await res.json()) as DashboardApiResponse;
  return normalizeDashboard(raw);
}

/** Dispatched after mutating data the home dashboard displays (e.g. new dealer). */
export const DASHBOARD_REFRESH_EVENT = "va:dashboard-refresh";

export function requestDashboardRefresh(): void {
  window.dispatchEvent(new Event(DASHBOARD_REFRESH_EVENT));
}
