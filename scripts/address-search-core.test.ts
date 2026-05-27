// ============================================================
// Tests for address search core — TDD RED phase
// ============================================================

import { describe, it, expect, vi } from "vitest";
import {
  normalizeQuery,
  getFileName,
  isLetterChar,
  isDigitChar,
  toSuggestion,
  searchAddressesCore,
  isValidSuggestion,
  ALL_STORAGE_FILES,
  LETTER_FILES,
  DIGIT_FILES,
  type Address,
  type Suggestion,
} from "./address-search-core";

// ─── Fixtures ───

function makeAddress(overrides: Partial<Address> = {}): Address {
  return {
    s: "123 rue test montreal",
    a: "123 Rue Test, Montréal, QC H3A 1A1",
    v: "Montréal",
    cp: "H3A 1A1",
    d: 1.5,
    lat: 45.5,
    lng: -73.6,
    ...overrides,
  };
}

/**
 * Create addresses whose search key (s) includes a searchable term.
 * The addresses will match a query containing that term.
 */
function letterAddressesFor(letter: string, count = 5, searchTerm?: string): Address[] {
  const term = searchTerm ?? `${letter}test`;
  const base = letter.toLowerCase();
  return Array.from({ length: count }, (_, i) =>
    makeAddress({
      s: `${term} ${base}${i} rue`,
      a: `${i}${i}${i} Rue ${letter.toUpperCase()} Test`,
      v: "Ville Test",
    })
  );
}

function digitAddressesFor(digit: string, count = 3, searchTerm?: string): Address[] {
  const term = searchTerm ?? `${digit}${digit}${digit}`;
  return Array.from({ length: count }, (_, i) =>
    makeAddress({
      s: `${term} ${digit}${i} rue`,
      a: `${digit}${digit}${digit} Rue Digit Test #${i}`,
      v: "Digit Ville",
    })
  );
}

// ─── normalizeQuery ───

describe("normalizeQuery", () => {
  it("lowercases the query", () => {
    expect(normalizeQuery("Montréal")).toBe("montreal");
  });

  it("strips accents (é → e, à → a, ü → u, etc.)", () => {
    expect(normalizeQuery("éàüöîçñ")).toBe("eauoicn");
  });

  it("removes parentheses", () => {
    expect(normalizeQuery("Rue (de la) Paix")).toBe("rue de la paix");
  });

  it("handles already-normal strings", () => {
    expect(normalizeQuery("123 main street")).toBe("123 main street");
  });

  it("handles empty string", () => {
    expect(normalizeQuery("")).toBe("");
  });

  it("handles strings with only special characters", () => {
    expect(normalizeQuery("()!@#$%^&*")).toBe("!@#$%^&*");
  });
});

// ─── getFileName ───

describe("getFileName", () => {
  it("returns the same letter for lowercase letters", () => {
    expect(getFileName("a")).toBe("a");
    expect(getFileName("m")).toBe("m");
    expect(getFileName("z")).toBe("z");
  });

  it("returns lowercase for uppercase letters", () => {
    expect(getFileName("A")).toBe("a");
    expect(getFileName("M")).toBe("m");
    expect(getFileName("Z")).toBe("z");
  });

  it("returns the digit for digit characters", () => {
    expect(getFileName("0")).toBe("0");
    expect(getFileName("5")).toBe("5");
    expect(getFileName("9")).toBe("9");
  });

  it('returns "other" for empty string', () => {
    expect(getFileName("")).toBe("other");
  });

  it('returns "other" for special characters', () => {
    expect(getFileName("@")).toBe("other");
    expect(getFileName("#")).toBe("other");
    expect(getFileName("(")).toBe("other");
  });
});

// ─── isLetterChar ───

