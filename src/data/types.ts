export interface Dealer {
  id: string;
  /** Display dealer ID on invoices and reports (e.g. 102). */
  dealerCode: string;
  name: string;
  phone: string;
  area: string;
  balance: number;
  address?: string;
}

/**
 * Variant belongs to exactly one product (Dodla-style: product → variants → crate billing).
 * Mirrors: Variants table with productId, variantName, unitsPerCrate, unitPrice, hsnCode, uom.
 * `unitsPerCrate` is required per variant (may be fractional, e.g. 10.8 pouches per crate).
 */
export interface ProductVariant {
  id: string;
  /** Set when variant is stored flat or denormalized; optional when nested under Product. */
  productId?: string;
  variantName: string;
  /** Required: liters (or litre-equivalent) per crate for this SKU. */
  unitsPerCrate: number;
  unitPrice: number;
  hsnCode?: string;
  /** Unit of measure, e.g. L, ml, PCS */
  uom?: string;
  /** Optional: curd-only display field (e.g. 90 pcs/crate). */
  qtyPerCrate?: number;
  /** Optional: rate per crate (when billing is by crate). */
  ratePerCrate?: number;
  createdAt?: string;
}

export interface Product {
  id: string;
  name: string;
  category: "milk" | "curd";
  variants: ProductVariant[];
  createdAt?: string;
  image?: string;
}

/**
 * Cart / invoice line. Crate fields are authoritative for billing.
 * Legacy rows may use `quantity` / `price` / `variantSize`.
 */
/**
 * Bill / API line item — matches mongo-bills payload shape.
 * `qty` = crates; `price` = ₹ per liter; `litersPerCrate` = L per crate.
 */
export interface BillLineItem {
  name: string;
  size: string;
  price: number;
  litersPerCrate: number;
  qty: number;
  /** Optional: for receipt formatting. */
  category?: "milk" | "curd";
  /** Optional: curd-only display field (e.g. 90 pcs/crate). */
  qtyPerCrate?: number;
  /** Optional: when provided, amount is computed as crates × ratePerCrate. */
  ratePerCrate?: number;
}

/** In-app cart row: same as bill line + ids for merging qty per SKU. */
export interface CrateCartLine extends BillLineItem {
  variantId: string;
  productId: string;
}

export interface CartItem {
  productId: string;
  productName: string;
  variantId: string;
  /** SKU label, e.g. 500ml, 1L (preferred). */
  variantName?: string;
  unitPrice?: number;
  crates?: number;
  unitsPerCrate?: number;
  totalUnits?: number;
  totalPrice?: number;
  quantity?: number;
  price?: number;
  /** @deprecated use variantName */
  variantSize?: string;
}


export interface Bill {
  id: string;
  /**
   * Display dealer identifier on invoice / Mongo document (e.g. `A-102`).
   * Prefer sending `dealerMongoId` for the dealer’s BSON `_id` when creating bills.
   */
  dealerId: string;
  /** Mongo `_id` of dealer document — POST this on bill create (`dealerMongoId`). */
  dealerMongoId?: string;
  dealerName: string;
  /** Snapshot at billing / legal copy (buyer). */
  dealerCode?: string;
  dealerArea?: string;
  dealerPhone?: string;
  date: string;
  items: BillLineItem[];
  /** Sum of line amounts (new bills: same as `total`; optional on very old rows). */
  subtotal?: number;
  /** @deprecated Old bills only — do not send on create. */
  gst?: number;
  /** Final amount (= subtotal when no tax). */
  total: number;
  /** Amount received at billing time (optional). */
  paidAmount?: number;
  /** `total - paidAmount` (optional; server may echo). */
  pendingAmount?: number;
  /** Cash/change to return when `paidAmount` &gt; `total` (overpayment). */
  balanceToReturn?: number;
  /** e.g. `cash` | `gpay` | `bank` — omit when `none`. */
  paymentMethod?: string;
  /** Payment / lifecycle: `partial` = part-paid. */
  status: "paid" | "pending" | "partial" | "cancelled";
}

export interface Transaction {
  id: string;
  dealerId: string;
  type: "bill" | "payment";
  amount: number;
  date: string;
  description: string;
}
