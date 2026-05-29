import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useEmployees, useEmployeeJobs, useJobs } from "@/hooks/useSupabaseData";
import { ChevronRight } from "lucide-react";

type FilterMode = "daily" | "weekly" | "yearly";
type GroupMode = "name" | "date";

type EJEntry = { id: string; date: string; amount: number; clientName: string; isAdmin: boolean };

const FinancePaie = () => {
  const { data: employees = [] } = useEmployees();
  const { data: employeeJobs = [] } = useEmployeeJobs();
  const { data: jobs = [] } = useJobs();

  const [filter, setFilter] = useState<FilterMode>("yearly");
  const [groupMode, setGroupMode] = useState<GroupMode>("date");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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

  const adminIds = new Set(employees.filter((e) => e.is_admin).map((e) => e.id));

  const employeePayEntries: EJEntry[] = employeeJobs
    .map((ej) => {
      const job = jobs.find((j) => j.id === ej.job_id);
      if (!job || job.status !== "completed") return null;
      const dateStr = job.scheduled_date ?? job.created_at;
      if (!dateStr) return null;
      const emp = employees.find((e) => e.id === ej.employee_id);
      return {
        id: ej.id,
        date: dateStr,
        amount: Number(ej.calculated_pay ?? 0),
        clientName: emp?.name ?? "Employé",
        isAdmin: adminIds.has(ej.employee_id),
      };
    })
    .filter((x): x is EJEntry => x !== null && x.amount !== 0)
    .filter((x) => filterByDate(x.date));

  const adminRevenue = employeePayEntries.filter((x) => x.isAdmin).reduce((s, x) => s + x.amount, 0);
  const normalLaborCost = employeePayEntries.filter((x) => !x.isAdmin).reduce((s, x) => s + x.amount, 0);

  const handleGroupModeChange = (mode: GroupMode) => {
    setGroupMode(mode);
    setExpandedGroups(new Set());
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const groupedByName = useMemo(() => {
    const groups: Record<string, EJEntry[]> = {};
    for (const entry of employeePayEntries) {
      if (!groups[entry.clientName]) groups[entry.clientName] = [];
      groups[entry.clientName].push(entry);
    }
    for (const name of Object.keys(groups)) {
      groups[name].sort((a, b) => b.date.localeCompare(a.date));
    }
    return Object.entries(groups).sort(([aName], [bName]) => aName.localeCompare(bName));
  }, [employeePayEntries]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, EJEntry[]> = {};
    for (const entry of employeePayEntries) {
      if (!groups[entry.date]) groups[entry.date] = [];
      groups[entry.date].push(entry);
    }
    for (const date of Object.keys(groups)) {
      groups[date].sort((a, b) => a.clientName.localeCompare(b.clientName));
    }
    return Object.entries(groups).sort(([aDate], [bDate]) => bDate.localeCompare(aDate));
  }, [employeePayEntries]);

  const renderEntryRow = (ej: EJEntry) => (
    <div key={ej.id} className="flex items-center justify-between p-2 rounded border text-sm">
      <div>
        <p className="font-medium">
          {ej.clientName} {ej.isAdmin && <span className="text-xs text-muted-foreground">(admin)</span>}
        </p>
        <p className="text-xs text-muted-foreground">{ej.date}</p>
      </div>
      <p className={`font-semibold ${ej.isAdmin ? "text-emerald-600" : "text-red-600"}`}>
        {ej.isAdmin ? "+" : "-"}${ej.amount.toFixed(2)}
      </p>
    </div>
  );

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
      <div className="flex items-center gap-2 mb-2">
        <Button
          variant={groupMode === "name" ? "default" : "outline"}
          size="sm"
          onClick={() => handleGroupModeChange("name")}
        >
          Nom
        </Button>
        <Button
          variant={groupMode === "date" ? "default" : "outline"}
          size="sm"
          onClick={() => handleGroupModeChange("date")}
        >
          Date
        </Button>
      </div>
      <div className="flex gap-2 flex-wrap mb-2">
        <Badge variant="outline" className="text-emerald-700 border-emerald-300">
          Revenu admins : +${adminRevenue.toFixed(2)}
        </Badge>
        <Badge variant="outline" className="text-red-700 border-red-300">
          Dépense employés normaux : -${normalLaborCost.toFixed(2)}
        </Badge>
      </div>
      {employeePayEntries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune paie d'employé pour cette période.</p>
      ) : groupMode === "name" ? (
        groupedByName.map(([name, entries]) => {
          const isExpanded = expandedGroups.has(name);
          const mostRecent = entries[0];
          const remaining = entries.slice(1);
          return (
            <Collapsible key={name} open={isExpanded} onOpenChange={() => toggleGroup(name)}>
              <CollapsibleTrigger
                data-testid={`group-trigger-${name}`}
                className="flex w-full items-center gap-2 rounded border p-2 text-sm hover:bg-accent"
              >
                <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                <span className="font-medium">{name}</span>
                <Badge variant="outline" className="ml-auto text-xs">
                  {entries.length} entrée{entries.length > 1 ? "s" : ""}
                </Badge>
              </CollapsibleTrigger>
              <div className="ml-6 mt-1">{renderEntryRow(mostRecent)}</div>
              {remaining.length > 0 && (
                <CollapsibleContent data-testid={`group-content-${name}`} className="ml-6 space-y-1 mt-1">
                  {remaining.map(renderEntryRow)}
                </CollapsibleContent>
              )}
            </Collapsible>
          );
        })
      ) : (
        groupedByDate.map(([date, entries]) => {
          const isExpanded = expandedGroups.has(date);
          const isMostRecent = date === groupedByDate[0]?.[0];
          const defaultOpen = isMostRecent && !expandedGroups.has(date) && expandedGroups.size === 0;
          const effectiveOpen = isExpanded || defaultOpen;
          return (
            <Collapsible key={date} open={effectiveOpen} onOpenChange={() => toggleGroup(date)}>
              <CollapsibleTrigger
                data-testid={`group-trigger-${date}`}
                className="flex w-full items-center gap-2 rounded border p-2 text-sm hover:bg-accent"
              >
                <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${effectiveOpen ? "rotate-90" : ""}`} />
                <span className="font-medium">{date}</span>
                <Badge variant="outline" className="ml-auto text-xs">
                  {entries.length} entrée{entries.length > 1 ? "s" : ""}
                </Badge>
              </CollapsibleTrigger>
              <CollapsibleContent data-testid={`group-content-${date}`} className="ml-6 space-y-1 mt-1">
                {entries.map(renderEntryRow)}
              </CollapsibleContent>
            </Collapsible>
          );
        })
      )}
    </div>
  );
};

export default FinancePaie;
