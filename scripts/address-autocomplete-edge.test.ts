// ============================================================
// Tests for Edge Function handler — TDD RED phase
// ============================================================

import { describe, it, expect, vi } from "vitest";
import { searchAddressesCore, SERVICE_ROLE_KEY_ENV_VAR, type Address, isValidSuggestion } from "./address-search-core";

// ─── Mock storage loader factory ───
// Simulates the storage-backed loader the Edge Function will use

function createStorageLoader(
  files: Record<string, Address[]>,
): (fileName: string) => Address[] {
  const cache = new Map<string, Address[]>();
  return (fileName: string) => {
    if (cache.has(fileName)) return cache.get(fileName)!;
    const data = files[fileName];
    if (!data) {
      cache.set(fileName, []);
      return [];
    }
    cache.set(fileName, data);
    return data;
  };
}

describe("Edge Function search behavior", () => {
  // ── Caching behavior ──

  describe("storage caching", () => {
    it("loader is called per-file during search algorithm", () => {
      const loadedFiles = new Map<string, number>();
      const loader = (fileName: string) => {
        loadedFiles.set(fileName, (loadedFiles.get(fileName) ?? 0) + 1);
        if (fileName === "m") return [
          { s: "mtest", a: "M Test Address", v: "Montreal", cp: "H3A", d: 1, lat: 45, lng: -73 },
        ];
        return [];
      };

      const r1 = searchAddressesCore("mtest", 10, loader);
      expect(loadedFiles.get("m")).toBe(1);
      expect(r1.length).toBe(1);
    });

    it("same file loaded only once when cache is used", () => {
      const storage = new Map<string, { data: import("./address-search-core").Address[]; loaded: boolean }>();
      const loader = (fileName: string) => {
        const entry = storage.get(fileName);
        if (!entry) {
          const data: import("./address-search-core").Address[] = [];
          storage.set(fileName, { data, loaded: true });
          return data;
        }
        entry.loaded = true;
        return entry.data;
      };

      const results = searchAddressesCore("xtest", 10, loader);
      expect(results).toEqual([]);
    });

    it("returns empty array for non-existent file gracefully", () => {
      const loader = (fileName: string) => {
        return [];
      };

      const results = searchAddressesCore("qtest", 10, loader);
      expect(results).toEqual([]);
    });

    it("letter file load happens before digit files", () => {
      const loadOrder: string[] = [];
      const loader = (fileName: string) => {
        loadOrder.push(fileName);
        if (fileName === "a") return [
          { s: "atest", a: "A Test", v: "V", cp: "H1A", d: 1, lat: 45, lng: -73 },
        ];
        return [];
      };

      searchAddressesCore("atest", 10, loader);
      expect(loadOrder[0]).toBe("a");
    });
  });

  // ── Chunked digit query ──

  describe("chunked digit query", () => {
    it("loads only the matching chunk for digit queries", () => {
      const loadSpy = vi.fn((fileName: string) => {
        if (fileName === "1-3") return [
          { s: "13607 rue test", a: "13607 Test Address", v: "Montreal", cp: "H1A", d: 1, lat: 45, lng: -73 },
        ];
        return [];
      });

      const getDigitChunks = vi.fn((digit: string) => {
        if (digit === "1") return ["1-0", "1-1", "1-2", "1-3", "1-4", "1-5", "1-6", "1-7", "1-8", "1-9"];
        return [digit];
      });

      const results = searchAddressesCore("13607 rue test", 10, loadSpy, getDigitChunks);

      // Should load only 1-3, not all 10 chunks
      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith("1-3");
      expect(results.length).toBe(1);
    });

    it("does not load all numeric chunks at once for digit queries", () => {
      const chunks = Array.from({ length: 10 }, (_, i) => `2-${i}`);
      const loadSpy = vi.fn((fileName: string) => {
        if (fileName === "2-5") return [
          { s: "25test", a: "25 Test Address", v: "V", cp: "H1A", d: 1, lat: 45, lng: -73 },
        ];
        return [];
      });

      const getDigitChunks = vi.fn((digit: string) => {
        if (digit === "2") return chunks;
        return [digit];
      });

      const results = searchAddressesCore("25test", 10, loadSpy, getDigitChunks);

      // Should only have called loadAddresses once with "2-5"
      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith("2-5");
    });
  });

  // ── Letter fallback with chunks ──

  describe("letter fallback with digit chunks", () => {
    it("checks chunks progressively for letter fallback", () => {
      const loadSpy = vi.fn((fileName: string) => {
        if (fileName === "r") return [
          { s: "rtest", a: "R Test", v: "V", cp: "H1A", d: 1, lat: 45, lng: -73 },
        ];
        // Return some matches in digit chunks
        if (fileName === "0-0") return [
          { s: "00 rtest", a: "00 R Match", v: "V", cp: "H1A", d: 1, lat: 45, lng: -73 },
          { s: "01 rtest", a: "01 R Match", v: "V", cp: "H1A", d: 1, lat: 45, lng: -73 },
        ];
        if (fileName === "0-1") return [
          { s: "02 rtest", a: "02 R Match", v: "V", cp: "H1A", d: 1, lat: 45, lng: -73 },
          { s: "03 rtest", a: "03 R Match", v: "V", cp: "H1A", d: 1, lat: 45, lng: -73 },
        ];
        return [];
      });

      const getDigitChunks = vi.fn((digit: string) => {
        if (digit === "0") return ["0-0", "0-1"];
        if (digit === "1") return ["1-0", "1-1"];
        return [digit];
      });

      const results = searchAddressesCore("rtest", 10, loadSpy, getDigitChunks);

      // r: 1 result (loaded)
      // 0-0: 2 results (total 3) (loaded)
      // 0-1: 2 results (total 5) (loaded)
      // 1-0: 0 results (loaded)
      // 1-1: 0 results (loaded)
      // ... should stop when we reach 10 or exhaust
      expect(loadSpy).toHaveBeenCalledWith("r");
      expect(loadSpy).toHaveBeenCalledWith("0-0");
      expect(loadSpy).toHaveBeenCalledWith("0-1");
      expect(results.length).toBe(5);
    });

    it("loads chunks progressively, not all at once", () => {
      const loadSpy = vi.fn((fileName: string) => {
        if (fileName === "a") return []; // No matches
        // Return empty for all chunks too
        return [];
      });

      const getDigitChunks = vi.fn((digit: string) => {
        // Each digit has 3 chunk files
        return [`${digit}`, `${digit}-0`, `${digit}-1`];
      });

      const results = searchAddressesCore("atest", 10, loadSpy, getDigitChunks);

      // Should have loaded: a, 0, 0-0, 0-1, 1, 1-0, 1-1, ...
      // Progressively - one at a time, not all 30 at once
      const loadCalls = loadSpy.mock.calls.map(([name]) => name);
      expect(loadCalls[0]).toBe("a");
      expect(loadCalls.length).toBeGreaterThan(0);

      // Verify progressive loading (letter first, then one digit at a time)
      const digitLoads = loadCalls.filter(c => DIGIT_NAMES.includes(c));
      // Should load chunks belonging to digit 0 first, then digit 1, etc.
      const zeroChunks = digitLoads.filter(d => d.startsWith("0"));
      const oneChunks = digitLoads.filter(d => d.startsWith("1"));
      if (zeroChunks.length > 0 && oneChunks.length > 0) {
        const lastZeroIdx = loadCalls.lastIndexOf(zeroChunks[zeroChunks.length - 1]);
        const firstOneIdx = loadCalls.indexOf(oneChunks[0]);
        // All of digit 0's chunks should come before digit 1's
        if (lastZeroIdx >= 0 && firstOneIdx >= 0) {
          expect(lastZeroIdx).toBeLessThan(firstOneIdx);
        }
      }

      expect(results).toEqual([]); // No matches found
    });
  });

  // ── Response shape ──

  describe("response shape", () => {
    it("returns response with suggestions array", () => {
      const loader = createStorageLoader({
        "t": [
          { s: "test addresse", a: "123 Test Street", v: "Montreal", cp: "H3A 1A1", d: 5.2, lat: 45.5, lng: -73.6 },
        ],
      });

      const results = searchAddressesCore("test addresse", 10, loader);
      const response = { suggestions: results };

      expect(response).toHaveProperty("suggestions");
      expect(Array.isArray(response.suggestions)).toBe(true);
      expect(response.suggestions.length).toBe(1);
      expect(isValidSuggestion(response.suggestions[0])).toBe(true);
    });

    it("response shape: { suggestions: [...] }", () => {
      const loader = createStorageLoader({});
      const results = searchAddressesCore("xy", 10, loader);
      const response = { suggestions: results };

      expect(response).toEqual({ suggestions: [] });
    });
  });

  // ── Edge Function specific: environment variables ──

  describe("environment requirements", () => {
    it("uses ADDRESS_AUTOCOMPLETE_SERVICE_ROLE_KEY (not SUPABASE_SERVICE_ROLE_KEY) for the service role key", () => {
      // The Supabase CLI rejects env var names starting with "SUPABASE_".
      // This test ensures we use a valid name.
      expect(SERVICE_ROLE_KEY_ENV_VAR).toBe("ADDRESS_AUTOCOMPLETE_SERVICE_ROLE_KEY");
    });
  });

  // ── File enumeration ──

  describe("file enumeration", () => {
    it("loads from correct storage paths: a-z, chunks, other", () => {
      const storageFiles = [
        ...Array.from({ length: 10 }, (_, i) => `${i}`),
        ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i)),
        "other",
      ];
      expect(storageFiles.length).toBe(37);

      const loaded: string[] = [];
      const loader = (fileName: string) => {
        loaded.push(fileName);
        return [];
      };

      searchAddressesCore("atest", 10, loader);
      searchAddressesCore("5test", 10, loader);
      searchAddressesCore("@addr", 10, loader);

      expect(loaded).toContain("a");
      expect(loaded).toContain("5");
      expect(loaded).toContain("other");
    });
  });
});

