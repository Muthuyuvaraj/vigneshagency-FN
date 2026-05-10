import type { Dealer } from "@/data/types";
import { apiUrl } from "./config";

const DEALERS_PATH = "/api/dealers";

export type CreateDealerPayload = {
  dealerId: string;
  name: string;
  phone: string;
  area: string;
  openingBalance: number;
};

async function readErrorBody(res: Response): Promise<string> {
  try {
    const t = await res.text();
    return t || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

/** Map one API/Mongo dealer document to app `Dealer`. */
export function parseDealerDocument(json: unknown): Dealer | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const id =
    o._id != null ? String(o._id) : o.id != null ? String(o.id) : null;
  if (!id) return null;
  const dealerCode = String(o.dealerId ?? o.dealerCode ?? "").trim();
  const name = String(o.name ?? "").trim();
  if (!name) return null;
  const balanceRaw = o.balance ?? o.openingBalance;
  const balance =
    typeof balanceRaw === "number" && Number.isFinite(balanceRaw)
      ? balanceRaw
      : parseFloat(String(balanceRaw ?? "0")) || 0;
  return {
    id,
    dealerCode: dealerCode || "—",
    name,
    phone: String(o.phone ?? ""),
    area: String(o.area ?? ""),
    balance,
    address: o.address != null ? String(o.address) : undefined,
  };
}

function normalizeDealersResponse(data: unknown): Dealer[] {
  let list: unknown[] = [];
  if (Array.isArray(data)) {
    list = data;
  } else if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.dealers)) list = o.dealers;
    else if (Array.isArray(o.data)) list = o.data;
  }
  return list.map(parseDealerDocument).filter((d): d is Dealer => d != null);
}

/**
 * GET all dealers — uses `apiUrl` so dev uses Vite proxy `/api` → localhost:3001.
 */
export async function getDealers(): Promise<Dealer[]> {
  const res = await fetch(apiUrl(DEALERS_PATH));
  if (!res.ok) {
    throw new Error(await readErrorBody(res));
  }
  const data: unknown = await res.json();
  return normalizeDealersResponse(data);
}

/**
 * DELETE one dealer by id (`_id` from Mongo).
 */
export async function deleteDealer(id: string): Promise<void> {
  const path = `${DEALERS_PATH}/${encodeURIComponent(id)}`;
  const res = await fetch(apiUrl(path), { method: "DELETE" });
  if (!res.ok) {
    throw new Error(await readErrorBody(res));
  }
}

/**
 * POST new dealer — same contract as backend `POST /api/dealers`.
 * Uses `apiUrl` so dev hits Vite proxy `/api` → localhost:3001.
 */
export async function createDealer(payload: CreateDealerPayload): Promise<unknown> {
  const res = await fetch(apiUrl(DEALERS_PATH), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readErrorBody(res));
  }
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** Map API JSON (Mongo may use `_id`, `dealerId`) into a `Dealer` for local list / session. */
export function dealerFromCreateResponse(
  json: unknown,
  payload: CreateDealerPayload,
  clientFallbackId: string
): Dealer {
  if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    const id =
      o._id != null
        ? String(o._id)
        : o.id != null
          ? String(o.id)
          : clientFallbackId;
    const dealerCode = String(o.dealerId ?? o.dealerCode ?? payload.dealerId);
    const balanceRaw = o.openingBalance ?? o.balance;
    const balance =
      typeof balanceRaw === "number" && Number.isFinite(balanceRaw)
        ? balanceRaw
        : payload.openingBalance;
    return {
      id,
      dealerCode,
      name: String(o.name ?? payload.name),
      phone: String(o.phone ?? payload.phone),
      area: String(o.area ?? payload.area),
      balance,
    };
  }
  return {
    id: clientFallbackId,
    dealerCode: payload.dealerId,
    name: payload.name,
    phone: payload.phone,
    area: payload.area,
    balance: payload.openingBalance,
  };
}
