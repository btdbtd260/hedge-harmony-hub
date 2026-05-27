// ============================================================
// Tests for upload-address-data-to-storage — TDD RED phase
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getAllLocalFilePaths,
  getExpectedFileNames,
  validateEnv,
} from "./upload-address-data-to-storage";

describe("getExpectedFileNames", () => {
  it("returns 37 file names", () => {
    const names = getExpectedFileNames();
    expect(names.length).toBe(37);
  });

  it("includes all digits 0-9", () => {
    const names = getExpectedFileNames();
    for (let i = 0; i <= 9; i++) {
      expect(names).toContain(`${i}.ndjson`);
    }
  });

  it("includes all letters a-z", () => {
    const names = getExpectedFileNames();
    for (let i = 97; i <= 122; i++) {
      const letter = String.fromCharCode(i);
      expect(names).toContain(`${letter}.ndjson`);
    }
  });

  it('includes "other.ndjson"', () => {
    const names = getExpectedFileNames();
    expect(names).toContain("other.ndjson");
  });

  it("does not include the CSV file", () => {
    const names = getExpectedFileNames();
    const hasCsv = names.some((n) => n.includes(".csv"));
    expect(hasCsv).toBe(false);
  });
});

describe("getAllLocalFilePaths", () => {
  const DATA_DIR = "C:\\fake\\data\\dir";

  it("returns 37 file paths", () => {
    const paths = getAllLocalFilePaths(DATA_DIR);
    expect(paths.length).toBe(37);
  });

  it("each path ends with .ndjson", () => {
    const paths = getAllLocalFilePaths(DATA_DIR);
    for (const p of paths) {
      expect(p.endsWith(".ndjson")).toBe(true);
    }
  });

  it("each path contains the data dir", () => {
    const paths = getAllLocalFilePaths(DATA_DIR);
    for (const p of paths) {
      expect(p).toContain(DATA_DIR);
    }
  });
});

describe("validateEnv", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("returns true when all required env vars are set", () => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    process.env.SUPABASE_BUCKET_NAME = "address-autocomplete";
    expect(validateEnv()).toBe(true);
  });

  it("returns false when SUPABASE_URL is missing", () => {
    delete process.env.SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    process.env.SUPABASE_BUCKET_NAME = "address-autocomplete";
    expect(validateEnv()).toBe(false);
  });

  it("returns false when SUPABASE_SERVICE_ROLE_KEY is missing", () => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_BUCKET_NAME = "address-autocomplete";
    expect(validateEnv()).toBe(false);
  });

  it("uses default bucket name when SUPABASE_BUCKET_NAME is missing", () => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    delete process.env.SUPABASE_BUCKET_NAME;
    // Should default to "address-autocomplete"
    expect(validateEnv()).toBe(true);
  });
});
