import { useState, useMemo } from "react";
import { formatDateQC } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useInvoices, useUpdateInvoice, useCustomers, useJobs, useParameters,
  getClientNameFromList, type DbInvoice, type DbCustomer,
} from "@/hooks/useSupabaseData";
import { Search, Mail, FileDown, CheckCircle, Receipt } from "lucide-react";
import { toast } from "sonner";
import { downloadInvoicePdf, getInvoiceNumber, type InvoicePdfData } from "@/lib/generateInvoicePdf";

const invoiceStatusColor: Record<string, string> = {
  unpaid: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
};

const Invoices = () => {
  const { data: invoices = [] } = useInvoices();
  const { data: customers = [] } = useCustomers();
  const { data: jobs = [] } = useJobs();
  const { data: params } = useParameters();
  const updateInvoice = useUpdateInvoice();

  const [search, setSearch] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<DbInvoice | null>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [emailInvoice, setEmailInvoice] = useState<DbInvoice | null>(null);

  // Bill tab state
  const [billClientId, setBillClientId] = useState<string>("");

  const filtered = invoices.filter((i) =>
    getClientNameFromList(customers, i.client_id).toLowerCase().includes(search.toLowerCase())
  );
  const unpaid = filtered.filter((i) => i.status === "unpaid");
  const paid = filtered.filter((i) => i.status === "paid");

  // Invoice number map (sorted by issued_at)
  const invoiceNumberMap = useMemo(() => {
    const sorted = [...invoices].sort((a, b) => a.issued_at.localeCompare(b.issued_at));
    const map = new Map<string, string>();
    sorted.forEach((inv, i) => map.set(inv.id, getInvoiceNumber(i, inv.issued_at)));
    return map;
  }, [invoices]);

  const buildPdfData = (inv: DbInvoice): InvoicePdfData => {
    const customer = customers.find((c) => c.id === inv.client_id) ?? { id: inv.client_id, name: "Client inconnu", phone: "", email: "", address: "", status: "pending", hidden: false, created_at: "", active_year: 0 } as DbCustomer;
    const job = jobs.find((j) => j.id === inv.job_id) ?? null;
    return {
      invoice: inv,
      customer,
      job,
      params: params ?? null,
      invoiceNumber: invoiceNumberMap.get(inv.id) ?? "INV-000",
    };
  };

  const markAsPaid = async (id: string) => {
    try {
      await updateInvoice.mutateAsync({ id, status: "paid", paid_at: new Date().toISOString() });
      setSelectedInvoice((prev) => prev && prev.id === id ? { ...prev, status: "paid", paid_at: new Date().toISOString() } : prev);
      toast.success("Facture marquée comme payée");
    } catch (e: any) { toast.error(e.message); }
  };

  const openEmailDialog = (inv: DbInvoice) => {
    const client = customers.find((c) => c.id === inv.client_id);
    setEmailInvoice(inv);
    setEmailAddress(client?.email ?? "");
    setShowEmailDialog(true);
  };

  const sendByEmail = () => {
    if (!emailAddress.trim() || !emailInvoice) return;
    toast.success(`Facture envoyée par email à ${emailAddress}`);
    setShowEmailDialog(false);
    setEmailAddress("");
    setEmailInvoice(null);
  };

  const handleDownloadPdf = (inv: DbInvoice) => {
    downloadInvoicePdf(buildPdfData(inv));
    toast.success("Facture PDF téléchargée");
  };

  const job = selectedInvoice ? jobs.find((j) => j.id === selectedInvoice.job_id) : null;

  // ── Bill tab data ──
  const clientsWithUnpaid = useMemo(() => {
    const map = new Map<string, DbInvoice[]>();
    invoices.filter((i) => i.status === "unpaid").forEach((inv) => {
      const list = map.get(inv.client_id) || [];
      list.push(inv);
      map.set(inv.client_id, list);
    });
    return map;
  }, [invoices]);

  const billInvoices = billClientId ? (clientsWithUnpaid.get(billClientId) || []) : [];
  const billTotal = billInvoices.reduce((s, i) => s + Number(i.amount), 0);

  const markAllBillPaid = async () => {
    try {
      const now = new Date().toISOString();
      await Promise.all(billInvoices.map((inv) => updateInvoice.mutateAsync({ id: inv.id, status: "paid", paid_at: now })));
      toast.success(`${billInvoices.length} facture(s) marquée(s) payée(s)`);
    } catch (e: any) { toast.error(e.message); }
  };

  const downloadBillPdf = () => {
    if (billInvoices.length === 0) return;
    const { jsPDF } = require("jspdf");
    const autoTable = require("jspdf-autotable").default;
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const customer = customers.find((c) => c.id === billClientId);
    const companyName = params?.company_name || "HedgePro";

    let y = 20;
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(companyName, 14, y);
    doc.setFontSize(22);
    doc.text("RELEVÉ DE COMPTE", pageW - 14, y, { align: "right" });
    y += 15;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    if (customer) {
      doc.text(`Client: ${customer.name}`, 14, y);
      if (customer.address) { y += 5; doc.text(customer.address, 14, y); }
      if (customer.phone) { y += 5; doc.text(`Tél: ${customer.phone}`, 14, y); }
    }
    y += 12;

    const body = billInvoices.map((inv) => {
      const j = jobs.find((jb) => jb.id === inv.job_id);
      return [
        invoiceNumberMap.get(inv.id) ?? "—",
        formatDateQC(inv.issued_at),
        j ? (j.cut_type === "levelling" ? "Nivelage" : "Taille") : "—",
        `$${Number(inv.amount).toFixed(2)}`,
        inv.status === "paid" ? "Payée" : "Impayée",
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [["N° Facture", "Date", "Type", "Montant", "Statut"]],
      body,
      theme: "grid",
      headStyles: { fillColor: [45, 45, 45], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 3: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.text(`Total dû: $${billTotal.toFixed(2)}`, pageW - 14, y, { align: "right" });

    doc.save(`releve-${customer?.name.replace(/\s+/g, "_") ?? "client"}.pdf`);
    toast.success("Relevé PDF téléchargé");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Facturation</h1>
        <p className="text-muted-foreground">Gérez vos factures et relevés</p>
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
          <TabsTrigger value="bill"><Receipt className="h-4 w-4 mr-1" />Relevé</TabsTrigger>
        </TabsList>

        {["unpaid", "paid", "all"].map((tab) => {
          const list = tab === "unpaid" ? unpaid : tab === "paid" ? paid : filtered;
          return (
            <TabsContent key={tab} value={tab} className="mt-4">
              <Card>
                <CardContent className="p-4 space-y-3">
                  {list.length === 0 ? <p className="text-sm text-muted-foreground">Aucune facture trouvée.</p> : list.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setSelectedInvoice(inv)}>
                      <div>
                        <p className="font-medium">{getClientNameFromList(customers, inv.client_id)}</p>
                        <p className="text-xs text-muted-foreground">
                          {invoiceNumberMap.get(inv.id)} · Émise {formatDateQC(inv.issued_at)}{inv.paid_at ? ` · Payée ${formatDateQC(inv.paid_at)}` : ""}
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

        {/* ── Bill / Relevé tab ── */}
        <TabsContent value="bill" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" />Relevé de compte</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-sm">
                <Label>Sélectionner un client</Label>
                <Select value={billClientId} onValueChange={setBillClientId}>
                  <SelectTrigger><SelectValue placeholder="Choisir un client…" /></SelectTrigger>
                  <SelectContent>
                    {Array.from(clientsWithUnpaid.entries()).map(([cid, invs]) => (
                      <SelectItem key={cid} value={cid}>
                        {getClientNameFromList(customers, cid)} ({invs.length} impayée{invs.length > 1 ? "s" : ""})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {billClientId && billInvoices.length > 0 && (
                <>
                  <div className="space-y-2">
                    {billInvoices.map((inv) => {
                      const j = jobs.find((jb) => jb.id === inv.job_id);
                      return (
                        <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div>
                            <p className="text-sm font-medium">{invoiceNumberMap.get(inv.id)}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateQC(inv.issued_at)} · {j ? (j.cut_type === "levelling" ? "Nivelage" : "Taille") : "—"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">${Number(inv.amount).toFixed(2)}</p>
                            <Badge className={invoiceStatusColor[inv.status]}>{inv.status}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                    <div>
                      <p className="text-sm text-muted-foreground">Total dû</p>
                      <p className="text-xl font-bold">${billTotal.toFixed(2)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={downloadBillPdf}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
                      <Button onClick={markAllBillPaid}><CheckCircle className="h-4 w-4 mr-1" />Tout marquer payé</Button>
                    </div>
                  </div>
                </>
              )}

              {billClientId && billInvoices.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucune facture impayée pour ce client.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Invoice detail dialog ── */}
      <Dialog open={!!selectedInvoice} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
        <DialogContent>
          {selectedInvoice && (
            <>
              <DialogHeader><DialogTitle>Facture {invoiceNumberMap.get(selectedInvoice.id)} — {getClientNameFromList(customers, selectedInvoice.client_id)}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Montant</span><span className="font-semibold">${selectedInvoice.amount}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Statut</span><Badge className={invoiceStatusColor[selectedInvoice.status]}>{selectedInvoice.status}</Badge></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Date émission</span><span>{formatDateQC(selectedInvoice.issued_at)}</span></div>
                {selectedInvoice.paid_at && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Date paiement</span><span>{formatDateQC(selectedInvoice.paid_at)}</span></div>}
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Job lié</span><span>{job ? `${job.cut_type} · ${formatDateQC(job.scheduled_date)}` : selectedInvoice.job_id}</span></div>
              </div>
              <DialogFooter className="flex gap-2 flex-wrap">
                {selectedInvoice.status === "unpaid" && <Button onClick={() => markAsPaid(selectedInvoice.id)}><CheckCircle className="h-4 w-4 mr-1" /> Marquer payée</Button>}
                <Button variant="outline" onClick={() => openEmailDialog(selectedInvoice)}><Mail className="h-4 w-4 mr-1" /> Envoyer email</Button>
                <Button variant="outline" onClick={() => handleDownloadPdf(selectedInvoice)}><FileDown className="h-4 w-4 mr-1" /> PDF</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Email dialog ── */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Envoyer la facture par email</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Adresse courriel *</Label>
              <Input type="email" value={emailAddress} onChange={(e) => setEmailAddress(e.target.value)} placeholder="email@exemple.com" />
            </div>
            {emailInvoice && (
              <p className="text-sm text-muted-foreground">
                Facture {invoiceNumberMap.get(emailInvoice.id)} de ${emailInvoice.amount} pour {getClientNameFromList(customers, emailInvoice.client_id)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>Annuler</Button>
            <Button onClick={sendByEmail} disabled={!emailAddress.trim()}><Mail className="h-4 w-4 mr-1" /> Envoyer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Invoices;