describe("isLetterChar", () => {
  it("returns true for lowercase ASCII letters", () => {
    expect(isLetterChar(97)).toBe(true);  // a
    expect(isLetterChar(122)).toBe(true); // z
  });

  it("returns true for uppercase ASCII letters", () => {
    expect(isLetterChar(65)).toBe(true);  // A
    expect(isLetterChar(90)).toBe(true);  // Z
  });

  it("returns false for digits", () => {
    expect(isLetterChar(48)).toBe(false); // 0
    expect(isLetterChar(57)).toBe(false); // 9
  });

  it("returns false for special characters", () => {
    expect(isLetterChar(64)).toBe(false); // @
    expect(isLetterChar(35)).toBe(false); // #
  });
});

// ─── isDigitChar ───

describe("isDigitChar", () => {
  it("returns true for digit codes", () => {
    expect(isDigitChar(48)).toBe(true);  // 0
    expect(isDigitChar(57)).toBe(true);  // 9
  });

  it("returns false for letter codes", () => {
    expect(isDigitChar(65)).toBe(false); // A
    expect(isDigitChar(97)).toBe(false); // a
  });

  it("returns false for special characters", () => {
    expect(isDigitChar(64)).toBe(false); // @
  });
});

// ─── toSuggestion ───

describe("toSuggestion", () => {
  it("maps Address to Suggestion correctly", () => {
    const addr = makeAddress();
    const result = toSuggestion(addr);

    expect(result.adresse_complete).toBe(addr.a);
    expect(result.ville).toBe(addr.v);
    expect(result.code_postal).toBe(addr.cp);
    expect(result.distance_km).toBe(addr.d);
    expect(result.latitude).toBe(addr.lat);
    expect(result.longitude).toBe(addr.lng);
  });

  it("produces correct Suggestion shape", () => {
    const addr = makeAddress();
    const result = toSuggestion(addr);

    // All fields must be present with correct types
    expect(result).toEqual({
      adresse_complete: expect.any(String),
      ville: expect.any(String),
      code_postal: expect.any(String),
      distance_km: expect.any(Number),
      latitude: expect.any(Number),
      longitude: expect.any(Number),
    });
  });
});

// ─── isValidSuggestion ───

describe("isValidSuggestion", () => {
  it("returns true for a valid Suggestion object", () => {
    const s: Suggestion = {
      adresse_complete: "123 Rue Test",
      ville: "Montréal",
      code_postal: "H3A 1A1",
      distance_km: 1.5,
      latitude: 45.5,
      longitude: -73.6,
    };
    expect(isValidSuggestion(s)).toBe(true);
  });

  it("returns false for null", () => {
    expect(isValidSuggestion(null)).toBe(false);
  });

  it("returns false for non-object values", () => {
    expect(isValidSuggestion("string")).toBe(false);
    expect(isValidSuggestion(42)).toBe(false);
    expect(isValidSuggestion(undefined)).toBe(false);
  });

  it("returns false when fields have wrong types", () => {
    expect(isValidSuggestion({ adresse_complete: 123, ville: "", code_postal: "", distance_km: 0, latitude: 0, longitude: 0 })).toBe(false);
    expect(isValidSuggestion({ adresse_complete: "", ville: null, code_postal: "", distance_km: 0, latitude: 0, longitude: 0 })).toBe(false);
  });
});

// ─── ALL_STORAGE_FILES ───

describe("ALL_STORAGE_FILES", () => {
  it("contains exactly 37 entries", () => {
    expect(ALL_STORAGE_FILES.length).toBe(37);
  });

  it("contains 10 digit files", () => {
    expect(DIGIT_FILES.length).toBe(10);
    expect(DIGIT_FILES).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  });

  it("contains 26 letter files", () => {
    expect(LETTER_FILES.length).toBe(26);
    expect(LETTER_FILES[0]).toBe("a");
    expect(LETTER_FILES[25]).toBe("z");
  });

  it('contains "other" file', () => {
    expect(ALL_STORAGE_FILES).toContain("other");
  });

  it("includes all digits, letters, and other", () => {
    const expected = [
      ...DIGIT_FILES,
      ...LETTER_FILES,
      "other",
    ];
    expect([...ALL_STORAGE_FILES].sort()).toEqual([...expected].sort());
  });
});

// ─── searchAddressesCore ───

