import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { invoices, expenses } from "@/data/mock";
import { DollarSign, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type FilterMode = "daily" | "weekly" | "yearly";

const Finance = () => {
  const [filter, setFilter] = useState<FilterMode>("yearly");

  const totalProfit = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = totalProfit - totalExpenses;

  // Chart data (simplified for prototype)
  const chartData = [
    { name: "Revenus", profit: totalProfit, expenses: totalExpenses, net: netProfit },
  ];

  const categoryTotals = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

  const categoryLabels: Record<string, string> = {
    gas: "Essence",
    insurance: "Assurance",
    equipment: "Équipement",
    other: "Autre",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Finance</h1>
          <p className="text-muted-foreground">Suivi des revenus et dépenses</p>
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as FilterMode)}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Quotidien</SelectItem>
            <SelectItem value="weekly">Hebdo</SelectItem>
            <SelectItem value="yearly">Annuel</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-emerald-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Profit</p>
                <p className="text-2xl font-bold text-emerald-600">${totalProfit}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center"><TrendingDown className="h-5 w-5 text-red-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Dépenses</p>
                <p className="text-2xl font-bold text-red-600">${totalExpenses}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><DollarSign className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Net Profit</p>
                <p className="text-2xl font-bold">${netProfit}</p>
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
          {/* Category summary */}
          <div className="flex gap-2 flex-wrap mb-3">
            {Object.entries(categoryTotals).map(([cat, total]) => (
              <Badge key={cat} variant="outline">
                {categoryLabels[cat] ?? cat}: ${total}
              </Badge>
            ))}
          </div>
          {expenses.map((exp) => (
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
    </div>
  );
};

export default Finance;
