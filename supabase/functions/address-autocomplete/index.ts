// ============================================================
// Address Autocomplete — Supabase Edge Function
// ============================================================
// Reads NDJSON address files from Supabase Storage bucket
// "address-autocomplete" and serves autocomplete suggestions.
//
// Storage paths:
//   a.ndjson to z.ndjson, other.ndjson for non-numeric addresses
//   d.ndjson or d-{prefix}.ndjson for numeric addresses (chunked if large)
//   _chunks.json — manifest listing available files per digit
// Bucket: address-autocomplete
//
// GET /functions/v1/address-autocomplete?q=query
// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── Types ───

interface Address {
  s: string;
  a: string;
  v: string;
  cp: string;
  d: number;
  lat: number;
  lng: number;
}

interface Suggestion {
  adresse_complete: string;
  ville: string;
  code_postal: string;
  distance_km: number;
  latitude: number;
  longitude: number;
}

// ─── Constants ───

const BUCKET_NAME = "address-autocomplete";

const DIGIT_FILES = [
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
];

const ALL_CHUNK_PREFIXES = [
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
  "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
  "x",
];

// ─── Module-level memory cache ───
// Files are downloaded and parsed once per warm Edge Function instance.

const cache = new Map<string, Address[]>();

// Cache for digit chunk mappings (which files exist per digit)
let digitChunksCache: Record<string, string[]> | null = null;

function clearCache(): void {
  cache.clear();
  digitChunksCache = null;
}

// ─── CORS helpers ───

function jsonResponse(
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Storage helpers ───

function getStorageBaseUrl(): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL environment variable is not set");
  }
  // NOTE: Do NOT use /public/ here — the bucket is private.
  // Use the generic /object/ endpoint with service role auth.
  return `${supabaseUrl}/storage/v1/object/${BUCKET_NAME}`;
}

/**
 * Load the _chunks.json manifest from storage to discover how
 * numeric files are organized (single file vs. chunked).
 */
async function loadChunksManifest(): Promise<Record<string, string[]> | null> {
  const storageUrl = getStorageBaseUrl();
  const fileUrl = `${storageUrl}/_chunks.json`;
  const serviceRoleKey = Deno.env.get("ADDRESS_AUTOCOMPLETE_SERVICE_ROLE_KEY");

  try {
    const headers: Record<string, string> = {};
    if (serviceRoleKey) {
      headers["Authorization"] = `Bearer ${serviceRoleKey}`;
    }

    const response = await fetch(fileUrl, { headers });
    if (!response.ok) {
      console.warn(
        `[address-autocomplete] _chunks.json not found (${response.status}), assuming single-file digits. Requested path: ${fileUrl}`,
      );
      return null;
    }

    const content = await response.text();
    const manifest = JSON.parse(content) as Record<string, string[]>;
    console.log(
      `[address-autocomplete] Chunks manifest loaded with ${Object.keys(manifest).length} digit entries`,
    );
    return manifest;
  } catch (err) {
    console.error(
      `[address-autocomplete] Error loading _chunks.json from ${fileUrl}:`,
      err,
    );
    return null;
  }
}

/**
 * Get available file names for a given digit.
 * Uses the cached manifest, or falls back to [digit] (single file).
 */
function getDigitChunks(digit: string): string[] {
  if (digitChunksCache && digitChunksCache[digit]) {
    return digitChunksCache[digit];
  }
  return [digit];
}

/**
 * Load addresses from Supabase Storage, with module-level caching.
 * Uses service role key for authenticated access.
 */
async function loadAddresses(fileName: string): Promise<Address[]> {
  if (cache.has(fileName)) return cache.get(fileName)!;

  const storageUrl = getStorageBaseUrl();
  const fileUrl = `${storageUrl}/${fileName}.ndjson`;
  const serviceRoleKey = Deno.env.get("ADDRESS_AUTOCOMPLETE_SERVICE_ROLE_KEY");

  try {
    const headers: Record<string, string> = {};
    if (serviceRoleKey) {
      headers["Authorization"] = `Bearer ${serviceRoleKey}`;
    }

    const response = await fetch(fileUrl, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(
          `[address-autocomplete] Storage file not found, requested path: ${fileUrl}`,
        );
      } else {
        console.error(
          `[address-autocomplete] Storage error for requested path ${fileUrl}: ${response.status} ${response.statusText}`,
        );
      }
      cache.set(fileName, []);
      return [];
    }

    const content = await response.text();
    const lines = content.trim().split("\n").filter(Boolean);
    const addresses: Address[] = [];

    for (const line of lines) {
      try {
        addresses.push(JSON.parse(line));
      } catch {
        /* skip malformed lines */
      }
    }

    cache.set(fileName, addresses);
    console.log(
      `[address-autocomplete] Cache loaded: ${fileName}.ndjson (${addresses.length} addresses)`,
    );
    return addresses;
  } catch (err) {
    console.error(
      `[address-autocomplete] Error loading ${fileUrl}:`,
      err,
    );
    cache.set(fileName, []);
    return [];
  }
}

