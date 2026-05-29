// ============================================================
// Tests for upload-address-data-to-storage — TDD RED phase
// ============================================================

import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import {
  getAllLocalFilePaths,
  validateEnv,
} from "./upload-address-data-to-storage";

// Mock fs module for controlled testing
vi.mock("node:fs", () => ({
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

import * as fs from "node:fs";

describe("getAllLocalFilePaths", () => {
  afterAll(() => {
    vi.restoreAllMocks();
  });

  it("returns only .ndjson files from the directory", () => {
    const DATA_DIR = "C:\\fake\\data\\dir";
    (fs.readdirSync as any).mockReturnValue([
      "a.ndjson", "b.ndjson", "1-0.ndjson", "1-1.ndjson",
      "other.ndjson", "_chunks.json", "some.csv",
    ]);

    const paths = getAllLocalFilePaths(DATA_DIR);
    expect(paths.length).toBe(5);
    for (const p of paths) {
      expect(p.endsWith(".ndjson")).toBe(true);
    }
    expect(paths.every((p: string) => !p.includes("_chunks"))).toBe(true);
    expect(paths.every((p: string) => !p.includes(".csv"))).toBe(true);
  });

  it("each path ends with .ndjson", () => {
    const DATA_DIR = "C:\\fake\\data\\dir";
    (fs.readdirSync as any).mockReturnValue(["a.ndjson", "b.ndjson", "other.ndjson"]);

    const paths = getAllLocalFilePaths(DATA_DIR);
    for (const p of paths) {
      expect(p.endsWith(".ndjson")).toBe(true);
    }
  });

  it("returns files sorted alphabetically", () => {
    const DATA_DIR = "C:\\fake\\data\\dir";
    (fs.readdirSync as any).mockReturnValue(["z.ndjson", "a.ndjson", "m.ndjson"]);

    const paths = getAllLocalFilePaths(DATA_DIR);
    expect(paths).toEqual([
      "C:\\fake\\data\\dir\\a.ndjson",
      "C:\\fake\\data\\dir\\m.ndjson",
      "C:\\fake\\data\\dir\\z.ndjson",
    ]);
  });

  it("returns empty array if directory does not exist", () => {
    (fs.readdirSync as any).mockImplementation(() => { throw new Error("ENOENT"); });

    const paths = getAllLocalFilePaths("C:\\fake\\data\\dir");
    expect(paths).toEqual([]);
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
    expect(validateEnv()).toBe(true);
  });
});
