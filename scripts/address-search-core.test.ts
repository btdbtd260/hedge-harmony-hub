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
  getChunkSuffix,
  ALL_CHUNK_PREFIXES,
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

function chunkAddressesFor(digit: string, prefix: string, count = 3, searchTerm?: string): Address[] {
  const term = searchTerm ?? `${digit}${prefix}searchterm`;
  return Array.from({ length: count }, (_, i) =>
    makeAddress({
      s: `${digit}${prefix}${i} ${term} rue`,
      a: `${digit}${prefix}${i} Rue Chunk Test`,
      v: "Chunk Ville",
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

// ─── getChunkSuffix ───

describe("getChunkSuffix", () => {
  it("returns the second character for digit second chars", () => {
    expect(getChunkSuffix("13607 rue test")).toBe("3");
    expect(getChunkSuffix("12345 rue test")).toBe("2");
    expect(getChunkSuffix("10000 rue test")).toBe("0");
  });

  it("returns the second character for letter second chars", () => {
    expect(getChunkSuffix("1a rue test")).toBe("a");
    expect(getChunkSuffix("2b rue test")).toBe("b");
  });

  it('returns "x" for single-character keys', () => {
    expect(getChunkSuffix("1")).toBe("x");
    expect(getChunkSuffix("a")).toBe("x");
  });

  it('returns "x" for special character second chars', () => {
    expect(getChunkSuffix("1@test")).toBe("x");
    expect(getChunkSuffix("1 test")).toBe("x");
  });
});

// ─── isLetterChar ───

describe("isLetterChar", () => {
  it("returns true for lowercase ASCII letters", () => {
    expect(isLetterChar(97)).toBe(true);
    expect(isLetterChar(122)).toBe(true);
  });

  it("returns true for uppercase ASCII letters", () => {
    expect(isLetterChar(65)).toBe(true);
    expect(isLetterChar(90)).toBe(true);
  });

  it("returns false for digits", () => {
    expect(isLetterChar(48)).toBe(false);
    expect(isLetterChar(57)).toBe(false);
  });

  it("returns false for special characters", () => {
    expect(isLetterChar(64)).toBe(false);
    expect(isLetterChar(35)).toBe(false);
  });
});

// ─── isDigitChar ───

describe("isDigitChar", () => {
  it("returns true for digit codes", () => {
    expect(isDigitChar(48)).toBe(true);
    expect(isDigitChar(57)).toBe(true);
  });

  it("returns false for letter codes", () => {
    expect(isDigitChar(65)).toBe(false);
    expect(isDigitChar(97)).toBe(false);
  });

  it("returns false for special characters", () => {
    expect(isDigitChar(64)).toBe(false);
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
  it("contains 37 entries", () => {
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
    const expected = [...DIGIT_FILES, ...LETTER_FILES, "other"];
    expect([...ALL_STORAGE_FILES].sort()).toEqual([...expected].sort());
  });
});

// ─── ALL_CHUNK_PREFIXES ───

describe("ALL_CHUNK_PREFIXES", () => {
  it("contains 37 prefixes (10 digits + 26 letters + 1 other)", () => {
    expect(ALL_CHUNK_PREFIXES.length).toBe(37);
  });

  it("includes digits 0-9", () => {
    expect(ALL_CHUNK_PREFIXES.slice(0, 10)).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  });

  it("includes letters a-z", () => {
    expect(ALL_CHUNK_PREFIXES[10]).toBe("a");
    expect(ALL_CHUNK_PREFIXES[35]).toBe("z");
  });

  it('includes "x" for other', () => {
    expect(ALL_CHUNK_PREFIXES[36]).toBe("x");
  });
});

// ─── searchAddressesCore ───

describe("searchAddressesCore", () => {
  function createMockLoader(
    addressesByFile: Record<string, Address[]>,
  ): (fileName: string) => Address[] {
    return (fileName: string) => addressesByFile[fileName] ?? [];
  }

  describe("q length < 2", () => {
    it("returns empty array for empty string", () => {
      expect(searchAddressesCore("", 10, createMockLoader({}))).toEqual([]);
    });
    it("returns empty array for single character", () => {
      expect(searchAddressesCore("a", 10, createMockLoader({}))).toEqual([]);
    });
    it("returns empty array for whitespace-only input", () => {
      expect(searchAddressesCore("   ", 10, createMockLoader({}))).toEqual([]);
    });
  });

  describe("digit query with chunked files", () => {
    it("loads only the matching digit chunk", () => {
      const addrs13 = chunkAddressesFor("1", "3", 5, "13searchterm");
      const addrs15 = chunkAddressesFor("1", "5", 3, "15searchterm");
      const loadSpy = vi.fn((fileName: string) => {
        if (fileName === "1-3") return addrs13;
        if (fileName === "1-5") return addrs15;
        return [];
      });
      const getDC = vi.fn((d: string) => d === "1" ? ["1-3", "1-5"] : [d]);

      const results = searchAddressesCore("13searchterm", 10, loadSpy, getDC);
      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith("1-3");
      expect(loadSpy).not.toHaveBeenCalledWith("1-5");
      expect(results.length).toBeGreaterThan(0);
    });

    it("does not load all chunks for a digit query", () => {
      const allChunks = ["1-0","1-1","1-2","1-3","1-4","1-5","1-6","1-7","1-8","1-9"];
      const loadSpy = vi.fn((fileName: string) => {
        if (fileName === "1-3") return chunkAddressesFor("1", "3", 5, "13searchterm");
        return [];
      });
      const getDC = vi.fn((d: string) => d === "1" ? allChunks : [d]);

      searchAddressesCore("13searchterm", 10, loadSpy, getDC);
      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith("1-3");
      allChunks.filter(c => c !== "1-3").forEach(c => {
        expect(loadSpy).not.toHaveBeenCalledWith(c);
      });
    });

    it("falls back to single digit file if not chunked", () => {
      const loadSpy = vi.fn((fileName: string) => {
        if (fileName === "5") return digitAddressesFor("5", 15, "555test");
        return [];
      });
      const results = searchAddressesCore("555test", 10, loadSpy);
      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith("5");
      expect(results.length).toBeGreaterThan(0);
    });

    it("loads all digit chunks as fallback when exact chunk not found", () => {
      // Available chunks: "1-0", "1-1", "1-9" — no "1-s"
      // Each chunk has addresses containing "1searchterm" in their search key
      const loadSpy = vi.fn((fileName: string) => {
        if (fileName === "1-0") return chunkAddressesFor("1", "0", 2, "1searchterm");
        if (fileName === "1-1") return chunkAddressesFor("1", "1", 2, "1searchterm");
        if (fileName === "1-9") return chunkAddressesFor("1", "9", 1, "1searchterm");
        return [];
      });
      const getDC = vi.fn((d: string) => d === "1" ? ["1-0", "1-1", "1-9"] : [d]);

      // Query "1searchterm": first char "1", suffix "s" (second char)
      // "1-s" is NOT in the available chunks → loads all chunks
      // Each chunk has addresses with search key containing "1searchterm" → matches!
      const results = searchAddressesCore("1searchterm", 10, loadSpy, getDC);

      expect(loadSpy).toHaveBeenCalledWith("1-0");
      expect(loadSpy).toHaveBeenCalledWith("1-1");
      expect(loadSpy).toHaveBeenCalledWith("1-9");
      expect(results.length).toBeGreaterThan(0);
    });

    it("returns matching results from chunked digit file", () => {
      const addresses = [
        makeAddress({ s: "13test montreal", a: "123 Test St" }),
        makeAddress({ s: "456 autre rue", a: "456 Autre Rue" }),
      ];
      const getDC = vi.fn((d: string) => [d, `${d}-3`]);
      const results = searchAddressesCore("13test", 10, createMockLoader({ "1-3": addresses }), getDC);
      expect(results.length).toBe(1);
      expect(results[0].adresse_complete).toBe("123 Test St");
    });
  });

  describe("letter query with digit fallback", () => {
    it("loads only the letter file when enough results exist", () => {
      const loadSpy = vi.fn((fn: string) => fn === "m" ? letterAddressesFor("m", 15, "mytest") : []);
      const results = searchAddressesCore("mytest", 10, loadSpy);
      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith("m");
      expect(results.length).toBe(10);
    });

    it("falls back to digit chunks when letter file has fewer than 10 results", () => {
      const loadSpy = vi.fn((fn: string) => {
        if (fn === "a") return letterAddressesFor("a", 3, "atest");
        if (fn === "0") return chunkAddressesFor("0", "a", 2, "atest");
        if (fn === "1") return chunkAddressesFor("1", "a", 2, "atest");
        return [];
      });
      const results = searchAddressesCore("atest", 10, loadSpy);
      expect(loadSpy.mock.calls[0][0]).toBe("a");
      expect(results.length).toBe(7);
    });

    it("falls back through digit chunks progressively", () => {
      const loadSpy = vi.fn((fn: string) => {
        if (fn === "t") return letterAddressesFor("t", 4, "ttest");
        if (fn === "0") return chunkAddressesFor("0", "t", 3, "ttest");
        if (fn === "1") return chunkAddressesFor("1", "t", 3, "ttest");
        return [];
      });
      const results = searchAddressesCore("ttest", 10, loadSpy);
      expect(loadSpy).toHaveBeenCalledWith("t");
      expect(loadSpy).toHaveBeenCalledWith("0");
      expect(loadSpy).toHaveBeenCalledWith("1");
      expect(results.length).toBe(10);
    });

    it("stops fallback once 10 results are found", () => {
      const loadSpy = vi.fn((fn: string) => {
        if (fn === "t") return letterAddressesFor("t", 4, "ttest");
        if (fn === "0") return chunkAddressesFor("0", "t", 3, "ttest");
        if (fn === "1") return chunkAddressesFor("1", "t", 3, "ttest");
        if (fn === "2") return chunkAddressesFor("2", "t", 3, "ttest");
        return [];
      });
      const results = searchAddressesCore("ttest", 10, loadSpy);
      expect(loadSpy).toHaveBeenCalledWith("t");
      expect(loadSpy).toHaveBeenCalledWith("0");
      expect(loadSpy).toHaveBeenCalledWith("1");
      expect(loadSpy).not.toHaveBeenCalledWith("2");
      expect(results.length).toBe(10);
    });

    it("returns fewer than 10 if not enough matches", () => {
      const loader = createMockLoader({
        "x": [makeAddress({ s: "xrare 1", a: "X Rare 1" }), makeAddress({ s: "xrare 2", a: "X Rare 2" })],
        "0": [makeAddress({ s: "xrare 0", a: "X0 Match" })],
        "1": [],
      });
      expect(searchAddressesCore("xrare", 10, loader).length).toBe(3);
    });

    it("returns empty array when no matches found", () => {
      const loader = createMockLoader({ "z": letterAddressesFor("z", 5, "zzmatch") });
      expect(searchAddressesCore("zzz nonexistent", 10, loader)).toEqual([]);
    });

    it("does not load all digit chunks at once for fallback", () => {
      const loadSpy = vi.fn((fn: string) => {
        if (fn === "r") return letterAddressesFor("r", 3, "rtest");
        return [];
      });
      const getDC = vi.fn((d: string) => [d, `${d}-0`, `${d}-1`, `${d}-2`]);
      const results = searchAddressesCore("rtest", 10, loadSpy, getDC);
      expect(loadSpy).toHaveBeenCalledWith("r");
      expect(loadSpy.mock.calls.length).toBeLessThanOrEqual(41);
      expect(results.length).toBe(3);
    });
  });

  describe("other character query", () => {
    it('loads only "other" file', () => {
      const loadSpy = vi.fn((fn: string) => {
        if (fn === "other") return [makeAddress({ s: "@special addresse", a: "@ Special Address" })];
        return [];
      });
      const results = searchAddressesCore("@special", 10, loadSpy);
      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith("other");
      expect(results.length).toBe(1);
    });
  });

  describe("response shape", () => {
    it("returns suggestions with correct shape", () => {
      const addresses = [makeAddress({
        s: "rue principale", a: "100 Rue Principale, Montréal, QC H3A 1A1",
        v: "Montréal", cp: "H3A 1A1", d: 2.5, lat: 45.5, lng: -73.6,
      })];
      const loader = createMockLoader({ "r": addresses });
      const results = searchAddressesCore("rue", 10, loader);
      expect(results.length).toBe(1);
      expect(isValidSuggestion(results[0])).toBe(true);
      expect(results[0]).toEqual({
        adresse_complete: "100 Rue Principale, Montréal, QC H3A 1A1",
        ville: "Montréal", code_postal: "H3A 1A1",
        distance_km: 2.5, latitude: 45.5, longitude: -73.6,
      });
    });

    it("returns max 10 suggestions", () => {
      const many = Array.from({ length: 25 }, (_, i) => makeAddress({ s: `test${i}`, a: `Test Address ${i}` }));
      const loader = createMockLoader({ "t": many });
      expect(searchAddressesCore("test", 10, loader).length).toBeLessThanOrEqual(10);
    });

    it("result array is empty when no data available", () => {
      expect(searchAddressesCore("query", 10, createMockLoader({}))).toEqual([]);
    });
  });

  describe("query normalization in search", () => {
    it("matches addresses with accented characters", () => {
      const addresses = [makeAddress({ s: "montreal quebec", a: "Montréal Address" })];
      const loader = createMockLoader({ "m": addresses });
      expect(searchAddressesCore("montréal", 10, loader).length).toBe(1);
    });

    it("is case insensitive", () => {
      const addresses = [makeAddress({ s: "rue principale", a: "Rue Principale" })];
      const loader = createMockLoader({ "r": addresses });
      expect(searchAddressesCore("RUE", 10, loader).length).toBe(1);
      expect(searchAddressesCore("rue", 10, loader).length).toBe(1);
    });
  });
});
