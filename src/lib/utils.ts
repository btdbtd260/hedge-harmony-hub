import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// ── helpers ──

/** Pad a number to at least 2 digits with leading zeros. */
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// ── public API ──

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a date string to Quebec standard: yyyy-MM-dd HH:mm */
export function formatDateQC(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}  ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Format a date string to Quebec standard date-only: YYYY-MM-DD.
 * Returns "—" for null/undefined/invalid inputs.
 *
 * Parses the input manually to avoid timezone shifts:
 *   - "2026-02-18"       → "2026-02-18"  (no TZ shift)
 *   - "2026-02-18T10:30" → "2026-02-18"  (ISO datetime)
 */
export function formatDateOnly(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";

  // Try to extract YYYY-MM-DD from the start of the string (covers ISO and plain dates)
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, m, d] = match;
    return `${y}-${m}-${d}`;
  }

  // Fallback: try to parse as a date
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return "—";

  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${parsed.getDate()}`;
}

/**
 * Format a number as CAD currency.
 * Returns "—" for null/undefined/NaN values.
 */
export function formatCurrency(
  value: number | null | undefined,
  options?: { decimals?: number; symbol?: string },
): string {
  if (value === null || value === undefined || isNaN(value)) return "—";
  const { decimals = 2, symbol = "$" } = options ?? {};
  return `${symbol}${value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;
}

/**
 * Format a number with optional suffix (e.g. "1.2k").
 */
export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "—";
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}
