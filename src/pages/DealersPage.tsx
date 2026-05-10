import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Search, Plus, Phone, MapPin, Trash2 } from "lucide-react";
import type { Dealer } from "@/data/types";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createDealer, dealerFromCreateResponse, deleteDealer as deleteDealerApi } from "@/api/dealersApi";
import { requestDashboardRefresh } from "@/api/dashboardApi";
import { useDealers } from "@/hooks/useDealers";

/** 3-digit dealer display ID (100–999). */
function generateDealerId(): string {
  return String(Math.floor(100 + Math.random() * 900));
}

function uniqueDealerCode(existing: Dealer[]): string {
  for (let i = 0; i < 80; i++) {
    const code = generateDealerId();
    if (!existing.some((d) => d.dealerCode === code)) return code;
  }
  return generateDealerId();
}

const DealersPage = () => {
  const navigate = useNavigate();
  const { dealers: dealerList, loading: dealersLoading, loadDealers } = useDealers();
  const [search, setSearch] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [newDealerCode, setNewDealerCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newArea, setNewArea] = useState("");
  const [newBalance, setNewBalance] = useState("");
  const [savingDealer, setSavingDealer] = useState(false);
  const [deletingDealerId, setDeletingDealerId] = useState<string | null>(null);

  const [dealerToDelete, setDealerToDelete] = useState<Dealer | null>(null);

  const filtered = dealerList.filter(
    (d) =>
      d.dealerCode.toLowerCase().includes(search.toLowerCase()) ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.area.toLowerCase().includes(search.toLowerCase()) ||
      d.phone.includes(search)
  );

  const openAdd = () => {
    setNewDealerCode(uniqueDealerCode(dealerList));
    setNewName("");
    setNewPhone("");
    setNewArea("");
    setNewBalance("");
    setAddOpen(true);
  };

  const saveNewDealer = async () => {
    const dealerId = newDealerCode.trim();
    const name = newName.trim();
    const phone = newPhone.replace(/\D/g, "");
    const area = newArea.trim();

    if (!name || name.length > 50) {
      toast.error("Invalid name");
      return;
    }
    if (phone.length !== 10) {
      toast.error("Phone must be 10 digits");
      return;
    }
    if (area.length > 100) {
      toast.error("Area too long");
      return;
    }
    if (!dealerId || !area) {
      toast.error("Dealer ID and area are required");
      return;
    }
    if (dealerList.some((d) => d.dealerCode === dealerId)) {
      toast.error("This Dealer ID is already in use — close and open Add dealer again");
      return;
    }
    const balanceParsed = parseFloat(newBalance);
    const openingBalance =
      newBalance.trim() === "" || Number.isNaN(balanceParsed) ? 0 : Math.max(0, balanceParsed);
    const clientFallbackId = `d${Date.now()}`;
    setSavingDealer(true);
    try {
      const json = await createDealer({
        dealerId,
        name,
        phone,
        area,
        openingBalance: Number.isFinite(openingBalance) ? openingBalance : 0,
      });
      dealerFromCreateResponse(json, { dealerId, name, phone, area, openingBalance }, clientFallbackId);
      setAddOpen(false);
      toast.success("Dealer added");
      await loadDealers();
      requestDashboardRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save dealer", {
        description: "Check that the API is running (port 3001).",
      });
    } finally {
      setSavingDealer(false);
    }
  };

  const confirmDelete = async () => {
    if (!dealerToDelete) return;
    const id = dealerToDelete.id;
    const name = dealerToDelete.name;
    setDeletingDealerId(id);
    try {
      await deleteDealerApi(id);
      setDealerToDelete(null);
      toast.success(`Removed ${name}`);
      await loadDealers();
      requestDashboardRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete dealer", {
        description: "Check that the API is running (port 3001).",
      });
    } finally {
      setDeletingDealerId(null);
    }
  };

  return (
    <AppLayout title="Dealers">
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search dealers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Add Dealer */}
        <button
          type="button"
          onClick={openAdd}
          className="w-full h-12 rounded-xl border-2 border-dashed border-primary/40 text-primary flex items-center justify-center gap-2 touch-target active:bg-accent transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span className="text-sm font-medium">Add New Dealer</span>
        </button>

        {dealersLoading && (
          <p className="text-sm text-muted-foreground text-center py-6">Loading dealers…</p>
        )}

        {/* Dealer List */}
        <div className="space-y-2">
          {!dealersLoading &&
            filtered.map((dealer) => (
            <div
              key={dealer.id}
              className="flex items-stretch bg-card rounded-xl border overflow-hidden"
            >
              <button
                type="button"
                onClick={() => navigate(`/dealers/${dealer.id}`)}
                className="flex-1 min-w-0 p-4 text-left active:bg-muted transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <p className="text-[10px] font-medium text-muted-foreground">ID {dealer.dealerCode}</p>
                    <p className="text-sm font-semibold text-foreground truncate">{dealer.name}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3 shrink-0" />
                      {dealer.phone}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {dealer.area}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">Balance</p>
                    <p
                      className={`text-sm font-bold ${dealer.balance > 0 ? "text-destructive" : "text-primary"}`}
                    >
                      ₹{dealer.balance.toLocaleString()}
                    </p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setDealerToDelete(dealer)}
                disabled={deletingDealerId === dealer.id}
                className="shrink-0 w-12 flex items-center justify-center border-l bg-card text-muted-foreground hover:text-destructive hover:bg-destructive/5 active:bg-destructive/10 transition-colors touch-target disabled:opacity-50"
                aria-label={`Delete ${dealer.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            ))}
          {!dealersLoading && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {dealerList.length === 0 ? "No dealers added yet" : "No dealers match your search."}
            </p>
          )}
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add dealer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="dealer-code">Dealer ID</Label>
              <Input
                id="dealer-code"
                value={newDealerCode}
                disabled
                readOnly
                className="bg-muted/80 text-muted-foreground cursor-not-allowed"
                autoComplete="off"
              />
              <p className="text-[10px] text-muted-foreground">Auto-generated (shown on invoices).</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dealer-name">Shop / dealer name</Label>
              <Input
                id="dealer-name"
                value={newName}
                maxLength={50}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Shop or person name"
                autoComplete="organization"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dealer-phone">Phone</Label>
              <Input
                id="dealer-phone"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={newPhone}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setNewPhone(value);
                }}
                placeholder="10-digit mobile"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dealer-area">Area</Label>
              <Input
                id="dealer-area"
                value={newArea}
                maxLength={100}
                onChange={(e) => setNewArea(e.target.value)}
                placeholder="e.g. Anna Nagar"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dealer-balance">Opening balance (₹)</Label>
              <Input
                id="dealer-balance"
                type="text"
                inputMode="decimal"
                value={newBalance}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    setNewBalance("");
                    return;
                  }
                  if (/^\d*\.?\d*$/.test(raw) && !raw.startsWith("-")) setNewBalance(raw);
                }}
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveNewDealer()} disabled={savingDealer}>
              {savingDealer ? "Saving…" : "Add dealer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!dealerToDelete} onOpenChange={(open) => !open && setDealerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this dealer?</AlertDialogTitle>
            <AlertDialogDescription>
              {dealerToDelete ? (
                <>
                  Are you sure you want to remove <span className="font-medium text-foreground">{dealerToDelete.name}</span>? This
                  cannot be undone.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
              disabled={!!deletingDealerId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingDealerId ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default DealersPage;
