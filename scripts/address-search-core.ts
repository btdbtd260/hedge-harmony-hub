// ============================================================
// Core address search logic — pure functions, no IO
// ============================================================

export interface Address {
  s: string;
  a: string;
  v: string;
  cp: string;
  d: number;
  lat: number;
  lng: number;
}

export interface Suggestion {
  adresse_complete: string;
  ville: string;
  code_postal: string;
  distance_km: number;
  latitude: number;
  longitude: number;
}

export const ALL_STORAGE_FILES = [
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
  "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
  "other",
] as const;

export type StorageFileName = (typeof ALL_STORAGE_FILES)[number];

export const LETTER_FILES: StorageFileName[] = [
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
  "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
];

export const DIGIT_FILES: StorageFileName[] = [
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
];

/**
 * Normalize a query for fuzzy search:
 * - lowercase
 * - strip accents (NFD + combining marks)
 * - remove parentheses
 */
export function normalizeQuery(q: string): string {
  return q
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[()]/g, "");
}

/**
 * Determine the storage file prefix from the first character of the raw query.
 * Returns the file name (without .ndjson) or "other".
 */
export function getFileName(firstChar: string): string {
  if (!firstChar) return "other";
  const code = firstChar.charCodeAt(0);
  if (code >= 97 && code <= 122) return firstChar;
  if (code >= 48 && code <= 57) return firstChar;
  if (code >= 65 && code <= 90) return String.fromCharCode(code + 32);
  return "other";
}

export function isLetterChar(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

export function isDigitChar(code: number): boolean {
  return code >= 48 && code <= 57;
}

export function toSuggestion(addr: Address): Suggestion {
  return {
    adresse_complete: addr.a,
    ville: addr.v,
    code_postal: addr.cp,
    distance_km: addr.d,
    latitude: addr.lat,
    longitude: addr.lng,
  };
}

/**
 * Core search algorithm (no IO).
 *
 * @param query - Raw user query
 * @param maxResults - Maximum number of suggestions to return
 * @param loadAddresses - Dependency: function that returns Address[] for a given file name
 * @returns Array of suggestions (up to maxResults)
 */
export function searchAddressesCore(
  query: string,
  maxResults: number,
  loadAddresses: (fileName: string) => Address[],
): Suggestion[] {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const normalized = normalizeQuery(trimmed);
  const firstChar = trimmed.charAt(0);
  const code = firstChar.charCodeAt(0);
  const isLetter = isLetterChar(code);
  const isDigit = isDigitChar(code);

  let results: Address[] = [];

  if (isLetter) {
    const letterFile = getFileName(firstChar);
    results = loadAddresses(letterFile).filter((a) =>
      a.s.includes(normalized)
    );

    if (results.length < maxResults) {
      for (const d of DIGIT_FILES) {
        if (results.length >= maxResults) break;
        const digitResults = loadAddresses(d).filter((a) =>
          a.s.includes(normalized)
        );
        results.push(...digitResults);
      }
    }
  } else if (isDigit) {
    results = loadAddresses(firstChar).filter((a) =>
      a.s.includes(normalized)
    );
  } else {
    results = loadAddresses("other").filter((a) =>
      a.s.includes(normalized)
    );
  }

  return results.slice(0, maxResults).map(toSuggestion);
}

/**
 * Validate that a value looks like a Suggestion.
 * Useful for response-shape assertions.
 */
export function isValidSuggestion(value: unknown): value is Suggestion {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.adresse_complete === "string" &&
    typeof s.ville === "string" &&
    typeof s.code_postal === "string" &&
    typeof s.distance_km === "number" &&
    typeof s.latitude === "number" &&
    typeof s.longitude === "number"
  );
}
