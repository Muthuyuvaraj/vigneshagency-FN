import AppLayout from "@/components/AppLayout";
import { Product, ProductVariant } from "@/data/types";
import { Plus, Pencil, Trash2, MoreVertical } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatRupees, formatUnitQty } from "@/lib/formatMoney";
import {
  createProduct,
  deleteProduct as deleteProductApi,
  deleteProductVariant,
  getProducts,
  productFromCreateResponse,
  putProductVariant,
  type CreateProductVariantPayload,
} from "@/api/productsApi";
import { requestDashboardRefresh } from "@/api/dashboardApi";

type VariantRow = { size: string; unitsPerCrate: string; price: string };

type CurdVariantRow = {
  variant: string;
  qtyPerCrate: string;
  literPerCrate: string;
  rateType: "per_crate" | "per_liter";
  rate: string;
};

const emptyVariantRow = (category: "milk" | "curd"): VariantRow => ({
  size: "",
  unitsPerCrate: category === "milk" ? "14" : "13.3",
  price: "",
});

const defaultCurdRows = (): CurdVariantRow[] => [
  { variant: "125g", qtyPerCrate: "90", literPerCrate: "11", rateType: "per_crate", rate: "704" },
  { variant: "475g", qtyPerCrate: "28", literPerCrate: "11", rateType: "per_liter", rate: "64" },
  { variant: "1kg", qtyPerCrate: "12", literPerCrate: "12", rateType: "per_liter", rate: "64" },
];

