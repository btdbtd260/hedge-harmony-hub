import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { invoices as mockInvoices, getClientName } from "@/data/mock";
import { Search } from "lucide-react";

const invoiceStatusColor: Record<string, string> = {
  unpaid: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
};

const Invoices = () => {
  const [search, setSearch] = useState("");

  const filtered = mockInvoices.filter((i) =>
    getClientName(i.clientId).toLowerCase().includes(search.toLowerCase())
  );

  const unpaid = filtered.filter((i) => i.status === "unpaid");
  const paid = filtered.filter((i) => i.status === "paid");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Facturation</h1>
        <p className="text-muted-foreground">Gérez vos factures</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Rechercher par client…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Tabs defaultValue="unpaid">
        <TabsList>
          <TabsTrigger value="unpaid">Impayées ({unpaid.length})</TabsTrigger>
          <TabsTrigger value="paid">Payées ({paid.length})</TabsTrigger>
          <TabsTrigger value="all">Toutes ({filtered.length})</TabsTrigger>
        </TabsList>

        {["unpaid", "paid", "all"].map((tab) => {
          const list = tab === "unpaid" ? unpaid : tab === "paid" ? paid : filtered;
          return (
            <TabsContent key={tab} value={tab} className="mt-4">
              <Card>
                <CardContent className="p-4 space-y-3">
                  {list.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune facture trouvée.</p>
                  ) : list.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{getClientName(inv.clientId)}</p>
                        <p className="text-xs text-muted-foreground">
                          Émise {inv.issuedAt}
                          {inv.paidAt ? ` · Payée ${inv.paidAt}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">Job: {inv.jobId}</p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="font-semibold">${inv.amount}</p>
                        <Badge className={invoiceStatusColor[inv.status]}>{inv.status}</Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
};

export default Invoices;
