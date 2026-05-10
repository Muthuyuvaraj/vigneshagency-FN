import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import {
  BarChart3,
  Bell,
  FileText,
  IndianRupee,
  LayoutGrid,
  Plus,
  UserPlus,
  Users,
} from "lucide-react";
import {
  DASHBOARD_REFRESH_EVENT,
  getDashboard,
  type DashboardData,
} from "@/api/dashboardApi";
import { formatRupees } from "@/lib/formatMoney";
import { toast } from "sonner";
import { cancelBill } from "@/api/billApi";
import { useDealers } from "@/hooks/useDealers";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type CancelBillTarget = {
  id: string;
  customerLabel: string;
  dateLabel: string;
  total: number;
};

function formatBillListDate(iso: string): string {
  const d = Date.parse(iso);
  if (Number.isNaN(d)) return iso;
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { dealers: dealersList } = useDealers();

  /** Legacy rows only — new invoices carry `dealerName` on the bill document. */
  const dealerLookup = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of dealersList) {
      const name = typeof d.name === "string" ? d.name.trim() : "";
      if (!name) continue;
      m.set(String(d.id).trim(), name);
      const code = d.dealerCode?.trim();
      if (code) m.set(code, name);
    }
    return m;
  }, [dealersList]);

  const [data, setData] = useState<DashboardData | null>(null);
  const [dashboardLoaded, setDashboardLoaded] = useState(false);
  const [cancellingBillId, setCancellingBillId] = useState<string | null>(null);
  const [billToCancel, setBillToCancel] = useState<CancelBillTarget | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await getDashboard();
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load dashboard", {
        description: "Check that the API is running (port 3001).",
      });
      setData(null);
    } finally {
      setDashboardLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const onRefresh = () => {
      void loadDashboard();
    };
    window.addEventListener(DASHBOARD_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(DASHBOARD_REFRESH_EVENT, onRefresh);
  }, [loadDashboard]);

  const executeCancelBill = async () => {
    if (!billToCancel) return;
    const id = billToCancel.id;
    setCancellingBillId(id);
    try {
      await cancelBill(id);
      setBillToCancel(null);
      await loadDashboard();
      toast.success("Bill cancelled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel bill", {
        description: "Check that the API is running (port 3001).",
      });
    } finally {
      setCancellingBillId(null);
    }
  };

  const pending = data?.pending ?? 0;
  const dealersCount = data?.dealers ?? 0;
  const products = data?.products ?? 0;
  const salesToday = data?.salesToday ?? 0;
  const salesWeek = data?.salesWeek ?? 0;
  const salesMonth = data?.salesMonth ?? 0;
  const unpaidBillsCount = data?.unpaidBillsCount ?? 0;
  const recentBills = data?.recentBills ?? [];

  const pendingSubtitle =
    unpaidBillsCount === 0
      ? "All caught up"
      : unpaidBillsCount === 1
        ? "1 unpaid bill · needs attention"
        : `${unpaidBillsCount} unpaid bills · needs attention`;

  const greetingDate = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <AppLayout>
      <div className="space-y-5 -mt-1">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-3">
          <div
            className="h-11 w-11 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shadow-sm ring-2 ring-primary/30"
            aria-hidden
          >
            VA
          </div>
          <h1 className="flex-1 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground">
            Vignesh Agency
          </h1>
          <button
            type="button"
            onClick={() => toast.message("Notifications", { description: "No new alerts." })}
            className="h-11 w-11 shrink-0 rounded-xl border border-border bg-card flex items-center justify-center text-foreground active:scale-95 transition-transform touch-manipulation"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </button>
        </header>

        <div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">Welcome back</h2>
          <p className="text-sm text-muted-foreground mt-1">{greetingDate}</p>
        </div>

        {/* Hero — total pending */}
        <div className="rounded-2xl bg-primary text-primary-foreground p-5 shadow-lg shadow-primary/20 ring-1 ring-primary/30">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground/90">
            Total pending
          </p>
          <p className="text-3xl font-bold tabular-nums mt-2 tracking-tight">
            ₹{formatRupees(pending)}
          </p>
          <p className="text-xs text-primary-foreground/80 mt-2 leading-snug">{pendingSubtitle}</p>
          <div className="mt-4 pt-4 border-t border-primary-foreground/20 grid grid-cols-3 gap-2 text-center">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-primary-foreground/70">Today sales</p>
              <p className="text-sm font-semibold tabular-nums mt-1 truncate">
                ₹{formatRupees(salesToday)}
              </p>
            </div>
            <div className="min-w-0 border-x border-primary-foreground/15 px-1">
              <p className="text-[10px] uppercase tracking-wide text-primary-foreground/70">This week</p>
              <p className="text-sm font-semibold tabular-nums mt-1 truncate">
                ₹{formatRupees(salesWeek)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-primary-foreground/70">This month</p>
              <p className="text-sm font-semibold tabular-nums mt-1 truncate">
                ₹{formatRupees(salesMonth)}
              </p>
            </div>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-border bg-card p-3 flex flex-col items-center text-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center text-primary">
              <IndianRupee className="h-4 w-4" />
            </div>
            <p className="text-base font-bold text-foreground tabular-nums leading-none">
              ₹{formatRupees(salesToday)}
            </p>
            <p className="text-[10px] text-muted-foreground font-medium">Today</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3 flex flex-col items-center text-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-info/15 flex items-center justify-center text-info">
              <Users className="h-4 w-4" />
            </div>
            <p className="text-base font-bold text-foreground tabular-nums leading-none">{dealersCount}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Dealers</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3 flex flex-col items-center text-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-warning/15 flex items-center justify-center text-warning">
              <LayoutGrid className="h-4 w-4" />
            </div>
            <p className="text-base font-bold text-foreground tabular-nums leading-none">{products}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Products</p>
          </div>
        </div>

        {/* Quick actions */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Quick actions</h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                icon: Plus,
                label: "Create bill",
                path: "/billing",
                iconWrap: "bg-primary/15 text-primary",
              },
              {
                icon: UserPlus,
                label: "Add dealer",
                path: "/dealers",
                iconWrap: "bg-info/15 text-info",
              },
              {
                icon: BarChart3,
                label: "Reports",
                path: "/reports",
                iconWrap: "bg-warning/15 text-warning",
              },
            ].map((action) => (
              <button
                key={action.path}
                type="button"
                onClick={() => navigate(action.path)}
                className="rounded-2xl border border-border bg-card/80 p-3 flex flex-col items-center gap-2.5 touch-manipulation active:scale-[0.98] transition-transform"
              >
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center ${action.iconWrap}`}
                >
                  <action.icon className="h-5 w-5" />
                </div>
                <span className="text-[11px] font-medium text-foreground leading-tight text-center">
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Recent bills */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-semibold text-foreground">Recent bills</h3>
            <button
              type="button"
              onClick={() => navigate("/billing")}
              className="text-xs font-semibold text-primary hover:underline touch-manipulation"
            >
              See all
            </button>
          </div>
          {!dashboardLoaded ? (
            <p className="text-sm text-muted-foreground py-4">Loading…</p>
          ) : recentBills.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 rounded-xl border border-dashed border-border px-4 text-center">
              No bills yet
            </p>
          ) : (
            <div className="space-y-2">
              {recentBills.map((bill) => {
                const rowId = String(bill._id ?? bill.id ?? "");
                /** Snapshot from invoices collection (`dealerName` / alternate keys normalized in dashboardApi). */
                const invoiceLabel = [bill.dealerName, bill.customerName]
                  .map((s) => (typeof s === "string" ? s.trim() : ""))
                  .find((t) => t.length > 0 && t !== "—");
                const byDisplayId = bill.dealerId?.trim()
                  ? dealerLookup.get(bill.dealerId.trim())
                  : undefined;
                const byMongo = bill.dealerMongoId?.trim()
                  ? dealerLookup.get(bill.dealerMongoId.trim())
                  : undefined;
                const fromDealers = (byDisplayId ?? byMongo)?.trim();
                /** Prefer invoice Mongo fields; dealers API backfills OLD bills missing names. */
                const storeName =
                  (invoiceLabel && invoiceLabel !== "—"
                    ? invoiceLabel
                    : fromDealers && fromDealers !== "—"
                      ? fromDealers
                      : "") || "Unknown Store";
                const invoiceId = String(bill.id ?? bill._id ?? rowId);
                const statusRaw = bill.status ?? "pending";
                const status = statusRaw.toLowerCase();
                const dateLabel =
                  bill.date && !Number.isNaN(Date.parse(bill.date))
                    ? formatBillListDate(bill.date)
                    : bill.date ?? "—";
                const statusPillClass =
                  status === "cancelled"
                    ? "bg-destructive/15 text-destructive"
                    : status === "paid"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : status === "partial"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                        : "bg-amber-500/15 text-amber-700 dark:text-amber-400";
                const iconWrapClass =
                  status === "paid"
                    ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    : status === "cancelled"
                      ? "bg-muted text-muted-foreground"
                      : "bg-amber-500/20 text-amber-700 dark:text-amber-500";
                const canCancel = status !== "cancelled";
                return (
                  <div
                    key={rowId || storeName + dateLabel}
                    className="bg-card rounded-2xl border border-border flex items-stretch overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/invoice/${invoiceId}`)}
                      className="flex-1 min-w-0 p-3.5 flex items-center gap-3 text-left active:bg-muted/60 transition-colors"
                    >
                      <div
                        className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center ${iconWrapClass}`}
                      >
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{storeName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{dateLabel}</p>
                      </div>
                      <div className="text-right shrink-0 pl-2">
                        <p className="text-sm font-bold text-foreground tabular-nums">
                          ₹{formatRupees(bill.total ?? 0)}
                        </p>
                        <span
                          className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 capitalize ${statusPillClass}`}
                        >
                          {statusRaw}
                        </span>
                      </div>
                    </button>
                    {canCancel && (
                      <button
                        type="button"
                        disabled={cancellingBillId === invoiceId}
                        onClick={(e) => {
                          e.stopPropagation();
                          setBillToCancel({
                            id: invoiceId,
                            customerLabel: storeName,
                            dateLabel,
                            total: bill.total ?? 0,
                          });
                        }}
                        className="shrink-0 px-2.5 text-[10px] font-semibold text-destructive border-l border-border bg-card hover:bg-destructive/5 active:bg-destructive/10 disabled:opacity-50 touch-manipulation"
                      >
                        {cancellingBillId === invoiceId ? "…" : "Cancel"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!billToCancel} onOpenChange={(open) => !open && setBillToCancel(null)}>
        <AlertDialogContent className="rounded-2xl border-border/80 shadow-xl max-w-[min(100%,22rem)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this bill?</AlertDialogTitle>
            <AlertDialogDescription>
              This marks the invoice as cancelled. It stays in your records but won&apos;t count as pending payment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {billToCancel && (
            <div className="rounded-xl border border-border/60 bg-muted/40 px-3 py-3 text-sm text-foreground space-y-1.5 -mt-1">
              <p className="font-medium leading-snug">{billToCancel.customerLabel}</p>
              <p className="text-xs text-muted-foreground">{billToCancel.dateLabel}</p>
              <p className="text-base font-semibold tabular-nums pt-1">₹{formatRupees(billToCancel.total)}</p>
            </div>
          )}
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="rounded-xl touch-target">Keep bill</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 touch-target"
              disabled={!!cancellingBillId}
              onClick={(e) => {
                e.preventDefault();
                void executeCancelBill();
              }}
            >
              {cancellingBillId ? "Cancelling…" : "Yes, cancel bill"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Dashboard;
