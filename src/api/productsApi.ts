import type { Product, ProductVariant } from "@/data/types";
import { apiUrl } from "./config";

const PRODUCTS_PATH = "/api/products";

/** Payload for `POST /api/products` (matches backend contract). */
export type CreateProductVariantPayload = {
  size: string;
  litersPerCrate: number;
  price: number;
  uom?: string;
  qtyPerCrate?: number;
  ratePerCrate?: number;
};

export type CreateProductPayload = {
  name: string;
  /** e.g. `"Milk"` | `"Curd"` — sent as returned from UI mapping */
  category: string;
  variants: CreateProductVariantPayload[];
};

/** Body for `PUT /api/products/:productId/variant` (add or update nested variant). */
export type UpsertProductVariantPayload = CreateProductVariantPayload & {
  hsnCode?: string;
  /** When set, backend should update this variant subdocument instead of appending. */
  variantId?: string;
};

async function readErrorBody(res: Response): Promise<string> {
  try {
    const t = await res.text();
    return t || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

function parseCategory(raw: unknown): Product["category"] {
  const s = String(raw ?? "").toLowerCase();
  if (s === "curd") return "curd";
  return "milk";
}

function mapVariantRecord(
  x: Record<string, unknown>,
  productId: string,
  index: number
): ProductVariant {
  const vid =
    x._id != null ? String(x._id) : x.id != null ? String(x.id) : `v-${productId}-${index}`;
  const variantName = String(x.size ?? x.variantName ?? "").trim() || `Variant ${index + 1}`;
  const lp = x.litersPerCrate;
  const unitsPerCrate =
    typeof lp === "number" && Number.isFinite(lp)
      ? lp
      : parseFloat(String(x.unitsPerCrate ?? "0"));
  const pr = x.price ?? x.unitPrice;
  const unitPrice =
    typeof pr === "number" && Number.isFinite(pr) ? pr : parseFloat(String(pr ?? "0"));
  const qtyPerCrateRaw = x.qtyPerCrate ?? x.qty_per_crate ?? x.qtyPerCase;
  const qtyPerCrate =
    typeof qtyPerCrateRaw === "number" && Number.isFinite(qtyPerCrateRaw)
      ? qtyPerCrateRaw
      : qtyPerCrateRaw != null
        ? parseFloat(String(qtyPerCrateRaw))
        : undefined;
  const ratePerCrateRaw = x.ratePerCrate ?? x.rate_per_crate;
  const ratePerCrate =
    typeof ratePerCrateRaw === "number" && Number.isFinite(ratePerCrateRaw)
      ? ratePerCrateRaw
      : ratePerCrateRaw != null
        ? parseFloat(String(ratePerCrateRaw))
        : undefined;
  return {
    id: vid,
    productId,
    variantName,
    unitsPerCrate: Number.isFinite(unitsPerCrate) ? unitsPerCrate : 0,
    unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
    hsnCode: x.hsnCode != null ? String(x.hsnCode) : undefined,
    uom: x.uom != null ? String(x.uom) : undefined,
    qtyPerCrate:
      qtyPerCrate != null && Number.isFinite(qtyPerCrate) && qtyPerCrate > 0 ? qtyPerCrate : undefined,
    ratePerCrate:
      ratePerCrate != null && Number.isFinite(ratePerCrate) && ratePerCrate > 0 ? ratePerCrate : undefined,
    createdAt: x.createdAt != null ? String(x.createdAt) : undefined,
  };
}

/** Map one API/Mongo product document to app `Product`. */
export function parseProductDocument(json: unknown): Product | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const id =
    o._id != null ? String(o._id) : o.id != null ? String(o.id) : null;
  if (!id) return null;
  const name = String(o.name ?? "").trim();
  if (!name) return null;
  const category = parseCategory(o.category);
  const rawVariants = Array.isArray(o.variants) ? o.variants : [];
  const variants: ProductVariant[] = rawVariants.map((v, i) => {
    const rec = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
    return mapVariantRecord(rec, id, i);
  });
  return {
    id,
    name,
    category,
    variants,
    createdAt: o.createdAt != null ? String(o.createdAt) : undefined,
  };
}

function normalizeProductsResponse(data: unknown): Product[] {
  let list: unknown[] = [];
  if (Array.isArray(data)) {
    list = data;
  } else if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.products)) list = o.products;
    else if (Array.isArray(o.data)) list = o.data;
  }
  return list.map(parseProductDocument).filter((p): p is Product => p != null);
}

/**
 * DELETE one product by id (`_id` from Mongo).
 */
export async function deleteProduct(id: string): Promise<void> {
  const path = `${PRODUCTS_PATH}/${encodeURIComponent(id)}`;
  const res = await fetch(apiUrl(path), { method: "DELETE" });
  if (!res.ok) {
    throw new Error(await readErrorBody(res));
  }
}

/**
 * GET all products — uses `apiUrl` so dev uses Vite proxy `/api` → localhost:3001.
 */
export async function getProducts(): Promise<Product[]> {
  const res = await fetch(apiUrl(PRODUCTS_PATH));
  if (!res.ok) {
    throw new Error(await readErrorBody(res));
  }
  const data: unknown = await res.json();
  return normalizeProductsResponse(data);
}

/**
 * POST new product — uses `apiUrl` so dev uses Vite proxy `/api` → localhost:3001.
 */
export async function createProduct(payload: CreateProductPayload): Promise<unknown> {
  const res = await fetch(apiUrl(PRODUCTS_PATH), {
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

/**
 * Add or update one variant on a product (`PUT /api/products/:id/variant`).
 * Uses `apiUrl` so dev uses Vite proxy → localhost:3001.
 */
export async function putProductVariant(
  productId: string,
  data: UpsertProductVariantPayload
): Promise<unknown> {
  const path = `${PRODUCTS_PATH}/${encodeURIComponent(productId)}/variant`;
  const res = await fetch(apiUrl(path), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
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

/** Alias for `putProductVariant` (same request). */
export const addVariant = putProductVariant;

/**
 * Remove one variant (`DELETE /api/products/:productId/variant/:variantId`).
 */
export async function deleteProductVariant(productId: string, variantId: string): Promise<void> {
  const path = `${PRODUCTS_PATH}/${encodeURIComponent(productId)}/variant/${encodeURIComponent(variantId)}`;
  const res = await fetch(apiUrl(path), { method: "DELETE" });
  if (!res.ok) {
    throw new Error(await readErrorBody(res));
  }
}

/** Map API document (Mongo may use `_id`, variants may use `size` / `price`) into app `Product`. */
export function productFromCreateResponse(
  json: unknown,
  fallback: { name: string; category: Product["category"] }
): Product {
  const parsed = parseProductDocument(json);
  if (parsed) return parsed;
  return {
    id: `p${Date.now()}`,
    name: fallback.name,
    category: fallback.category,
    variants: [],
    createdAt: new Date().toISOString(),
  };
}
