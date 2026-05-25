import { describe, it, expect } from "vitest";
import { cn, formatDateQC, formatDateOnly } from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles tailwind class conflicts by keeping the last one", () => {
    expect(cn("px-4", "px-2")).toBe("px-2");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });
});

describe("formatDateQC", () => {
  it("returns '—' for null input", () => {
    expect(formatDateQC(null)).toBe("—");
  });

  it("returns '—' for undefined input", () => {
    expect(formatDateQC(undefined)).toBe("—");
  });

  it("returns '—' for empty string", () => {
    expect(formatDateQC("")).toBe("—");
  });

  it("formats a valid ISO date string correctly", () => {
    // Note: The formatDateQC function uses two spaces between date and time parts
    expect(formatDateQC("2026-02-18T10:30:00")).toMatch(/2026-02-18\s{2}10:30/);
  });

  it("returns the raw string for an invalid date", () => {
    expect(formatDateQC("not-a-date")).toBe("not-a-date");
  });
});

describe("formatDateOnly", () => {
  it("returns '—' for null input", () => {
    expect(formatDateOnly(null)).toBe("—");
  });

  it("returns '—' for undefined input", () => {
    expect(formatDateOnly(undefined)).toBe("—");
  });

  it("returns '—' for empty string", () => {
    expect(formatDateOnly("")).toBe("—");
  });

  it("formats a YYYY-MM-DD date string correctly", () => {
    expect(formatDateOnly("2026-02-18")).toBe("2026-02-18");
  });

  it("handles a full ISO datetime by extracting the date part", () => {
    const result = formatDateOnly("2026-02-18T10:30:00");
    expect(result).toBe("2026-02-18");
  });

  it("returns '—' for an unparseable date string", () => {
    expect(formatDateOnly("not-a-date")).toBe("—");
  });

  it("pads single-digit months and days", () => {
    expect(formatDateOnly("2026-01-05")).toBe("2026-01-05");
  });

  it("handles a date string without dashes via Date fallback", () => {
    // This exercises the fallback `new Date()` path
    const result = formatDateOnly("2026/02/18");
    // The fallback uses Date.parse which returns a date — just verify it doesn't
    // return "—" and returns a YYYY-MM-DD format
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
