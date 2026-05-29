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

export const DIGIT_FILES: string[] = [
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
];

/**
 * Environment variable name for the Supabase service role key used
 * by the address-autocomplete Edge Function to authenticate storage access.
 */
export const SERVICE_ROLE_KEY_ENV_VAR = "ADDRESS_AUTOCOMPLETE_SERVICE_ROLE_KEY";

/**
 * All possible chunk prefixes for digit files.
 * Used when iterating through numeric chunks for letter fallback.
 */
export const ALL_CHUNK_PREFIXES = [
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
  "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
  "x",
] as const;

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

/**
 * Get the chunk suffix for a normalized search key / query.
 * Returns the second character (0-9, a-z) or "x" for other/missing.
 */
export function getChunkSuffix(key: string): string {
  if (key.length < 2) return "x";
  const ch = key[1];
  const code = ch.charCodeAt(0);
  if (code >= 48 && code <= 57) return ch;   // 0-9
  if (code >= 97 && code <= 122) return ch;  // a-z
  return "x"; // anything else
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
 * @param getDigitChunks - Optional dependency: function that returns available chunk file names for a digit.
 *                         If not provided, falls back to loading the single digit file (d.ndjson).
 * @returns Array of suggestions (up to maxResults)
 */
export function searchAddressesCore(
  query: string,
  maxResults: number,
  loadAddresses: (fileName: string) => Address[],
  getDigitChunks?: (digit: string) => string[],
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

    // Fall back to numeric chunks if not enough results
    if (results.length < maxResults) {
      for (const d of DIGIT_FILES) {
        if (results.length >= maxResults) break;
        const chunks = getDigitChunks ? getDigitChunks(d) : [d];
        for (const chunk of chunks) {
          if (results.length >= maxResults) break;
          const digitResults = loadAddresses(chunk).filter((a) =>
            a.s.includes(normalized)
          );
          results.push(...digitResults);
        }
      }
    }
  } else if (isDigit) {
    // For digit queries, load only the matching chunk
    const chunkSuffix = getChunkSuffix(normalized);
    const chunks = getDigitChunks ? getDigitChunks(firstChar) : [firstChar];

    // Find the matching chunk: prefer {digit}-{suffix}, fall back to {digit}
    const exactChunk = chunks.find(c => c === `${firstChar}-${chunkSuffix}`);
    const singleFile = chunks.find(c => c === firstChar);

    if (exactChunk) {
      // Load only the matching chunk
      results = loadAddresses(exactChunk).filter((a) =>
        a.s.includes(normalized)
      );
    } else if (singleFile) {
      // Single file (no chunking)
      results = loadAddresses(singleFile).filter((a) =>
        a.s.includes(normalized)
      );
    } else if (chunks.length > 0) {
      // Chunked but no exact match - load all chunks for this digit
      // (This is a fallback; shouldn't normally happen)
      for (const chunk of chunks) {
        if (results.length >= maxResults) break;
        const chunkResults = loadAddresses(chunk).filter((a) =>
          a.s.includes(normalized)
        );
        results.push(...chunkResults);
      }
    }
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
