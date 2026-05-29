import { useState } from "react";
import { useExpenses } from "@/hooks/useSupabaseData";
import { Badge } from "@/components/ui/badge";

type FilterMode = "daily" | "weekly" | "yearly";

const categoryLabels: Record<string, string> = { gas: "Essence", insurance: "Assurance", equipment: "Équipement", other: "Autre" };

const FinanceDepenses = () => {
  const { data: expenseList = [] } = useExpenses();
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

  const filteredExpenses = expenseList.filter((e) => filterByDate(e.date));
  const categoryTotals = filteredExpenses.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + e.amount; return acc; }, {} as Record<string, number>);

  const filterLabel: Record<FilterMode, string> = { daily: "Quotidien", weekly: "Hebdo", yearly: "Annuel" };

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
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          {Object.entries(categoryTotals).map(([cat, total]) => (
            <Badge key={cat} variant="outline">{categoryLabels[cat] ?? cat}: ${total}</Badge>
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
      </div>
    </div>
  );
};

export default FinanceDepenses;
