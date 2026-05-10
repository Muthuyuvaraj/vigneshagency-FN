import { useCallback, useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useProducts } from "@/hooks/useProducts";
import { getReports, type ReportData } from "@/api/reportApi";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { formatRupees, formatUnitQty } from "@/lib/formatMoney";
import { toast } from "sonner";

const TAB_CONFIG = [
  { label: "Daily", type: "daily" },
  { label: "Weekly", type: "weekly" },
  { label: "Monthly", type: "monthly" },
  { label: "Quarterly", type: "quarterly" },
  { label: "Half Yearly", type: "halfyearly" },
] as const;

const ReportsPage = () => {
  const [reportType, setReportType] = useState<string>("daily");
  const [report, setReport] = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const { products, loading: productsLoading } = useProducts();

  const loadReports = useCallback(async () => {
    setReportLoading(true);
    try {
      const data = await getReports(reportType);
      setReport(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load reports", {
        description: "Check that the API is running (port 3001).",
      });
      setReport(null);
    } finally {
      setReportLoading(false);
    }
  }, [reportType]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const totalSales = report?.totalSales ?? 0;
  const outstanding = report?.outstanding ?? 0;
  const totalCrates = report?.totalCrates ?? 0;
  const totalLiters = report?.totalLiters ?? 0;
  const revenue = report?.revenue ?? 0;
  const curdSales = (report as { curdSales?: number } | null)?.curdSales ?? 0;
  const gstCollected = (report as { gstCollected?: number } | null)?.gstCollected ?? 0;

  const chartData = useMemo(() => {
    const overview = report?.overview;
    if (!Array.isArray(overview) || overview.length === 0) return [];
    return overview.map((d, i) => {
      const total = typeof d.total === "number" ? d.total : typeof d.totalSales === "number" ? d.totalSales : 0;
      const name =
        typeof d.name === "string" && d.name
          ? d.name
          : typeof d.label === "string" && d.label
            ? d.label
            : `P${i + 1}`;
      return { name, sales: total };
    });
  }, [report?.overview]);

  return (
    <AppLayout title="Reports">
      <div className="space-y-4 w-full min-w-0 max-w-full">
        {/* Tabs — wrap on narrow screens so nothing is clipped */}
        <div className="flex flex-wrap gap-2 w-full min-w-0">
          {TAB_CONFIG.map((tab) => (
            <button
              key={tab.type}
              type="button"
              onClick={() => setReportType(tab.type)}
              className={`min-h-9 min-w-0 px-3 sm:px-4 rounded-lg text-xs font-medium text-center transition-colors touch-target shrink-0 ${
                reportType === tab.type ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {reportLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading report…</p>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3 w-full min-w-0">
              <div className="bg-card rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">Total Sales</p>
                <p className="text-lg font-bold text-foreground">₹{formatRupees(totalSales)}</p>
              </div>
              <div className="bg-card rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">Outstanding</p>
                <p className="text-lg font-bold text-destructive">₹{formatRupees(outstanding)}</p>
              </div>
              <div className="bg-card rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">Curd sales</p>
                <p className="text-lg font-bold text-foreground">₹{formatRupees(curdSales)}</p>
              </div>
              <div className="bg-card rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">GST collected</p>
                <p className="text-lg font-bold text-foreground">₹{formatRupees(gstCollected)}</p>
              </div>
              <div className="bg-card rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">Total crates sold</p>
                <p className="text-lg font-bold text-foreground">{formatUnitQty(totalCrates)}</p>
              </div>
              <div className="bg-card rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">Total liters sold</p>
                <p className="text-lg font-bold text-foreground">{formatUnitQty(totalLiters)}</p>
              </div>
              <div className="bg-card rounded-xl border p-4 col-span-2">
                <p className="text-xs text-muted-foreground">Revenue</p>
                <p className="text-lg font-bold text-foreground">₹{formatRupees(revenue)}</p>
              </div>
            </div>

            {/* Sales Chart */}
            <div className="bg-card rounded-xl border p-4 w-full min-w-0 overflow-hidden">
              <h3 className="text-sm font-semibold text-foreground mb-3">Sales Overview</h3>
              {chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No chart data for this period</p>
              ) : (
                <div className="h-48 w-full min-w-0 max-w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
                      <Tooltip />
                      <Bar dataKey="sales" fill="hsl(152, 60%, 38%)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </>
        )}

        {/* Top Products */}
        <div className="bg-card rounded-xl border p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Top Products</h3>
          {productsLoading ? (
            <p className="text-sm text-muted-foreground">Loading products…</p>
          ) : products.length === 0 ? (
            <p className="text-sm text-muted-foreground">No products added yet</p>
          ) : (
            <div className="space-y-3">
              {products.slice(0, 3).map((p, i) => (
                <div key={p.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="h-7 w-7 rounded-full bg-accent text-accent-foreground text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-sm text-foreground">{p.name}</span>
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">{p.variants.length} variants</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default ReportsPage;
