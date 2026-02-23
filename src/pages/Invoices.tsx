import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { invoices as mockInvoices, getClientName, jobs } from "@/data/mock";
import { Search, Mail, FileDown, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import type { Invoice } from "@/types";

const invoiceStatusColor: Record<string, string> = {
  unpaid: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
};

const Invoices = () => {
  const [search, setSearch] = useState("");
  const [invoiceList, setInvoiceList] = useState<Invoice[]>(mockInvoices);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const filtered = invoiceList.filter((i) =>
    getClientName(i.clientId).toLowerCase().includes(search.toLowerCase())
  );

  const unpaid = filtered.filter((i) => i.status === "unpaid");
  const paid = filtered.filter((i) => i.status === "paid");

  const markAsPaid = (id: string) => {
    setInvoiceList((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, status: "paid" as const, paidAt: new Date().toISOString().split("T")[0] } : i
      )
    );
    setSelectedInvoice((prev) =>
      prev && prev.id === id ? { ...prev, status: "paid", paidAt: new Date().toISOString().split("T")[0] } : prev
    );
    toast.success("Facture marquée comme payée");
  };

  const sendByEmail = (inv: Invoice) => {
    toast.success(`Facture envoyée par email à ${getClientName(inv.clientId)}`);
  };

  const downloadPdf = (inv: Invoice) => {
    toast.success("Téléchargement du PDF…");
  };

  const job = selectedInvoice ? jobs.find((j) => j.id === selectedInvoice.jobId) : null;

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
                    <div
                      key={inv.id}
                      className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => setSelectedInvoice(inv)}
                    >
                      <div>
                        <p className="font-medium">{getClientName(inv.clientId)}</p>
                        <p className="text-xs text-muted-foreground">
                          Émise {inv.issuedAt}
                          {inv.paidAt ? ` · Payée ${inv.paidAt}` : ""}
                        </p>
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

      {/* Invoice Detail Dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
        <DialogContent>
          {selectedInvoice && (
            <>
              <DialogHeader>
                <DialogTitle>Facture — {getClientName(selectedInvoice.clientId)}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Montant</span>
                  <span className="font-semibold">${selectedInvoice.amount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Statut</span>
                  <Badge className={invoiceStatusColor[selectedInvoice.status]}>{selectedInvoice.status}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Date émission</span>
                  <span>{selectedInvoice.issuedAt}</span>
                </div>
                {selectedInvoice.paidAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Date paiement</span>
                    <span>{selectedInvoice.paidAt}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Job lié</span>
                  <span>{job ? `${job.cutType} · ${job.scheduledDate}` : selectedInvoice.jobId}</span>
                </div>
              </div>
              <DialogFooter className="flex gap-2 flex-wrap">
                {selectedInvoice.status === "unpaid" && (
                  <Button onClick={() => markAsPaid(selectedInvoice.id)}>
                    <CheckCircle className="h-4 w-4 mr-1" /> Marquer payée
                  </Button>
                )}
                <Button variant="outline" onClick={() => sendByEmail(selectedInvoice)}>
                  <Mail className="h-4 w-4 mr-1" /> Envoyer email
                </Button>
                <Button variant="outline" onClick={() => downloadPdf(selectedInvoice)}>
                  <FileDown className="h-4 w-4 mr-1" /> PDF
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Invoices;
