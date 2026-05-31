// ============================================================
// Shared hook for Finance filter logic (date range, filtering)
// Extracted to eliminate duplication across 5 Finance pages.
// ============================================================

import { useState, useMemo } from "react";

export type FilterMode = "daily" | "weekly" | "yearly";

export const filterLabels: Record<FilterMode, string> = {
  daily: "Quotidien",
  weekly: "Hebdo",
  yearly: "Annuel",
};

export function getWeekRange(now: Date) {
  const end = new Date(now);
  const start = new Date(now);
  start.setDate(start.getDate() - 6);
  return { start, end };
}

export function filterByDate(dateStr: string, filter: FilterMode, now: Date): boolean {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  if (filter === "daily") return d.toISOString().split("T")[0] === now.toISOString().split("T")[0];
  if (filter === "weekly") {
    const { start, end } = getWeekRange(now);
    return d >= new Date(start.toISOString().split("T")[0]) && d <= end;
  }
  return d.getFullYear() === now.getFullYear();
}

export function formatDateRange(filter: FilterMode, now: Date): string {
  if (filter === "daily") return now.toLocaleDateString("fr-CA");
  if (filter === "weekly") {
    const { start, end } = getWeekRange(now);
    return start.toLocaleDateString("fr-CA") + " au " + end.toLocaleDateString("fr-CA");
  }
  return "1 jan. " + now.getFullYear() + " au " + now.toLocaleDateString("fr-CA");
}

export function useFinanceFilter(initialMode: FilterMode = "yearly") {
  const [filter, setFilter] = useState<FilterMode>(initialMode);
  const now = useMemo(() => new Date(), []);

  return {
    filter,
    setFilter,
    now,
    filterByDate: (dateStr: string) => filterByDate(dateStr, filter, now),
    formatDateRange: () => formatDateRange(filter, now),
    filterLabel: filterLabels[filter],
  };
}
