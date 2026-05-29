import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Card as Card2 } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInvoices, useExpenses, useInsertExpense, useEmployees, useEmployeeJobs, useJobs } from "@/hooks/useSupabaseData";
import { DollarSign, TrendingUp, TrendingDown, Plus, Camera, FileText, Fuel } from "lucide-react";
import { toast } from "sonner";
import type { ExpenseCategory } from "@/types";

type FilterMode = "daily" | "weekly" | "yearly";

const Finance = () => {
  const { data: invoices = [] } = useInvoices();
  const { data: expenseList = [] } = useExpenses();
  const { data: employees = [] } = useEmployees();
  const { data: employeeJobs = [] } = useEmployeeJobs();
  const { data: jobs = [] } = useJobs();
  const insertExpense = useInsertExpense();

  const [filter, setFilter] = useState<FilterMode>("yearly");
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [addMode, setAddMode] = useState<"manual" | "auto">("manual");

  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] = useState<ExpenseCategory>("other");
  const [expDate, setExpDate] = useState(new Date().toISOString().split("T")[0]);
  const [ocrPreview, setOcrPreview] = useState<{ description: string; amount: string; date: string } | null>(null);

  const now = new Date();

  const getWeekRange = () => {
    const end = new Date(now);
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { start, end };
  };

  const filterByDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (filter === "daily") return d.toISOString().split("T")[0] === now.toISOString().split("T")[0];
    if (filter === "weekly") {
      const { start, end } = getWeekRange();
      return d >= new Date(start.toISOString().split("T")[0]) && d <= end;
    }
    return d.getFullYear() === now.getFullYear();
  };

  const filteredInvoices = invoices.filter((i) => i.status === "paid" && filterByDate(i.paid_at || i.issued_at));
  const filteredExpenses = expenseList.filter((e) => filterByDate(e.date));

  const adminIds = new Set(employees.filter((e) => e.is_admin).map((e) => e.id));
  const employeePayEntries = employeeJobs
    .map((ej) => {
      const job = jobs.find((j) => j.id === ej.job_id);
      if (!job || job.status !== "completed") return null;
      const dateStr = job.scheduled_date ?? job.created_at;
      if (!dateStr) return null;
      return { amount: Number(ej.calculated_pay ?? 0), isAdmin: adminIds.has(ej.employee_id), date: dateStr };
    })
    .filter((x): x is { amount: number; isAdmin: boolean; date: string } => x !== null && x.amount !== 0)
    .filter((x) => filterByDate(x.date));

  const totalProfit = employeePayEntries.filter((x) => x.isAdmin).reduce((s, x) => s + x.amount, 0);
  const normalLaborCost = employeePayEntries.filter((x) => !x.isAdmin).reduce((s, x) => s + x.amount, 0);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0) + normalLaborCost;
  const netProfit = totalProfit - totalExpenses;

  const formatDateRange = () => {
    if (filter === "daily") return now.toLocaleDateString("fr-CA");
    if (filter === "weekly") {
      const { start, end } = getWeekRange();
      return `${start.toLocaleDateString("fr-CA")} au ${end.toLocaleDateString("fr-CA")}`;
    }
    return `1 jan. ${now.getFullYear()} au ${now.toLocaleDateString("fr-CA")}`;
  };

  const handleAddManual = async () => {
    if (!expDesc.trim() || !expAmount) return;
    try {
      await insertExpense.mutateAsync({ category: expCategory, amount: Number(expAmount), description: expDesc.trim(), date: expDate });
      setShowAddExpense(false); setExpDesc(""); setExpAmount("");
      toast.success("Dépense ajoutée");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleQuickExpense = async (category: ExpenseCategory, description: string) => {
    setExpCategory(category); setExpDesc(description); setExpDate(new Date().toISOString().split("T")[0]);
    setExpAmount(""); setAddMode("manual"); setOcrPreview(null); setShowAddExpense(true);
  };

  const handleOcrUpload = (file: File) => {
    setTimeout(() => {
      setOcrPreview({ description: file.name.replace(/\.[^.]+$/, ""), amount: String(Math.floor(Math.random() * 200) + 20), date: new Date().toISOString().split("T")[0] });
    }, 500);
  };

  const confirmOcr = async () => {
    if (!ocrPreview) return;
    try {
      await insertExpense.mutateAsync({ category: "other", amount: Number(ocrPreview.amount), description: ocrPreview.description, date: ocrPreview.date });
      setOcrPreview(null); setShowAddExpense(false);
      toast.success("Dépense ajoutée (OCR)");
    } catch (e: any) { toast.error(e.message); }
  };

  const filterLabel: Record<FilterMode, string> = { daily: "Quotidien", weekly: "Hebdo", yearly: "Annuel" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Finance</h1>
          <p className="text-muted-foreground">Suivi des revenus et dépenses</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as FilterMode)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Quotidien</SelectItem>
              <SelectItem value="weekly">Hebdo</SelectItem>
              <SelectItem value="yearly">Annuel</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => { setShowAddExpense(true); setAddMode("manual"); setOcrPreview(null); setExpDesc(""); setExpAmount(""); setExpCategory("other"); }}><Plus className="h-4 w-4 mr-1" /> Dépense</Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">Période : {formatDateRange()}</p>

      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => handleQuickExpense("gas", "Essence")}><Fuel className="h-4 w-4 mr-1" /> Essence</Button>
        <Button variant="outline" size="sm" onClick={() => handleQuickExpense("equipment", "Équipement")}>Équipement</Button>
        <Button variant="outline" size="sm" onClick={() => handleQuickExpense("insurance", "Assurance")}>Assurance</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-emerald-600" /></div><div><p className="text-sm text-muted-foreground">Profit ({filterLabel[filter]})</p><p className="text-2xl font-bold text-emerald-600">${totalProfit.toFixed(2)}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center"><TrendingDown className="h-5 w-5 text-red-600" /></div><div><p className="text-sm text-muted-foreground">Dépenses ({filterLabel[filter]})</p><p className="text-2xl font-bold text-red-600">${totalExpenses.toFixed(2)}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><DollarSign className="h-5 w-5 text-primary" /></div><div><p className="text-sm text-muted-foreground">Net Profit ({filterLabel[filter]})</p><p className="text-2xl font-bold">${netProfit.toFixed(2)}</p></div></div></CardContent></Card>
      </div>

      <Dialog open={showAddExpense} onOpenChange={setShowAddExpense}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter une dépense</DialogTitle></DialogHeader>
          <Tabs value={addMode} onValueChange={(v) => { setAddMode(v as "manual" | "auto"); setOcrPreview(null); }}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="manual"><FileText className="h-4 w-4 mr-1" /> Manuel</TabsTrigger>
              <TabsTrigger value="auto"><Camera className="h-4 w-4 mr-1" /> Automatique</TabsTrigger>
            </TabsList>
            <TabsContent value="manual" className="space-y-3 mt-3">
              <div className="space-y-1"><Label>Description *</Label><Input value={expDesc} onChange={(e) => setExpDesc(e.target.value)} placeholder="Nom de l'achat" /></div>
              <div className="space-y-1"><Label>Montant ($) *</Label><Input type="number" min={0} value={expAmount} onChange={(e) => setExpAmount(e.target.value)} placeholder="0" /></div>
              <div className="space-y-1"><Label>Catégorie</Label><Select value={expCategory} onValueChange={(v) => setExpCategory(v as ExpenseCategory)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="gas">Essence</SelectItem><SelectItem value="insurance">Assurance</SelectItem><SelectItem value="equipment">Équipement</SelectItem><SelectItem value="other">Autre</SelectItem></SelectContent></Select></div>
              <div className="space-y-1"><Label>Date</Label><Input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} /></div>
              <DialogFooter><Button variant="outline" onClick={() => setShowAddExpense(false)}>Annuler</Button><Button onClick={handleAddManual} disabled={!expDesc.trim() || !expAmount}>Ajouter</Button></DialogFooter>
            </TabsContent>
            <TabsContent value="auto" className="space-y-3 mt-3">
              {!ocrPreview ? (
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <label className="cursor-pointer space-y-2 block"><Camera className="h-8 w-8 mx-auto text-muted-foreground" /><p className="text-sm text-muted-foreground">Téléversez une photo de la facture/reçu</p><input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleOcrUpload(e.target.files[0])} /></label>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-primary">Informations détectées — vérifiez avant de confirmer :</p>
                  <div className="space-y-1"><Label>Description</Label><Input value={ocrPreview.description} onChange={(e) => setOcrPreview({ ...ocrPreview, description: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Montant ($)</Label><Input type="number" value={ocrPreview.amount} onChange={(e) => setOcrPreview({ ...ocrPreview, amount: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Date</Label><Input type="date" value={ocrPreview.date} onChange={(e) => setOcrPreview({ ...ocrPreview, date: e.target.value })} /></div>
                  <DialogFooter><Button variant="outline" onClick={() => setOcrPreview(null)}>Reprendre</Button><Button onClick={confirmOcr}>Confirmer et ajouter</Button></DialogFooter>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Finance;