const ProductsPage = () => {
  const [activeTab, setActiveTab] = useState<"milk" | "curd">("milk");
  const [productList, setProductList] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const filtered = productList.filter((p) => p.category === activeTab);

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const data = await getProducts();
      setProductList(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load products";
      toast.error(msg, { description: "Check that the API is running (port 3001)." });
      setProductList([]);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productName, setProductName] = useState("");
  const [productCategory, setProductCategory] = useState<"milk" | "curd">("milk");
  const [newVariantRows, setNewVariantRows] = useState<VariantRow[]>([emptyVariantRow("milk")]);
  const [curdRows, setCurdRows] = useState<CurdVariantRow[]>(defaultCurdRows());
  const [savingProduct, setSavingProduct] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [variantProductId, setVariantProductId] = useState<string>("");
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [variantName, setVariantName] = useState("");
  const [variantPrice, setVariantPrice] = useState("");
  const [variantUnitsPerCrate, setVariantUnitsPerCrate] = useState("14");
  const [variantHsn, setVariantHsn] = useState("");
  const [variantUom, setVariantUom] = useState("L");
  const [savingVariant, setSavingVariant] = useState(false);
  const [deletingVariantKey, setDeletingVariantKey] = useState<string | null>(null);

  const openAddProduct = () => {
    setEditingProduct(null);
    setProductName("");
    setProductCategory(activeTab);
    setNewVariantRows([emptyVariantRow(activeTab)]);
    setCurdRows(defaultCurdRows());
    setProductDialogOpen(true);
  };

  // Keep variant rows aligned with chosen category defaults
  useEffect(() => {
    setNewVariantRows((prev) =>
      prev.length === 0 ? [emptyVariantRow(productCategory)] : prev
    );
    if (productCategory === "curd") setCurdRows(defaultCurdRows());
  }, [productCategory]);

  const openEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductName(product.name);
    setProductCategory(product.category);
    setProductDialogOpen(true);
  };

  const buildVariantsPayload = (): CreateProductVariantPayload[] => {
    const out: CreateProductVariantPayload[] = [];
    if (productCategory === "curd") {
      // Curd: use client fields (qty/crate, liter/crate, rate per crate or per liter).
      for (const row of curdRows) {
        const variant = row.variant.trim();
        const qtyPerCrate = parseFloat(row.qtyPerCrate);
        const literPerCrate = parseFloat(row.literPerCrate);
        const rate = parseFloat(row.rate);
        if (!variant) continue;
        if (Number.isNaN(qtyPerCrate) || qtyPerCrate <= 0) continue;
        if (Number.isNaN(literPerCrate) || literPerCrate <= 0) continue;
        if (Number.isNaN(rate) || rate <= 0) continue;

        const ratePerCrate = row.rateType === "per_crate" ? rate : undefined;
        const ratePerLiter = row.rateType === "per_liter" ? rate : undefined;
        // Persist `price` as per-liter rate (so any legacy screens can still compute).
        const price = ratePerLiter ?? (ratePerCrate ? ratePerCrate / literPerCrate : 0);

        out.push({
          size: variant,
          litersPerCrate: literPerCrate,
          price,
          uom: "L",
          qtyPerCrate,
          ratePerCrate,
        });
      }
      return out;
    }

    // Milk: keep existing behavior (₹/L and L/crate).
    for (const row of newVariantRows) {
      const size = row.size.trim();
      const unitsPerCrate = parseFloat(row.unitsPerCrate);
      const price = parseFloat(row.price);
      if (!size) continue;
      if (Number.isNaN(unitsPerCrate) || unitsPerCrate <= 0) continue;
      if (Number.isNaN(price) || price <= 0) continue;
      out.push({ size, litersPerCrate: unitsPerCrate, price, uom: "L" });
    }
    return out;
  };

  const saveProduct = async () => {
    if (!productName.trim()) {
      toast.error("Product name is required");
      return;
    }
    if (editingProduct) {
      setProductList((prev) =>
        prev.map((p) =>
          p.id === editingProduct.id ? { ...p, name: productName.trim(), category: productCategory } : p
        )
      );
      toast.success("Product updated");
      setProductDialogOpen(false);
      return;
    }

    const variantsPayload = buildVariantsPayload();
    if (variantsPayload.length === 0) {
      toast.error("Add at least one variant with size, units per crate, and price");
      return;
    }

    setSavingProduct(true);
    try {
      const json = await createProduct({
        name: productName.trim(),
        category: productCategory === "milk" ? "Milk" : "Curd",
        variants: variantsPayload,
      });
      let created = productFromCreateResponse(json, {
        name: productName.trim(),
        category: productCategory,
      });
      if (created.variants.length === 0 && variantsPayload.length > 0) {
        created = {
          ...created,
          variants: variantsPayload.map((v, i) => ({
            id: `v-${Date.now()}-${i}`,
            productId: created.id,
            variantName: v.size,
            unitsPerCrate: v.litersPerCrate,
            unitPrice: v.price,
            uom: v.uom,
            gstPercent: v.gstPercent,
            createdAt: new Date().toISOString(),
          })),
        };
      }
      toast.success("Product saved");
      await loadProducts();
      requestDashboardRefresh();
      setProductDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save product", {
        description: "Check that the API is running (port 3001).",
      });
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    setDeletingProductId(id);
    try {
      await deleteProductApi(id);
      await loadProducts();
      toast.success("Product deleted");
      requestDashboardRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete product", {
        description: "Check that the API is running (port 3001).",
      });
    } finally {
      setDeletingProductId(null);
    }
  };

  const defaultUomForCategory = (category: "milk" | "curd") => (category === "curd" ? "KG" : "L");

  const openAddVariant = (productId: string) => {
    const p = productList.find((x) => x.id === productId);
    setVariantProductId(productId);
    setEditingVariant(null);
    setVariantName("");
    setVariantPrice("");
    setVariantUnitsPerCrate(p?.category === "curd" ? "13.3" : "14");
    setVariantHsn("");
    setVariantUom(p ? defaultUomForCategory(p.category) : "L");
    setVariantDialogOpen(true);
  };

  const openEditVariant = (productId: string, variant: ProductVariant) => {
    const p = productList.find((x) => x.id === productId);
    setVariantProductId(productId);
    setEditingVariant(variant);
    setVariantName(variant.variantName);
    setVariantPrice(String(variant.unitPrice));
    setVariantUnitsPerCrate(String(variant.unitsPerCrate));
    setVariantHsn(variant.hsnCode ?? "");
    setVariantUom(variant.uom ?? (p ? defaultUomForCategory(p.category) : "L"));
    setVariantDialogOpen(true);
  };

  const saveVariant = async () => {
    if (!variantName.trim() || !variantPrice.trim() || !variantUnitsPerCrate.trim()) {
      toast.error("Variant name, unit price, and units per crate are required");
      return;
    }
    const unitPrice = parseFloat(variantPrice);
    const unitsPerCrate = parseFloat(variantUnitsPerCrate);
    if (isNaN(unitPrice) || unitPrice <= 0) {
      toast.error("Enter a valid unit price");
      return;
    }
    if (isNaN(unitsPerCrate) || unitsPerCrate <= 0) {
      toast.error("Units per crate is required and must be greater than zero");
      return;
    }
    const hsn = variantHsn.trim();
    const uom = variantUom.trim() || undefined;

    setSavingVariant(true);
    try {
      await putProductVariant(variantProductId, {
        size: variantName.trim(),
        litersPerCrate: unitsPerCrate,
        price: unitPrice,
        ...(hsn ? { hsnCode: hsn } : {}),
        ...(uom ? { uom } : {}),
        ...(editingVariant ? { variantId: editingVariant.id } : {}),
      });
      toast.success(editingVariant ? "Variant updated" : "Variant added");
      setVariantDialogOpen(false);
      await loadProducts();
      requestDashboardRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save variant", {
        description: "Check that the API is running (port 3001).",
      });
    } finally {
      setSavingVariant(false);
    }
  };

  const handleDeleteVariant = async (productId: string, variantId: string) => {
    setDeletingVariantKey(`${productId}:${variantId}`);
    try {
      await deleteProductVariant(productId, variantId);
      toast.success("Variant deleted");
      await loadProducts();
      requestDashboardRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete variant", {
        description: "Check that the API is running (port 3001).",
      });
    } finally {
      setDeletingVariantKey(null);
    }
  };

  return (
    <AppLayout title="Products">
      <div className="space-y-4">
        <div className="flex gap-2">
          {(["milk", "curd"] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveTab(cat)}
              className={`flex-1 h-11 rounded-xl text-sm font-medium capitalize transition-colors touch-target ${
                activeTab === cat ? "bg-primary text-primary-foreground" : "bg-card border text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={openAddProduct}
          disabled={productsLoading}
          className="w-full h-12 rounded-xl border-2 border-dashed border-primary/40 text-primary flex items-center justify-center gap-2 touch-target active:bg-accent transition-colors disabled:opacity-50"
        >
          <Plus className="h-5 w-5" />
          <span className="text-sm font-medium">Add Product</span>
        </button>

        {productsLoading && (
          <p className="text-sm text-muted-foreground text-center py-6">Loading products…</p>
        )}

        {!productsLoading && productList.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No products added yet</p>
        )}

        {!productsLoading && productList.length > 0 && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No products in this category</p>
        )}

        <div className="space-y-3">
          {!productsLoading &&
            filtered.map((product) => (
            <div key={product.id} className="bg-card rounded-xl border p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-foreground leading-snug">{product.name}</h3>
                  <span className="inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent text-accent-foreground capitalize">
                    {product.category}
                  </span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label="Product options"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => openEditProduct(product)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit product
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => void handleDeleteProduct(product.id)}
                      disabled={deletingProductId === product.id}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete product
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="space-y-1.5">
                {product.variants.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-stretch gap-0 rounded-lg bg-muted/80 border border-border/60 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => openEditVariant(product.id, v)}
                      className="flex-1 min-w-0 text-left px-3 py-2.5 active:bg-muted transition-colors"
                    >
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-sm font-medium text-foreground">{v.variantName}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatUnitQty(v.unitsPerCrate)} {v.uom ?? defaultUomForCategory(product.category)}/crate
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-foreground mt-0.5">
                        ₹{formatRupees(v.unitPrice)}
                        <span className="text-xs font-normal text-muted-foreground ml-1">
                          per {v.uom ?? defaultUomForCategory(product.category)}
                        </span>
                      </p>
                      {(v.hsnCode || v.uom || v.qtyPerCrate != null || v.ratePerCrate != null) && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {v.hsnCode && <>HSN {v.hsnCode}</>}
                          {v.hsnCode && (v.uom || v.qtyPerCrate != null || v.ratePerCrate != null) && " · "}
                          {v.uom && <>UOM {v.uom}</>}
                          {v.uom && (v.qtyPerCrate != null || v.ratePerCrate != null) ? " · " : null}
                          {v.qtyPerCrate != null ? <>Qty/Crate {formatUnitQty(v.qtyPerCrate)}</> : null}
                          {v.qtyPerCrate != null && v.ratePerCrate != null ? " · " : null}
                          {v.ratePerCrate != null ? <>Rate/Crate ₹{formatRupees(v.ratePerCrate)}</> : null}
                        </p>
                      )}
                    </button>
                    <div className="flex items-center border-l border-border/60 bg-muted/50">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-full min-h-[44px] w-11 rounded-none shrink-0 text-muted-foreground hover:text-foreground"
                            aria-label={`Actions for ${v.variantName}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => openEditVariant(product.id, v)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit variant
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => void handleDeleteVariant(product.id, v.id)}
                            disabled={deletingVariantKey === `${product.id}:${v.id}`}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete variant
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => openAddVariant(product.id)}
                className="text-xs text-primary font-medium flex items-center gap-1 pt-0.5"
              >
                <Plus className="h-3 w-3" /> Add variant
              </button>
            </div>
            ))}
        </div>
      </div>

      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Product" : "Add Product"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Product name</label>
              <Input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. Full Cream Milk"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Category</label>
              <div className="flex gap-2">
                {(["milk", "curd"] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setProductCategory(cat)}
                    className={`flex-1 h-10 rounded-lg text-sm font-medium capitalize transition-colors ${
                      productCategory === cat
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {!editingProduct && (
              <div className="space-y-3 border-t border-border/60 pt-4">
                <p className="text-sm font-medium text-foreground">Variants</p>
                <p className="text-[10px] text-muted-foreground">
                  Milk: size, litersPerCrate (L/crate), price (₹/L). Curd: qty/crate, liter/crate, rate.
                </p>
                <div className="space-y-3">
                  {productCategory === "curd" ? (
                    <div className="space-y-3">
                      {curdRows.map((row, index) => (
                        <div key={index} className="rounded-lg border border-border/60 p-3 space-y-2 bg-muted/30">
                          <Input
                            placeholder="Variant (e.g. 125g)"
                            value={row.variant}
                            onChange={(e) =>
                              setCurdRows((prev) =>
                                prev.map((r, i) => (i === index ? { ...r, variant: e.target.value } : r))
                              )
                            }
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              type="number"
                              step="1"
                              min={1}
                              placeholder="Qty per crate"
                              value={row.qtyPerCrate}
                              onChange={(e) =>
                                setCurdRows((prev) =>
                                  prev.map((r, i) => (i === index ? { ...r, qtyPerCrate: e.target.value } : r))
                                )
                              }
                            />
                            <Input
                              type="number"
                              step="0.1"
                              min={0.1}
                              placeholder="Liter per crate"
                              value={row.literPerCrate}
                              onChange={(e) =>
                                setCurdRows((prev) =>
                                  prev.map((r, i) => (i === index ? { ...r, literPerCrate: e.target.value } : r))
                                )
                              }
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={row.rateType}
                              onChange={(e) =>
                                setCurdRows((prev) =>
                                  prev.map((r, i) =>
                                    i === index
                                      ? { ...r, rateType: e.target.value as CurdVariantRow["rateType"] }
                                      : r
                                  )
                                )
                              }
                              className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                              <option value="per_crate">Rate per crate</option>
                              <option value="per_liter">Rate per liter</option>
                            </select>
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              placeholder={row.rateType === "per_crate" ? "₹/crate" : "₹/liter"}
                              value={row.rate}
                              onChange={(e) =>
                                setCurdRows((prev) =>
                                  prev.map((r, i) => (i === index ? { ...r, rate: e.target.value } : r))
                                )
                              }
                            />
                          </div>
                        </div>
                      ))}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setCurdRows((prev) => [...prev, ...defaultCurdRows().slice(0, 1)])}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add curd row
                      </Button>
                    </div>
                  ) : (
                    <>
                      {newVariantRows.map((row, index) => (
                        <div key={index} className="rounded-lg border border-border/60 p-3 space-y-2 bg-muted/30">
                          <div className="grid grid-cols-1 gap-2">
                            <Input
                              placeholder="Size (e.g. 500ml)"
                              value={row.size}
                              onChange={(e) =>
                                setNewVariantRows((prev) =>
                                  prev.map((r, i) => (i === index ? { ...r, size: e.target.value } : r))
                                )
                              }
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                type="number"
                                min={0.1}
                                step={0.1}
                                placeholder="L/crate"
                                value={row.unitsPerCrate}
                                onChange={(e) =>
                                  setNewVariantRows((prev) =>
                                    prev.map((r, i) =>
                                      i === index ? { ...r, unitsPerCrate: e.target.value } : r
                                    )
                                  )
                                }
                              />
                              <Input
                                type="number"
                                step="0.01"
                                min={0}
                                placeholder="₹/L"
                                value={row.price}
                                onChange={(e) =>
                                  setNewVariantRows((prev) =>
                                    prev.map((r, i) => (i === index ? { ...r, price: e.target.value } : r))
                                  )
                                }
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setNewVariantRows((prev) => [...prev, emptyVariantRow(productCategory)])}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add variant row
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="sticky bottom-0 bg-background pt-3">
            <Button variant="outline" onClick={() => setProductDialogOpen(false)} disabled={savingProduct}>
              Cancel
            </Button>
            <Button onClick={() => void saveProduct()} disabled={savingProduct}>
              {savingProduct ? "Saving…" : editingProduct ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={variantDialogOpen} onOpenChange={setVariantDialogOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVariant ? "Edit Variant" : "Add Variant"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Variant size / name</label>
              <Input
                value={variantName}
                onChange={(e) => setVariantName(e.target.value)}
                placeholder="e.g. 500ml, 1L"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Unit price (₹/{variantUom || "unit"})
              </label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={variantPrice}
                onChange={(e) => setVariantPrice(e.target.value)}
                placeholder="e.g. 69.80"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Units per crate ({variantUom || "unit"})
              </label>
              <Input
                type="number"
                min={0.1}
                step={0.1}
                value={variantUnitsPerCrate}
                onChange={(e) => setVariantUnitsPerCrate(e.target.value)}
                placeholder="e.g. 14 or 10.8"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">HSN code</label>
              <Input
                value={variantHsn}
                onChange={(e) => setVariantHsn(e.target.value)}
                placeholder="e.g. 04011000"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">UOM</label>
              <Input
                value={variantUom}
                onChange={(e) => setVariantUom(e.target.value)}
                placeholder="L, ml, PCS"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVariantDialogOpen(false)} disabled={savingVariant}>
              Cancel
            </Button>
            <Button onClick={() => void saveVariant()} disabled={savingVariant}>
              {savingVariant ? "Saving…" : editingVariant ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default ProductsPage;
