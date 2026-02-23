import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { invoices, expenses as mockExpenses } from "@/data/mock";
import { DollarSign, TrendingUp, TrendingDown, BarChart3, Plus, Camera, FileText } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import type { Expense, ExpenseCategory } from "@/types";

type FilterMode = "daily" | "weekly" | "yearly";

const Finance = () => {
  const [filter, setFilter] = useState<FilterMode>("yearly");
  const [expenseList, setExpenseList] = useState<Expense[]>(mockExpenses);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [addMode, setAddMode] = useState<"manual" | "auto">("manual");

  // Manual expense form
  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] = useState<ExpenseCategory>("other");
  const [expDate, setExpDate] = useState(new Date().toISOString().split("T")[0]);

  // Auto (OCR simulation) state
  const [ocrPreview, setOcrPreview] = useState<{ description: string; amount: string; date: string } | null>(null);

  const now = new Date();

  // Filter invoices & expenses based on period
  const filterByDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (filter === "daily") {
      return d.toISOString().split("T")[0] === now.toISOString().split("T")[0];
    }
    if (filter === "weekly") {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return d >= weekAgo && d <= now;
    }
    // yearly: same calendar year
    return d.getFullYear() === now.getFullYear();
  };

  const filteredInvoices = invoices.filter((i) => i.status === "paid" && filterByDate(i.paidAt || i.issuedAt));
  const filteredExpenses = expenseList.filter((e) => filterByDate(e.date));

  const totalProfit = filteredInvoices.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = totalProfit - totalExpenses;

  const chartData = [
    { name: "Revenus", profit: totalProfit, expenses: totalExpenses, net: netProfit },
  ];

  const categoryLabels: Record<string, string> = {
    gas: "Essence",
    insurance: "Assurance",
    equipment: "Équipement",
    other: "Autre",
  };

  const categoryTotals = filteredExpenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

  const handleAddManual = () => {
    if (!expDesc.trim() || !expAmount) return;
    const newExp: Expense = {
      id: `exp-${Date.now()}`,
      category: expCategory,
      amount: Number(expAmount),
      description: expDesc.trim(),
      date: expDate,
      createdAt: new Date().toISOString().split("T")[0],
    };
    setExpenseList((prev) => [...prev, newExp]);
    setShowAddExpense(false);
    setExpDesc("");
    setExpAmount("");
    toast.success("Dépense ajoutée");
  };

  const handleOcrUpload = (file: File) => {
    // Simulate OCR extraction
    setTimeout(() => {
      setOcrPreview({
        description: file.name.replace(/\.[^.]+$/, ""),
        amount: String(Math.floor(Math.random() * 200) + 20),
        date: new Date().toISOString().split("T")[0],
      });
    }, 500);
  };

  const confirmOcr = () => {
    if (!ocrPreview) return;
    const newExp: Expense = {
      id: `exp-${Date.now()}`,
      category: "other",
      amount: Number(ocrPreview.amount),
      description: ocrPreview.description,
      date: ocrPreview.date,
      createdAt: new Date().toISOString().split("T")[0],
    };
    setExpenseList((prev) => [...prev, newExp]);
    setOcrPreview(null);
    setShowAddExpense(false);
    toast.success("Dépense ajoutée (OCR)");
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
          <Button onClick={() => { setShowAddExpense(true); setAddMode("manual"); setOcrPreview(null); }}>
            <Plus className="h-4 w-4 mr-1" /> Dépense
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-emerald-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Profit ({filterLabel[filter]})</p>
                <p className="text-2xl font-bold text-emerald-600">${totalProfit.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center"><TrendingDown className="h-5 w-5 text-red-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Dépenses ({filterLabel[filter]})</p>
                <p className="text-2xl font-bold text-red-600">${totalExpenses.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><DollarSign className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Net Profit ({filterLabel[filter]})</p>
                <p className="text-2xl font-bold">${netProfit.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Aperçu</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="profit" fill="hsl(152, 60%, 40%)" name="Profit" />
                <Bar dataKey="expenses" fill="hsl(0, 72%, 51%)" name="Dépenses" />
                <Bar dataKey="net" fill="hsl(152, 45%, 36%)" name="Net" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Expenses list */}
      <Card>
        <CardHeader><CardTitle>Dépenses</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap mb-3">
            {Object.entries(categoryTotals).map(([cat, total]) => (
              <Badge key={cat} variant="outline">
                {categoryLabels[cat] ?? cat}: ${total}
              </Badge>
            ))}
          </div>
          {filteredExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune dépense pour cette période.</p>
          ) : filteredExpenses.map((exp) => (
            <div key={exp.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium">{exp.description}</p>
                <p className="text-xs text-muted-foreground">{exp.date} · {categoryLabels[exp.category] ?? exp.category}</p>
              </div>
              <p className="font-semibold text-red-600">-${exp.amount}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Add Expense Dialog */}
      <Dialog open={showAddExpense} onOpenChange={setShowAddExpense}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter une dépense</DialogTitle></DialogHeader>
          <Tabs value={addMode} onValueChange={(v) => { setAddMode(v as "manual" | "auto"); setOcrPreview(null); }}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="manual"><FileText className="h-4 w-4 mr-1" /> Manuel</TabsTrigger>
              <TabsTrigger value="auto"><Camera className="h-4 w-4 mr-1" /> Automatique</TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="space-y-3 mt-3">
              <div className="space-y-1">
                <Label>Description *</Label>
                <Input value={expDesc} onChange={(e) => setExpDesc(e.target.value)} placeholder="Nom de l'achat" />
              </div>
              <div className="space-y-1">
                <Label>Montant ($) *</Label>
                <Input type="number" min={0} value={expAmount} onChange={(e) => setExpAmount(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label>Catégorie</Label>
                <Select value={expCategory} onValueChange={(v) => setExpCategory(v as ExpenseCategory)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gas">Essence</SelectItem>
                    <SelectItem value="insurance">Assurance</SelectItem>
                    <SelectItem value="equipment">Équipement</SelectItem>
                    <SelectItem value="other">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddExpense(false)}>Annuler</Button>
                <Button onClick={handleAddManual} disabled={!expDesc.trim() || !expAmount}>Ajouter</Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="auto" className="space-y-3 mt-3">
              {!ocrPreview ? (
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <label className="cursor-pointer space-y-2 block">
                    <Camera className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Téléversez une photo de la facture/reçu</p>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleOcrUpload(e.target.files[0])}
                    />
                  </label>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-primary">Informations détectées — vérifiez avant de confirmer :</p>
                  <div className="space-y-1">
                    <Label>Description</Label>
                    <Input value={ocrPreview.description} onChange={(e) => setOcrPreview({ ...ocrPreview, description: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Montant ($)</Label>
                    <Input type="number" value={ocrPreview.amount} onChange={(e) => setOcrPreview({ ...ocrPreview, amount: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Date</Label>
                    <Input type="date" value={ocrPreview.date} onChange={(e) => setOcrPreview({ ...ocrPreview, date: e.target.value })} />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOcrPreview(null)}>Reprendre</Button>
                    <Button onClick={confirmOcr}>Confirmer et ajouter</Button>
                  </DialogFooter>
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
