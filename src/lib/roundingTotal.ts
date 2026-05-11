/**
 * Applies optional floor-rounding to an estimation total.
 *
 * Behaviour:
 * - If `enabled` is false → returns `rawTotal` unchanged.
 * - If `multiple` is missing, ≤ 0, or not finite → returns `rawTotal` unchanged
 *   (defensive: invalid config must not silently zero out totals).
 * - Otherwise → returns the largest multiple of `multiple` that is ≤ `rawTotal`.
 *
 * Examples (multiple = 5):
 *   103 → 100
 *   107 → 105
 *   109 → 105
 */
export function applyTotalRounding(
  rawTotal: number,
  enabled: boolean,
  multiple: number,
): number {
  if (!enabled) return rawTotal;
  if (!Number.isFinite(multiple) || multiple <= 0) return rawTotal;
  return Math.floor(rawTotal / multiple) * multiple;
}