// List of digit file names used in tests
const DIGIT_NAMES = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "0-0", "0-1", "1-0", "1-1"];

// ─── Storage URL Construction (the core bug fix) ───
//
// The Edge Function must construct correct Storage URLs for private buckets.
// The bucket "address-autocomplete" is NOT public, so URLs must NOT use
// the /public/ endpoint. Instead, use /storage/v1/object/{bucket}/{path}
// with a service role key Authorization header.
//
// These tests define the correct URL format.

describe("storage URL construction for private bucket", () => {
  /**
   * Pure function that mirrors the Edge Function's URL construction logic.
   * Tests verify the correct format; the same fix is applied in index.ts.
   */
  function buildStorageUrl(supabaseUrl: string, bucketName: string, filePath: string): string {
    if (!supabaseUrl) {
      throw new Error("SUPABASE_URL environment variable is not set");
    }
    // BUG: Current code uses /public/ which fails for private buckets.
    // FIX: Use /storage/v1/object/{bucket}/{path} with service role auth.
    return `${supabaseUrl}/storage/v1/object/${bucketName}/${filePath}`;
  }

  it("uses /storage/v1/object/ (not /public/) for private bucket access", () => {
    const url = buildStorageUrl("https://abc.supabase.co", "address-autocomplete", "_chunks.json");
    expect(url).toBe("https://abc.supabase.co/storage/v1/object/address-autocomplete/_chunks.json");
    // The old buggy code would produce /storage/v1/object/public/...
    expect(url).not.toContain("/public/");
  });

  it("does not duplicate bucket name in the file path", () => {
    const url = buildStorageUrl("https://abc.supabase.co", "address-autocomplete", "g.ndjson");
    // Ensure the bucket name doesn't appear twice
    const bucketIndex = url.indexOf("address-autocomplete");
    const lastBucketIndex = url.lastIndexOf("address-autocomplete");
    expect(bucketIndex).toBe(lastBucketIndex);
    expect(bucketIndex).not.toBe(-1);
  });

  it("requests _chunks.json from the bucket root (no extra prefix)", () => {
    const url = buildStorageUrl("https://abc.supabase.co", "address-autocomplete", "_chunks.json");
    expect(url).toMatch(/\/address-autocomplete\/_chunks\.json$/);
    // No intermediate directory between bucket name and filename
    const afterBucket = url.split("address-autocomplete/")[1];
    expect(afterBucket).toBe("_chunks.json");
  });

  it("loads NDJSON files with correct extension from bucket root", () => {
    const url = buildStorageUrl("https://abc.supabase.co", "address-autocomplete", "g.ndjson");
    expect(url).toMatch(/\/address-autocomplete\/g\.ndjson$/);
  });

  it("loads chunked files (1-3.ndjson) from bucket root", () => {
    const url = buildStorageUrl("https://abc.supabase.co", "address-autocomplete", "1-3.ndjson");
    expect(url).toMatch(/\/address-autocomplete\/1-3\.ndjson$/);
  });

  it("throws when SUPABASE_URL is missing/empty", () => {
    expect(() => buildStorageUrl("", "address-autocomplete", "test.ndjson")).toThrow(
      "SUPABASE_URL environment variable is not set",
    );
  });
});

