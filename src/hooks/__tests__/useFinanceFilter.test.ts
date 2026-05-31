// ============================================================
// Tests for useFinanceFilter hook and utility functions
// TDD: Tests written FIRST (RED phase), then implementation.
// ============================================================

import { describe, it, expect } from "vitest";
import { filterByDate, getWeekRange, formatDateRange, filterLabels } from "@/hooks/useFinanceFilter";

describe("filterByDate", () => {
  const now = new Date("2026-05-29T12:00:00");

  it("returns true for today when filter is daily", () => {
    expect(filterByDate("2026-05-29", "daily", now)).toBe(true);
  });

  it("returns false for yesterday when filter is daily", () => {
    expect(filterByDate("2026-05-28", "daily", now)).toBe(false);
  });

  it("returns true for this week when filter is weekly", () => {
    expect(filterByDate("2026-05-27", "weekly", now)).toBe(true);
  });

  it("returns false for last week when filter is weekly", () => {
    expect(filterByDate("2026-05-20", "weekly", now)).toBe(false);
  });

  it("returns true for this year when filter is yearly", () => {
    expect(filterByDate("2026-01-15", "yearly", now)).toBe(true);
  });

  it("returns false for last year when filter is yearly", () => {
    expect(filterByDate("2025-12-31", "yearly", now)).toBe(false);
  });

  it("returns false for invalid date strings", () => {
    expect(filterByDate("", "daily", now)).toBe(false);
    expect(filterByDate(null as unknown as string, "daily", now)).toBe(false);
    expect(filterByDate("not-a-date", "daily", now)).toBe(false);
  });
});

describe("getWeekRange", () => {
  it("returns a 7-day range ending at the given date", () => {
    const now = new Date("2026-05-29T12:00:00");
    const { start, end } = getWeekRange(now);
    expect(end.toISOString().split("T")[0]).toBe("2026-05-29");
    expect(start.toISOString().split("T")[0]).toBe("2026-05-23");
  });
});

describe("formatDateRange", () => {
  const now = new Date("2026-05-29T12:00:00");

  it("returns today date for daily filter", () => {
    const result = formatDateRange("daily", now);
    expect(result).toBe("2026-05-29");
  });

  it("returns week range for weekly filter", () => {
    const result = formatDateRange("weekly", now);
    expect(result).toContain("au");
  });

  it("returns year-to-date for yearly filter", () => {
    const result = formatDateRange("yearly", now);
    expect(result).toContain("1 jan. 2026");
  });
});

describe("filterLabels", () => {
  it("has labels for all filter modes", () => {
    expect(filterLabels.daily).toBe("Quotidien");
    expect(filterLabels.weekly).toBe("Hebdo");
    expect(filterLabels.yearly).toBe("Annuel");
  });
});
