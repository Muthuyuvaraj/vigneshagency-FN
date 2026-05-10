import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { dealers as dealersSeed, transactions } from "@/data/mockData";
import { loadDealers } from "@/lib/dealersStore";
import { ChevronDown, ArrowUpRight, ArrowDownLeft } from "lucide-react";

const AccountsPage = () => {
  const dealers = loadDealers(dealersSeed);
  const [selectedDealerId, setSelectedDealerId] = useState(() => dealers[0]?.id ?? "");
  const dealer = dealers.find((d) => d.id === selectedDealerId);
  const txns = transactions.filter((t) => t.dealerId === selectedDealerId);

  if (dealers.length === 0) {
    return (
      <AppLayout title="Accounts">
        <p className="text-sm text-muted-foreground text-center py-8">Add a dealer first to view accounts.</p>
      </AppLayout>
    );
  }

  if (!dealer) {
    return (
      <AppLayout title="Accounts">
        <p className="text-sm text-muted-foreground text-center py-8">Select a dealer.</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Accounts">
      <div className="space-y-4">
        {/* Dealer Select */}
        <div className="relative">
          <select
            value={selectedDealerId}
            onChange={(e) => setSelectedDealerId(e.target.value)}
            className="w-full h-12 px-4 pr-10 rounded-xl border bg-card text-sm text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-ring touch-target"
          >
            {dealers.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>

        {/* Balance Card */}
        <div className="bg-primary text-primary-foreground rounded-xl p-4">
          <p className="text-sm opacity-80">Outstanding Balance</p>
          <p className="text-2xl font-bold">₹{dealer.balance.toLocaleString()}</p>
        </div>

        {/* Timeline */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Transaction History</h3>
          <div className="space-y-1">
            {txns.map((txn, i) => (
              <div key={txn.id} className="flex gap-3">
                {/* Timeline dot */}
                <div className="flex flex-col items-center">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                    txn.type === "payment" ? "bg-accent text-primary" : "bg-destructive/10 text-destructive"
                  }`}>
                    {txn.type === "payment" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </div>
                  {i < txns.length - 1 && <div className="w-px h-full bg-border min-h-[16px]" />}
                </div>
                {/* Content */}
                <div className="bg-card rounded-xl border p-3 flex-1 mb-2">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{txn.description}</p>
                      <p className="text-xs text-muted-foreground">{txn.date}</p>
                    </div>
                    <p className={`text-sm font-bold ${txn.type === "payment" ? "text-primary" : "text-destructive"}`}>
                      {txn.type === "payment" ? "+" : "-"}₹{txn.amount}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AccountsPage;
