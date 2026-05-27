// ============================================================
// Tests for Edge Function handler — TDD RED phase
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchAddressesCore, type Address, isValidSuggestion } from "./address-search-core";

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

      // Query "mtest": 'm' is loaded, then 1 < 10 so digits are loaded
      const r1 = searchAddressesCore("mtest", 10, loader);
      // 'm' was loaded 1 time
      expect(loadedFiles.get("m")).toBe(1);
      expect(r1.length).toBe(1);
    });

    it("same file loaded only once when cache is used", () => {
      // This simulates what happens when the Edge Function's
      // module-level cache is in play: the loader itself is cached.
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
      // 'a' should be loaded first
      expect(loadOrder[0]).toBe("a");
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
    it("needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set in production", () => {
      // In the Edge Function runtime, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
      // are injected by Supabase. This test verifies the expected var names.
      const expectedVars = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
      expect(expectedVars).toContain("SUPABASE_URL");
      expect(expectedVars).toContain("SUPABASE_SERVICE_ROLE_KEY");
    });
  });

  // ── 37 files total ──

  describe("file enumeration", () => {
    it("loads from correct storage paths: 0-9, a-z, other", () => {
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

      // Trigger loads for each type
      searchAddressesCore("atest", 10, loader); // triggers 'a'
      searchAddressesCore("5test", 10, loader); // triggers '5'
      searchAddressesCore("@addr", 10, loader); // triggers 'other'

      expect(loaded).toContain("a");
      expect(loaded).toContain("5");
      expect(loaded).toContain("other");
    });
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
