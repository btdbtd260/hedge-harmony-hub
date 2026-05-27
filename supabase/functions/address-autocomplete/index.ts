// ============================================================
// Address Autocomplete — Supabase Edge Function
// ============================================================
// Reads NDJSON address files from Supabase Storage bucket
// "address-autocomplete" and serves autocomplete suggestions.
//
// Storage paths: 0.ndjson to 9.ndjson, a.ndjson to z.ndjson, other.ndjson
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

// ─── Module-level memory cache ───
// Files are downloaded and parsed once per warm Edge Function instance.

const cache = new Map<string, Address[]>();

function clearCache(): void {
  cache.clear();
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
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}`;
}

/**
 * Load addresses from Supabase Storage, with module-level caching.
 * Uses service role key for authenticated access.
 */
async function loadAddresses(fileName: string): Promise<Address[]> {
  if (cache.has(fileName)) return cache.get(fileName)!;

  const storageUrl = getStorageBaseUrl();
  const fileUrl = `${storageUrl}/${fileName}.ndjson`;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  try {
    const headers: Record<string, string> = {};
    if (serviceRoleKey) {
      headers["Authorization"] = `Bearer ${serviceRoleKey}`;
    }

    const response = await fetch(fileUrl, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(
          `[address-autocomplete] Storage file not found: ${fileName}.ndjson`,
        );
      } else {
        console.error(
          `[address-autocomplete] Storage error for ${fileName}.ndjson: ${response.status} ${response.statusText}`,
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
      `[address-autocomplete] Error loading ${fileName}.ndjson:`,
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

    if (isLetter) {
      const letterFile = getFileName(firstChar);
      const letterAddresses = await loadAddresses(letterFile);
      results = letterAddresses.filter((a) => a.s.includes(normalized));

      if (results.length < 10) {
        for (const d of DIGIT_FILES) {
          if (results.length >= 10) break;
          const digitAddresses = await loadAddresses(d);
          const digitResults = digitAddresses.filter((a) =>
            a.s.includes(normalized)
          );
          results.push(...digitResults);
        }
      }
    } else if (isDigit) {
      const digitAddresses = await loadAddresses(firstChar);
      results = digitAddresses.filter((a) => a.s.includes(normalized));
    } else {
      const otherAddresses = await loadAddresses("other");
      results = otherAddresses.filter((a) => a.s.includes(normalized));
    }

    const suggestions = results.slice(0, 10).map(toSuggestion);

    return jsonResponse({ suggestions });
  } catch (err) {
    console.error("[address-autocomplete] Error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: msg }, 500);
  }
});
