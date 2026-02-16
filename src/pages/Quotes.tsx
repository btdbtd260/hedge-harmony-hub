import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { quotes as mockQuotes, invoices as mockInvoices } from "@/data/mock";
import { Search } from "lucide-react";

const quoteStatusColor: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-emerald-100 text-emerald-700",
  declined: "bg-red-100 text-red-700",
};

const invoiceStatusColor: Record<string, string> = {
  unpaid: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
};

const Quotes = () => {
  const [search, setSearch] = useState("");

  const filteredQuotes = mockQuotes.filter((q) => q.customerName.toLowerCase().includes(search.toLowerCase()));
  const filteredInvoices = mockInvoices.filter((i) => i.customerName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Quotes & Invoices</h1>
        <p className="text-muted-foreground">Manage quotes and billing</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by customer…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Tabs defaultValue="quotes">
        <TabsList>
          <TabsTrigger value="quotes">Quotes ({filteredQuotes.length})</TabsTrigger>
          <TabsTrigger value="invoices">Invoices ({filteredInvoices.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="quotes" className="mt-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              {filteredQuotes.length === 0 ? <p className="text-sm text-muted-foreground">No quotes found.</p> : filteredQuotes.map((q) => (
                <div key={q.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{q.customerName}</p>
                    <p className="text-sm text-muted-foreground">{q.items.map(i => i.description).join(", ")}</p>
                    <p className="text-xs text-muted-foreground">{q.createdAt}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-semibold">${q.total}</p>
                    <Badge className={quoteStatusColor[q.status]}>{q.status}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              {filteredInvoices.length === 0 ? <p className="text-sm text-muted-foreground">No invoices found.</p> : filteredInvoices.map((i) => (
                <div key={i.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{i.customerName}</p>
                    <p className="text-xs text-muted-foreground">Issued {i.issuedAt}{i.paidAt ? ` · Paid ${i.paidAt}` : ""}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-semibold">${i.amount}</p>
                    <Badge className={invoiceStatusColor[i.status]}>{i.status}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Quotes;