// ─── Pure search logic ───

function normalizeQuery(q: string): string {
  return q
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[()]/g, "");
}

function getFileName(firstChar: string): string {
  if (!firstChar) return "other";
  const code = firstChar.charCodeAt(0);
  if (code >= 97 && code <= 122) return firstChar;
  if (code >= 48 && code <= 57) return firstChar;
  if (code >= 65 && code <= 90) return String.fromCharCode(code + 32);
  return "other";
}

function getChunkSuffix(key: string): string {
  if (key.length < 2) return "x";
  const ch = key[1];
  const code = ch.charCodeAt(0);
  if (code >= 48 && code <= 57) return ch;   // 0-9
  if (code >= 97 && code <= 122) return ch;  // a-z
  return "x"; // anything else
}

function isLetterChar(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isDigitChar(code: number): boolean {
  return code >= 48 && code <= 57;
}

function toSuggestion(addr: Address): Suggestion {
  return {
    adresse_complete: addr.a,
    ville: addr.v,
    code_postal: addr.cp,
    distance_km: addr.d,
    latitude: addr.lat,
    longitude: addr.lng,
  };
}

// ─── Request handler ───

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Ensure chunks manifest is loaded at cold start ──
    if (digitChunksCache === null) {
      digitChunksCache = await loadChunksManifest();
    }

    const url = new URL(req.url);
    const query = url.searchParams.get("q")?.trim() ?? "";

    if (query.length < 2) {
      return jsonResponse({ suggestions: [] });
    }

    const normalized = normalizeQuery(query);
    const firstChar = query.charAt(0);
    const code = firstChar.charCodeAt(0);
    const isLetter = isLetterChar(code);
    const isDigit = isDigitChar(code);

    let results: Address[] = [];
    const MAX_RESULTS = 10;

    if (isLetter) {
      // ── Letter query: load the letter file ──
      const letterFile = getFileName(firstChar);
      const letterAddresses = await loadAddresses(letterFile);
      results = letterAddresses.filter((a) => a.s.includes(normalized));

      // ── Fall back to numeric chunks progressively ──
      if (results.length < MAX_RESULTS) {
        for (const d of DIGIT_FILES) {
          if (results.length >= MAX_RESULTS) break;
          const chunks = getDigitChunks(d);
          for (const chunk of chunks) {
            if (results.length >= MAX_RESULTS) break;
            const digitAddresses = await loadAddresses(chunk);
            const digitResults = digitAddresses.filter((a) =>
              a.s.includes(normalized)
            );
            results.push(...digitResults);
          }
        }
      }
    } else if (isDigit) {
      // ── Digit query: load only the matching chunk ──
      const chunkSuffix = getChunkSuffix(normalized);
      const chunks = getDigitChunks(firstChar);

      // Prefer the exact chunk (e.g., "1-3" for query "13607")
      const exactChunk = chunks.find(c => c === `${firstChar}-${chunkSuffix}`);
      const singleFile = chunks.find(c => c === firstChar);

      if (exactChunk) {
        const digitAddresses = await loadAddresses(exactChunk);
        results = digitAddresses.filter((a) => a.s.includes(normalized));
      } else if (singleFile) {
        const digitAddresses = await loadAddresses(singleFile);
        results = digitAddresses.filter((a) => a.s.includes(normalized));
      } else if (chunks.length > 0) {
        // Fallback: load all chunks for this digit
        for (const chunk of chunks) {
          if (results.length >= MAX_RESULTS) break;
          const chunkAddresses = await loadAddresses(chunk);
          const chunkResults = chunkAddresses.filter((a) =>
            a.s.includes(normalized)
          );
          results.push(...chunkResults);
        }
      }
    } else {
      // ── Other character: load other.ndjson ──
      const otherAddresses = await loadAddresses("other");
      results = otherAddresses.filter((a) => a.s.includes(normalized));
    }

    const suggestions = results.slice(0, MAX_RESULTS).map(toSuggestion);

    return jsonResponse({ suggestions });
  } catch (err) {
    console.error("[address-autocomplete] Error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: msg }, 500);
  }
});
