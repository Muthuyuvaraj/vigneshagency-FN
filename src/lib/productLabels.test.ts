import { describe, it, expect } from "vitest";
import { invoiceLineTitle } from "./productLabels";
import type { CartItem } from "@/data/types";

describe("invoiceLineTitle", () => {
  it("joins product name and variant for invoice lines", () => {
    const item = {
      productName: "Full Cream Milk",
      variantName: "500ml",
    } as CartItem;
    expect(invoiceLineTitle(item)).toBe("Full Cream Milk 500ml");
  });

  it("falls back to legacy variantSize", () => {
    const item = {
      productName: "Toned Milk",
      variantSize: "450ml",
    } as CartItem;
    expect(invoiceLineTitle(item)).toBe("Toned Milk 450ml");
  });
});
