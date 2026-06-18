import { useState } from "react";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { useInvoices, useExpenses, useCustomers, useEmployees, useEmployeeJobs, useJobs } from "@/hooks/useSupabaseData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Calendar } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { PageHeader } from "@/components/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const chartData = [
    { name: "Profit", montant: totalProfit },
    { name: "Dépenses", montant: totalExpenses },
    { name: "Net", montant: netProfit },
  ];

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
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="Aperçu financier"
        description={`Période : ${formatDateRange()}`}
        actions={
          <Select value={filter} onValueChange={(v) => setFilter(v as FilterMode)}>
            <SelectTrigger className="w-36">
              <Calendar className="h-4 w-4 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Quotidien</SelectItem>
              <SelectItem value="weekly">Hebdo</SelectItem>
              <SelectItem value="yearly">Annuel</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title={`Profit (${filterLabel[filter]})`}
          value={`$${totalProfit.toFixed(2)}`}
          icon={TrendingUp}
          accent="green"
        />
        <StatCard
          title={`Dépenses (${filterLabel[filter]})`}
          value={`$${totalExpenses.toFixed(2)}`}
          icon={TrendingDown}
          accent="red"
        />
        <StatCard
          title={`Net (${filterLabel[filter]})`}
          value={`$${netProfit.toFixed(2)}`}
          icon={DollarSign}
          accent={netProfit >= 0 ? "green" : "red"}
        />
      </div>

      <CollapsibleCard title="Aperçu">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  borderRadius: "var(--radius)",
                  border: "1px solid hsl(var(--border))",
                  backgroundColor: "hsl(var(--card))",
                }}
              />
              <Bar dataKey="montant" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CollapsibleCard>
    </div>
  );
};

export default FinanceApercu;
