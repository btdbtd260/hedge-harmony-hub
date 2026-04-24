import { useState, useMemo } from "react";
import { formatDateQC } from "@/lib/utils";
import { formatPhone } from "@/lib/phoneFormat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  useInvoices, useUpdateInvoice, useCustomers, useJobs, useParameters,
  getClientNameFromList, type DbInvoice, type DbCustomer,
} from "@/hooks/useSupabaseData";
import { Search, Mail, FileDown, CheckCircle, Receipt, History, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { downloadInvoicePdf, getInvoiceNumber, type InvoicePdfData } from "@/lib/generateInvoicePdf";

const statusColor: Record<string, string> = {
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
  const [emailMessage, setEmailMessage] = useState("");
  const [emailInvoice, setEmailInvoice] = useState<DbInvoice | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Bill tab
  const [billClientId, setBillClientId] = useState("");

  // History tab
  const [historyDateFilter, setHistoryDateFilter] = useState("all");

  const invoiceNumberMap = useMemo(() => {
    const sorted = [...invoices].sort((a, b) => a.issued_at.localeCompare(b.issued_at));
    const map = new Map<string, string>();
    sorted.forEach((inv, i) => map.set(inv.id, getInvoiceNumber(i, inv.issued_at)));
    return map;
  }, [invoices]);

  // Hide draft invoices from the UI entirely — they only become visible
  // once the related job is marked completed (DB trigger flips them to "unpaid").
  const visibleInvoices = useMemo(() => invoices.filter((i) => i.status !== "draft"), [invoices]);

  const filtered = visibleInvoices.filter((i) =>
    getClientNameFromList(customers, i.client_id).toLowerCase().includes(search.toLowerCase()) ||
    (invoiceNumberMap.get(i.id) ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const unpaid = filtered.filter((i) => i.status === "unpaid");
  const paid = filtered.filter((i) => i.status === "paid");

  // History: sorted newest first, with optional date filter
  const historyInvoices = useMemo(() => {
    let list = [...filtered].sort((a, b) => b.issued_at.localeCompare(a.issued_at));
    if (historyDateFilter !== "all") {
      const now = new Date();
      const days = Number(historyDateFilter);
      const cutoff = new Date(now.getTime() - days * 86400000).toISOString();
      list = list.filter((i) => i.issued_at >= cutoff);
    }
    return list;
  }, [filtered, historyDateFilter]);

  const buildPdfData = (inv: DbInvoice): InvoicePdfData => {
    const customer = customers.find((c) => c.id === inv.client_id) ?? { id: inv.client_id, name: "Client inconnu", phone: "", email: "", address: "", status: "pending", hidden: false, created_at: "", active_year: 0 } as DbCustomer;
    const job = jobs.find((j) => j.id === inv.job_id) ?? null;
    return { invoice: inv, customer, job, params: params ?? null, invoiceNumber: invoiceNumberMap.get(inv.id) ?? "INV-000" };
  };

  const markAsPaid = async (id: string) => {
    try {
      await updateInvoice.mutateAsync({ id, status: "paid", paid_at: new Date().toISOString() });
      setSelectedInvoice((prev) => prev && prev.id === id ? { ...prev, status: "paid", paid_at: new Date().toISOString() } : prev);
      toast.success("Facture marquée comme payée");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDownloadPdf = async (inv: DbInvoice) => {
    setPdfLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 300)); // brief visual feedback
      await downloadInvoicePdf(buildPdfData(inv));
      toast.success("Facture PDF téléchargée");
    } finally {
      setPdfLoading(false);
    }
  };

  const openEmailDialog = (inv: DbInvoice) => {
    const client = customers.find((c) => c.id === inv.client_id);
    setEmailInvoice(inv);
    setEmailAddress(client?.email ?? "");
    setEmailMessage("");
    setShowEmailDialog(true);
  };

  const sendByEmail = () => {
    if (!emailAddress.trim() || !emailInvoice) return;
    toast.success(`Facture envoyée par email à ${emailAddress}`);
    setShowEmailDialog(false);
    setEmailAddress("");
    setEmailMessage("");
    setEmailInvoice(null);
  };

  const openDetail = (inv: DbInvoice) => setSelectedInvoice(inv);
  const job = selectedInvoice ? jobs.find((j) => j.id === selectedInvoice.job_id) : null;

  // ── Bill tab ──
  const clientsWithUnpaid = useMemo(() => {
    const map = new Map<string, DbInvoice[]>();
    visibleInvoices.filter((i) => i.status === "unpaid").forEach((inv) => {
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

  const downloadBillPdf = async () => {
    if (billInvoices.length === 0) return;
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const customer = customers.find((c) => c.id === billClientId);
    const companyName = params?.company_name || "HedgePro";

    let y = 20;
    doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.text(companyName, 14, y);
    doc.setFontSize(22); doc.text("RELEVÉ DE COMPTE", pageW - 14, y, { align: "right" });
    y += 15;
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(80);
    if (customer) {
      doc.text(`Client: ${customer.name}`, 14, y);
      if (customer.address) { y += 5; doc.text(customer.address, 14, y); }
      if (customer.phone) { y += 5; doc.text(`Tél: ${formatPhone(customer.phone)}`, 14, y); }
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
      startY: y, head: [["N° Facture", "Date", "Type", "Montant", "Statut"]], body,
      theme: "grid", headStyles: { fillColor: [45, 45, 45], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 }, columnStyles: { 3: { halign: "right" } }, margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(30);
    doc.text(`Total dû: $${billTotal.toFixed(2)}`, pageW - 14, y, { align: "right" });
    doc.save(`releve-${customer?.name.replace(/\s+/g, "_") ?? "client"}.pdf`);
    toast.success("Relevé PDF téléchargé");
  };

  // ── Invoice row component ──
  const InvoiceRow = ({ inv }: { inv: DbInvoice }) => (
    <div className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => openDetail(inv)}>
      <div>
        <p className="font-medium">{getClientNameFromList(customers, inv.client_id)}</p>
        <p className="text-xs text-muted-foreground">
          <span className="font-mono font-semibold text-foreground">{invoiceNumberMap.get(inv.id)}</span>
          {" · Émise "}
          {formatDateQC(inv.issued_at)}
          {inv.paid_at ? ` · Payée ${formatDateQC(inv.paid_at)}` : ""}
        </p>
      </div>
      <div className="text-right space-y-1">
        <p className="font-semibold">${Number(inv.amount).toFixed(2)}</p>
        <Badge className={statusColor[inv.status]}>{inv.status === "paid" ? "Payée" : "Impayée"}</Badge>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Facturation</h1>
        <p className="text-muted-foreground">Gérez vos factures et relevés</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Rechercher par client ou n° facture…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Tabs defaultValue="unpaid">
        <TabsList>
          <TabsTrigger value="unpaid">Impayées ({unpaid.length})</TabsTrigger>
          <TabsTrigger value="paid">Payées ({paid.length})</TabsTrigger>
          <TabsTrigger value="all">Toutes ({filtered.length})</TabsTrigger>
          <TabsTrigger value="history"><History className="h-4 w-4 mr-1" />Historique ({invoices.length})</TabsTrigger>
          <TabsTrigger value="bill"><Receipt className="h-4 w-4 mr-1" />Relevé</TabsTrigger>
        </TabsList>

        {/* Unpaid / Paid / All tabs */}
        {["unpaid", "paid", "all"].map((tab) => {
          const list = tab === "unpaid" ? unpaid : tab === "paid" ? paid : filtered;
          return (
            <TabsContent key={tab} value={tab} className="mt-4">
              <Card>
                <CardContent className="p-4 space-y-2">
                  {list.length === 0 ? <p className="text-sm text-muted-foreground">Aucune facture trouvée.</p> : list.map((inv) => <InvoiceRow key={inv.id} inv={inv} />)}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}

        {/* History tab */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" />Historique des factures</CardTitle>
                <Select value={historyDateFilter} onValueChange={setHistoryDateFilter}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les dates</SelectItem>
                    <SelectItem value="30">30 derniers jours</SelectItem>
                    <SelectItem value="90">90 derniers jours</SelectItem>
                    <SelectItem value="365">Dernière année</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {historyInvoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune facture trouvée.</p>
              ) : (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N° Facture</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyInvoices.map((inv) => (
                        <TableRow key={inv.id} className="cursor-pointer hover:bg-accent/50" onClick={() => openDetail(inv)}>
                          <TableCell className="font-mono font-semibold">{invoiceNumberMap.get(inv.id)}</TableCell>
                          <TableCell>{getClientNameFromList(customers, inv.client_id)}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDateQC(inv.issued_at)}</TableCell>
                          <TableCell className="text-right font-semibold">${Number(inv.amount).toFixed(2)}</TableCell>
                          <TableCell><Badge className={statusColor[inv.status]}>{inv.status === "paid" ? "Payée" : "Impayée"}</Badge></TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" onClick={() => handleDownloadPdf(inv)} title="Télécharger PDF"><FileDown className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => openEmailDialog(inv)} title="Envoyer email"><Mail className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bill / Relevé tab */}
        <TabsContent value="bill" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" />Relevé de compte</CardTitle></CardHeader>
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
                        <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => openDetail(inv)}>
                          <div>
                            <p className="text-sm font-mono font-semibold">{invoiceNumberMap.get(inv.id)}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateQC(inv.issued_at)} · {j ? (j.cut_type === "levelling" ? "Nivelage" : "Taille") : "—"}
                            </p>
                          </div>
                          <div className="text-right flex items-center gap-3">
                            <p className="font-semibold">${Number(inv.amount).toFixed(2)}</p>
                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDownloadPdf(inv); }} title="PDF"><FileDown className="h-4 w-4" /></Button>
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
        <DialogContent className="sm:max-w-lg">
          {selectedInvoice && (() => {
            const client = customers.find((c) => c.id === selectedInvoice.client_id);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <span className="font-mono">{invoiceNumberMap.get(selectedInvoice.id)}</span>
                    <Badge className={statusColor[selectedInvoice.status]}>{selectedInvoice.status === "paid" ? "Payée" : "Impayée"}</Badge>
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Client info */}
                  <div className="rounded-lg border p-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Client</p>
                    <p className="font-semibold">{client?.name ?? "Client inconnu"}</p>
                    {client?.address && <p className="text-sm text-muted-foreground">{client.address}</p>}
                    {client?.phone && <p className="text-sm text-muted-foreground">Tél: {formatPhone(client.phone)}</p>}
                    {client?.email && <p className="text-sm text-muted-foreground">{client.email}</p>}
                  </div>

                  {/* Invoice details */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Montant</span><p className="font-semibold text-lg">${Number(selectedInvoice.amount).toFixed(2)}</p></div>
                    <div><span className="text-muted-foreground">Date émission</span><p>{formatDateQC(selectedInvoice.issued_at)}</p></div>
                    {selectedInvoice.paid_at && <div><span className="text-muted-foreground">Date paiement</span><p>{formatDateQC(selectedInvoice.paid_at)}</p></div>}
                    <div><span className="text-muted-foreground">Job lié</span><p>{job ? `${job.cut_type === "levelling" ? "Nivelage" : "Taille"} · ${formatDateQC(job.scheduled_date)}` : "—"}</p></div>
                    {job?.total_duration_minutes && <div><span className="text-muted-foreground">Durée</span><p>{job.total_duration_minutes} min</p></div>}
                  </div>
                </div>

                {/* Action buttons - prominent */}
                <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
                  {selectedInvoice.status === "unpaid" && (
                    <Button className="w-full sm:w-auto" onClick={() => markAsPaid(selectedInvoice.id)}>
                      <CheckCircle className="h-4 w-4 mr-1" /> Marquer payée
                    </Button>
                  )}
                  <Button variant="outline" className="w-full sm:w-auto" onClick={() => handleDownloadPdf(selectedInvoice)} disabled={pdfLoading}>
                    {pdfLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
                    Télécharger PDF
                  </Button>
                  <Button variant="outline" className="w-full sm:w-auto" onClick={() => { openEmailDialog(selectedInvoice); setSelectedInvoice(null); }}>
                    <Mail className="h-4 w-4 mr-1" /> Envoyer email
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
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
            <div className="space-y-1">
              <Label>Message (optionnel)</Label>
              <Textarea value={emailMessage} onChange={(e) => setEmailMessage(e.target.value)} placeholder="Bonjour, veuillez trouver ci-joint votre facture…" rows={3} />
            </div>
            {emailInvoice && (
              <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                <p className="font-mono font-semibold">{invoiceNumberMap.get(emailInvoice.id)}</p>
                <p className="text-muted-foreground">
                  {getClientNameFromList(customers, emailInvoice.client_id)} · ${Number(emailInvoice.amount).toFixed(2)}
                </p>
              </div>
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
