/**
 * Phone number formatting utilities (North American — Quebec/Canada).
 *
 * Rules:
 *  - Strip all non-digits, then drop a leading "1" country code (e.g. "15146708976").
 *  - 10 digits  → "514-708-8976"
 *  -  7 digits  → "708-8976" (local format, fallback)
 *  - any other length → return digits as-is (caller's existing validation handles it).
 *  - empty / null → "".
 */

export function formatPhone(input: string | null | undefined): string {
  if (!input) return "";
  let digits = String(input).replace(/\D+/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return digits;
}

/**
 * Live formatter for controlled <input> fields.
 * Formats as the user types, keeping intermediate states usable
 * (no dashes appended until enough digits are present).
 *
 *  ""        → ""
 *  "5"       → "5"
 *  "514"     → "514"
 *  "5147"    → "514-7"
 *  "514670"  → "514-670"
 *  "5146708" → "514-670-8"
 *  "5146708976" → "514-670-8976"
 */
export function formatPhoneLive(input: string): string {
  if (!input) return "";
  let digits = input.replace(/\D+/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  digits = digits.slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}
