import { describe, it, expect } from "vitest";
import type { CartItem } from "@/data/types";
import {
  calculateUnits,
  calculateTotal,
  totalUnitsFromCrates,
  lineTotalFromUnits,
  getCartItemTotalUnits,
  getLineTotalPrice,
  getCartItemUnitPrice,
  getCartItemCrates,
  cartGrandTotal,
  cartTotalCrates,
  cartTotalUnits,
  withComputedLineTotals,
  createBillFromCart,
  billBalanceToReturn,
} from "./billingCalculations";
import { billLinesSubtotal } from "./billLineMath";

describe("calculateUnits", () => {
  it("multiplies crates by units per crate", () => {
    expect(calculateUnits(3, 12)).toBe(36);
    expect(calculateUnits(1, 14)).toBe(14);
    expect(calculateUnits(2, 12.6)).toBe(25.2);
  });

  it("supports fractional Dodla-style crate factors", () => {
    expect(calculateUnits(1, 10.8)).toBe(10.8);
    expect(calculateUnits(2, 10.8)).toBe(21.6);
  });
});

describe("calculateTotal", () => {
  it("computes line amount and rounds to paise", () => {
    expect(calculateTotal(36, 68)).toBe(2448);
    expect(calculateTotal(12.6, 48.89)).toBe(616.01);
  });
});

describe("aliases", () => {
  it("totalUnitsFromCrates matches calculateUnits", () => {
    expect(totalUnitsFromCrates(3, 12)).toBe(calculateUnits(3, 12));
  });
  it("lineTotalFromUnits matches calculateTotal", () => {
    expect(lineTotalFromUnits(36, 68)).toBe(calculateTotal(36, 68));
  });
});

describe("legacy CartItem", () => {
  it("uses quantity and price when crate fields absent", () => {
    const legacy: CartItem = {
      productId: "p",
      productName: "Test",
      variantId: "v",
      variantSize: "500ml",
      quantity: 10,
      price: 40,
    };
    expect(getCartItemUnitPrice(legacy)).toBe(40);
    expect(getCartItemTotalUnits(legacy)).toBe(10);
    expect(getLineTotalPrice(legacy)).toBe(400);
  });
});

describe("crate-first line", () => {
  const line: CartItem = withComputedLineTotals({
    productId: "p1",
    productName: "Full Cream Milk",
    variantId: "v3",
    variantName: "500ml",
    unitPrice: 68,
    crates: 3,
    unitsPerCrate: 14,
    totalUnits: 0,
    totalPrice: 0,
  });
  it("derives total units and price", () => {
    expect(line.totalUnits).toBe(42);
    expect(line.totalPrice).toBe(2856);
    expect(getCartItemCrates(line)).toBe(3);
  });
});

describe("cartGrandTotal", () => {
  it("sums line totals", () => {
    const items: CartItem[] = [
      withComputedLineTotals({
        productId: "a",
        productName: "A",
        variantId: "1",
        variantName: "500ml",
        unitPrice: 40,
        crates: 1,
        unitsPerCrate: 12,
        totalUnits: 0,
        totalPrice: 0,
      }),
    ];
    expect(cartGrandTotal(items)).toBe(480);
  });
});

describe("cart aggregates", () => {
  it("sums crates and units across lines", () => {
    const items = [
      withComputedLineTotals({
        productId: "a",
        productName: "A",
        variantId: "1",
        variantName: "500ml",
        unitPrice: 10,
        crates: 2,
        unitsPerCrate: 14,
        totalUnits: 0,
        totalPrice: 0,
      }),
      withComputedLineTotals({
        productId: "b",
        productName: "B",
        variantId: "2",
        variantName: "450ml",
        unitPrice: 48.89,
        crates: 1,
        unitsPerCrate: 12.6,
        totalUnits: 0,
        totalPrice: 0,
      }),
    ];
    expect(cartTotalCrates(items)).toBe(3);
    expect(cartTotalUnits(items)).toBeCloseTo(40.6, 5);
  });
});

describe("createBillFromCart", () => {
  it("matches cart totals on the invoice", () => {
    const bill = createBillFromCart({
      dealerMongoId: "507f1f77bcf86cd799439011",
      dealerId: "101",
      dealerName: "Ramesh Stores",
      dealerCode: "101",
      dealerArea: "Uthrakosamangai",
      dealerPhone: "9876543210",
      items: [
        { name: "Full Cream Milk", size: "100ml", price: 10, litersPerCrate: 24, qty: 4 },
      ],
    });
    expect(bill.items).toHaveLength(1);
    expect(bill.items[0].name).toBe("Full Cream Milk");
    expect(bill.items[0].size).toBe("100ml");
    expect(billLinesSubtotal(bill.items)).toBe(960);
    expect(bill.subtotal).toBe(960);
    expect(bill.total).toBe(960);
    expect(bill.paidAmount).toBe(0);
    expect(bill.pendingAmount).toBe(960);
    expect(bill.balanceToReturn).toBeUndefined();
    expect(bill.status).toBe("pending");
    expect(bill.gst).toBeUndefined();
    expect(bill.dealerMongoId).toBe("507f1f77bcf86cd799439011");
    expect(bill.dealerId).toBe("101");
  });

  it("records change to return when customer overpays", () => {
    const bill = createBillFromCart({
      dealerMongoId: "507f1f77bcf86cd799439011",
      dealerId: "101",
      dealerName: "Ramesh Stores",
      dealerCode: "101",
      dealerArea: "Uthrakosamangai",
      dealerPhone: "9876543210",
      items: [{ name: "Milk", size: "1L", price: 10, litersPerCrate: 10, qty: 1 }],
      paidAmount: 150,
      paymentMethod: "cash",
    });
    expect(bill.total).toBe(100);
    expect(bill.paidAmount).toBe(150);
    expect(bill.pendingAmount).toBe(0);
    expect(bill.balanceToReturn).toBe(50);
    expect(bill.status).toBe("paid");
  });
});

describe("billBalanceToReturn", () => {
  it("is zero when paid is below total even if balanceToReturn was stored incorrectly", () => {
    expect(
      billBalanceToReturn({
        total: 16005.86,
        paidAmount: 7890,
        balanceToReturn: 6665.33,
      })
    ).toBe(0);
  });

  it("uses optional total override for display parity", () => {
    expect(
      billBalanceToReturn(
        { total: 999, paidAmount: 1100, balanceToReturn: 50 },
        { total: 1000 }
      )
    ).toBe(100);
  });
});
