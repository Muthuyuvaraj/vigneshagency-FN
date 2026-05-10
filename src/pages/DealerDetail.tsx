import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { dealers as dealersSeed, bills, transactions } from "@/data/mockData";
import { loadDealers } from "@/lib/dealersStore";
import { ArrowLeft, Phone, MapPin, Receipt, CreditCard } from "lucide-react";

const DealerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dealer = loadDealers(dealersSeed).find((d) => d.id === id);
  const dealerBills = bills.filter(
    (b) => id != null && (b.dealerMongoId === id || (b.dealerMongoId == null && b.dealerId === id))
  );
  const dealerTxns = transactions.filter((t) => t.dealerId === id);

  if (!dealer) return <AppLayout title="Dealer"><p className="text-muted-foreground">Not found</p></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground touch-target">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* Info Card */}
        <div className="bg-card rounded-xl border p-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Dealer ID {dealer.dealerCode}</p>
          <h2 className="text-lg font-bold text-foreground">{dealer.name}</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-4 w-4" />{dealer.phone}</div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{dealer.area}</div>
          <div className="pt-2 border-t mt-2">
            <p className="text-xs text-muted-foreground">Outstanding Balance</p>
            <p className={`text-xl font-bold ${dealer.balance > 0 ? "text-destructive" : "text-primary"}`}>₹{dealer.balance.toLocaleString()}</p>
          </div>
        </div>

        {/* Bills */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2"><Receipt className="h-4 w-4" />Bills</h3>
          <div className="space-y-2">
            {dealerBills.map((bill) => (
              <button key={bill.id} onClick={() => navigate(`/invoice/${bill.id}`)} className="w-full bg-card rounded-xl border p-3 flex justify-between active:bg-muted transition-colors">
                <div><p className="text-sm font-medium text-foreground">{bill.id}</p><p className="text-xs text-muted-foreground">{bill.date}</p></div>
                <div className="text-right"><p className="text-sm font-bold text-foreground">₹{bill.total}</p>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                      bill.status === "cancelled"
                        ? "text-red-500"
                        : bill.status === "paid"
                          ? "text-green-500"
                          : bill.status === "partial"
                            ? "text-amber-600"
                            : "text-yellow-500"
                    }`}
                  >
                    {bill.status}
                  </span>
                </div>
              </button>
            ))}
            {dealerBills.length === 0 && <p className="text-sm text-muted-foreground">No bills yet</p>}
          </div>
        </div>

        {/* Transactions */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2"><CreditCard className="h-4 w-4" />Transactions</h3>
          <div className="space-y-2">
            {dealerTxns.map((txn) => (
              <div key={txn.id} className="bg-card rounded-xl border p-3 flex justify-between">
                <div><p className="text-sm font-medium text-foreground">{txn.description}</p><p className="text-xs text-muted-foreground">{txn.date}</p></div>
                <p className={`text-sm font-bold ${txn.type === "payment" ? "text-primary" : "text-destructive"}`}>
                  {txn.type === "payment" ? "+" : "-"}₹{txn.amount}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default DealerDetail;