describe("searchAddressesCore", () => {
  // Helper to create a mock loader that returns addresses by file name
  function createMockLoader(
    addressesByFile: Record<string, Address[]>,
  ): (fileName: string) => Address[] {
    return (fileName: string) => addressesByFile[fileName] ?? [];
  }

  // ── q length < 2 returns empty ──

  describe("q length < 2", () => {
    it("returns empty array for empty string", () => {
      const loader = createMockLoader({});
      const results = searchAddressesCore("", 10, loader);
      expect(results).toEqual([]);
    });

    it("returns empty array for single character", () => {
      const loader = createMockLoader({});
      const results = searchAddressesCore("a", 10, loader);
      expect(results).toEqual([]);
    });

    it("returns empty array for whitespace-only input", () => {
      const loader = createMockLoader({});
      const results = searchAddressesCore("   ", 10, loader);
      expect(results).toEqual([]);
    });
  });

  // ── Digit query loads only that digit file ──

  describe("digit query", () => {
    it("loads only the single digit file", () => {
      const loadSpy = vi.fn((fileName: string) => {
        if (fileName === "5") return digitAddressesFor("5", 15, "555test");
        return [];
      });

      const results = searchAddressesCore("555test", 10, loadSpy);

      // Should only have loaded "5"
      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith("5");
      expect(results.length).toBeGreaterThan(0);
    });

    it("does not fallback to other files for digits", () => {
      const loadSpy = vi.fn((fileName: string) => {
        if (fileName === "9") return digitAddressesFor("9", 3, "999test");
        return [];
      });

      // Only 3 results in digit file, but should NOT fallback
      const results = searchAddressesCore("999test", 10, loadSpy);

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith("9");
      expect(results.length).toBe(3);
    });

    it("returns matching results from digit file", () => {
      const addresses = [
        makeAddress({ s: "3test montreal", a: "123 Test St" }),
        makeAddress({ s: "456 autre rue", a: "456 Autre Rue" }),
      ];
      const loader = createMockLoader({ "3": addresses });

      // Search for "3test" which matches first address
      const results = searchAddressesCore("3test", 10, loader);
      expect(results.length).toBe(1);
      expect(results[0].adresse_complete).toBe("123 Test St");
    });
  });

  // ── Letter query loads letter file first, then digit fallback ──

  describe("letter query with digit fallback", () => {
    it("loads only the letter file when enough results exist", () => {
      const loadSpy = vi.fn((fileName: string) => {
        if (fileName === "m") return letterAddressesFor("m", 15, "mytest");
        return [];
      });

      const results = searchAddressesCore("mytest", 10, loadSpy);

      // Should only have loaded "m" since 15 > 10
      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith("m");
      expect(results.length).toBe(10);
    });

    it("falls back to digit files when letter file has fewer than 10 results", () => {
      const loadSpy = vi.fn((fileName: string) => {
        if (fileName === "a") return letterAddressesFor("a", 3, "atest"); // Only 3
        if (DIGIT_FILES.includes(fileName as any)) return digitAddressesFor(fileName, 2, "atest");
        return [];
      });

      const results = searchAddressesCore("atest", 10, loadSpy);

      // Should have loaded "a" first, then digits until 10 results
      const loadedFiles = loadSpy.mock.calls.map(([name]) => name);
      expect(loadedFiles[0]).toBe("a");
      // Should include digit files (loaded progressively)
      expect(loadedFiles.length).toBeGreaterThan(1);
      expect(results.length).toBe(10);
    });

    it("stops fallback once 10 results are found", () => {
      const loadSpy = vi.fn((fileName: string) => {
        // Return increasing numbers to reach 10 quickly
        if (fileName === "t") return letterAddressesFor("t", 4, "ttest");
        if (fileName === "0") return digitAddressesFor("0", 3, "ttest"); // 4+3=7
        if (fileName === "1") return digitAddressesFor("1", 3, "ttest"); // 7+3=10 ✓ stop
        if (fileName === "2") return digitAddressesFor("2", 3, "ttest");
        return [];
      });

      const results = searchAddressesCore("ttest", 10, loadSpy);

      // Should have stopped after "1" because 4+3+3 = 10
      expect(loadSpy).toHaveBeenCalledWith("t");
      expect(loadSpy).toHaveBeenCalledWith("0");
      expect(loadSpy).toHaveBeenCalledWith("1");
      // "2" should NOT have been called
      expect(loadSpy).not.toHaveBeenCalledWith("2");
      expect(results.length).toBe(10);
    });

    it("returns fewer than 10 if not enough matches across all files", () => {
      const loader = createMockLoader({
        "x": [makeAddress({ s: "xrare 1", a: "X Rare 1" }), makeAddress({ s: "xrare 2", a: "X Rare 2" })],
        "0": [makeAddress({ s: "xrare 0", a: "X0 Match" })],
        "1": [],
      });

      const results = searchAddressesCore("xrare", 10, loader);
      expect(results.length).toBe(3);
    });

    it("returns empty array when no matches found", () => {
      const loader = createMockLoader({
        "z": letterAddressesFor("z", 5, "zzmatch"),
      });

      const results = searchAddressesCore("zzz nonexistent", 10, loader);
      expect(results).toEqual([]);
    });
  });

  // ── Special/other character query uses other.ndjson ──

  describe("other character query", () => {
    it('loads only "other" file', () => {
      const loadSpy = vi.fn((fileName: string) => {
        if (fileName === "other") return [
          makeAddress({ s: "@special addresse", a: "@ Special Address" }),
        ];
        return [];
      });

      const results = searchAddressesCore("@special", 10, loadSpy);

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith("other");
      expect(results.length).toBe(1);
    });
  });

  // ── Response shape ──

  describe("response shape", () => {
    it("returns suggestions with correct shape", () => {
      const addresses = [
        makeAddress({
          s: "rue principale",
          a: "100 Rue Principale, Montréal, QC H3A 1A1",
          v: "Montréal",
          cp: "H3A 1A1",
          d: 2.5,
          lat: 45.5,
          lng: -73.6,
        }),
      ];
      const loader = createMockLoader({ "r": addresses });

      const results = searchAddressesCore("rue", 10, loader);

      expect(results.length).toBe(1);
      const s = results[0];
      expect(isValidSuggestion(s)).toBe(true);
      expect(s).toEqual({
        adresse_complete: "100 Rue Principale, Montréal, QC H3A 1A1",
        ville: "Montréal",
        code_postal: "H3A 1A1",
        distance_km: 2.5,
        latitude: 45.5,
        longitude: -73.6,
      });
    });

    it("returns max 10 suggestions", () => {
      const manyAddresses = Array.from({ length: 25 }, (_, i) =>
        makeAddress({ s: `test${i}`, a: `Test Address ${i}` })
      );
      const loader = createMockLoader({ "t": manyAddresses });

      const results = searchAddressesCore("test", 10, loader);
      expect(results.length).toBeLessThanOrEqual(10);
    });

    it("result array is empty when no data available", () => {
      const loader = createMockLoader({});
      const results = searchAddressesCore("query", 10, loader);
      expect(results).toEqual([]);
    });
  });

  // ── Query normalization ──

  describe("query normalization in search", () => {
    it("matches addresses with accented characters", () => {
      const addresses = [
        makeAddress({ s: "montreal quebec", a: "Montréal Address" }),
      ];
      const loader = createMockLoader({ "m": addresses });

      // Query with accent or without should both work since both are normalized
      const results = searchAddressesCore("montréal", 10, loader);
      expect(results.length).toBe(1);
    });

    it("is case insensitive", () => {
      const addresses = [
        makeAddress({ s: "rue principale", a: "Rue Principale" }),
      ];
      const loader = createMockLoader({ "r": addresses });

      const resultsUpper = searchAddressesCore("RUE", 10, loader);
      const resultsLower = searchAddressesCore("rue", 10, loader);

      expect(resultsUpper.length).toBe(1);
      expect(resultsLower.length).toBe(1);
    });
  });
});
