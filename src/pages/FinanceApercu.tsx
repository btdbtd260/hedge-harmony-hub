import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useInvoices, useExpenses, useCustomers, useEmployees, useEmployeeJobs, useJobs } from "@/hooks/useSupabaseData";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";

type FilterMode = "daily" | "weekly" | "yearly";

const FinanceApercu = () => {
  const { data: invoices = [] } = useInvoices();
  const { data: expenseList = [] } = useExpenses();
  const { data: employees = [] } = useEmployees();
  const { data: employeeJobs = [] } = useEmployeeJobs();
  const { data: jobs = [] } = useJobs();
  const [filter, setFilter] = useState<FilterMode>("yearly");

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

  const adminIds = new Set(employees.filter((e) => e.is_admin).map((e) => e.id));
  const employeePayEntries = employeeJobs
    .map((ej) => {
      const job = jobs.find((j) => j.id === ej.job_id);
      if (!job || job.status !== "completed") return null;
      const dateStr = job.scheduled_date ?? job.created_at;
      if (!dateStr) return null;
      return {
        amount: Number(ej.calculated_pay ?? 0),
        isAdmin: adminIds.has(ej.employee_id),
        date: dateStr,
      };
    })
    .filter((x): x is { amount: number; isAdmin: boolean; date: string } => x !== null && x.amount !== 0)
    .filter((x) => filterByDate(x.date));

  const adminRevenue = employeePayEntries.filter((x) => x.isAdmin).reduce((s, x) => s + x.amount, 0);
  const normalLaborCost = employeePayEntries.filter((x) => !x.isAdmin).reduce((s, x) => s + x.amount, 0);
  const totalProfit = adminRevenue;
  const filteredExpenses = expenseList.filter((e) => filterByDate(e.date));
  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0) + normalLaborCost;
  const netProfit = totalProfit - totalExpenses;
  const chartData = [{ name: "Revenus", profit: totalProfit, expenses: totalExpenses, net: netProfit }];

  const filterLabel: Record<FilterMode, string> = { daily: "Quotidien", weekly: "Hebdo", yearly: "Annuel" };

  const formatDateRange = () => {
    if (filter === "daily") return now.toLocaleDateString("fr-CA");
    if (filter === "weekly") {
      const { start, end } = getWeekRange();
      return `${start.toLocaleDateString("fr-CA")} au ${end.toLocaleDateString("fr-CA")}`;
    }
    return `1 jan. ${now.getFullYear()} au ${now.toLocaleDateString("fr-CA")}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterMode)}
          className="flex h-10 w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="daily">Quotidien</option>
          <option value="weekly">Hebdo</option>
          <option value="yearly">Annuel</option>
        </select>
        <span className="text-sm text-muted-foreground">Période : {filterLabel[filter]}</span>
      </div>

      <p className="text-sm text-muted-foreground">Période : {formatDateRange()}</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-emerald-600" /></div><div><p className="text-sm text-muted-foreground">Profit ({filterLabel[filter]})</p><p className="text-2xl font-bold text-emerald-600">${totalProfit.toFixed(2)}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center"><TrendingDown className="h-5 w-5 text-red-600" /></div><div><p className="text-sm text-muted-foreground">Dépenses ({filterLabel[filter]})</p><p className="text-2xl font-bold text-red-600">${totalExpenses.toFixed(2)}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><DollarSign className="h-5 w-5 text-primary" /></div><div><p className="text-sm text-muted-foreground">Net Profit ({filterLabel[filter]})</p><p className="text-2xl font-bold">${netProfit.toFixed(2)}</p></div></div></CardContent></Card>
      </div>

      <CollapsibleCard title="Aperçu">
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
      </CollapsibleCard>
    </div>
  );
};

export default FinanceApercu;