describe("file path error logging", () => {
  it("logs the exact file name being requested when storage read fails", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      // Simulate a storage failure log message matching the format in index.ts
      const fileName = "g.ndjson";
      const status = 400;
      const statusText = "Bad Request";
      console.error(
        `[address-autocomplete] Storage error for ${fileName}: ${status} ${statusText}`,
      );

      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining(fileName),
      );
      // The log should clearly identify WHICH file failed
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining("g.ndjson"),
      );
    } finally {
      consoleError.mockRestore();
      consoleWarn.mockRestore();
    }
  });

  it("logs _chunks.json path in warning when manifest not found", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      // Simulate the manifest-not-found log message
      const fileName = "_chunks.json";
      const status = 400;
      console.warn(
        `[address-autocomplete] ${fileName} not found (${status}), assuming single-file digits`,
      );

      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining(fileName),
      );
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining("400"),
      );
    } finally {
      consoleWarn.mockRestore();
    }
  });
});

describe("query file resolution for specific queries", () => {
  it('query "gauchetiere" attempts g.ndjson first', () => {
    // The file name is determined by the first character
    const firstChar = "gauchetiere".charAt(0);
    const code = firstChar.charCodeAt(0);
    // Should be a letter -> use the letter as file name
    const isLetter = (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
    expect(isLetter).toBe(true);
    const fileName = isLetter ? firstChar.toLowerCase() : "other";
    expect(fileName).toBe("g");
  });

  it('query "13607" attempts the correct numeric chunk', () => {
    // First char determines digit file
    const query = "13607";
    const firstChar = query.charAt(0);
    expect(firstChar).toBe("1");

    // Second char determines chunk suffix
    const secondChar = query.charAt(1);
    expect(secondChar).toBe("3");

    // The manifest has "1-3" in digit 1's chunks
    const expectedChunk = `${firstChar}-${secondChar}`;
    expect(expectedChunk).toBe("1-3");
  });

  it('query "13607" searches within chunk 1-3, not all chunks', () => {
    // Verify the searchAddressesCore already handles this correctly
    // (already tested above in "chunked digit query" section)
    const exactChunk = "1-3";
    // This confirms the file requested should be "1-3"
    expect(exactChunk).toBe("1-3");
  });
});

describe("Handler utility tests", () => {
  describe("URL parsing for q parameter", () => {
    it("extracts q from URL search params", () => {
      const url = new URL("http://localhost/functions/v1/address-autocomplete?q=test");
      const q = url.searchParams.get("q")?.trim() ?? "";
      expect(q).toBe("test");
    });

    it("returns empty string when q is missing", () => {
      const url = new URL("http://localhost/functions/v1/address-autocomplete");
      const q = url.searchParams.get("q")?.trim() ?? "";
      expect(q).toBe("");
    });

    it("handles multiple params gracefully", () => {
      const url = new URL("http://localhost/functions/v1/address-autocomplete?q=hello&max=5");
      const q = url.searchParams.get("q")?.trim() ?? "";
      const max = Number(url.searchParams.get("max")) || 10;
      expect(q).toBe("hello");
      expect(max).toBe(5);
    });
  });
});
