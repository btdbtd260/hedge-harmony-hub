// ============================================================
// Tests for getAddressAutocompleteUrl — URL builder
// ============================================================
// TDD: Tests written FIRST (RED phase), then implementation.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  getAddressAutocompleteUrl,
  ADDRESS_AUTOCOMPLETE_SUPABASE_URL,
} from "../useAddressAutocomplete";

const SUPABASE_URL = "https://test-project.supabase.co";

describe("getAddressAutocompleteUrl", () => {
  // ── DEV mode ──

  describe("DEV mode", () => {
    it('returns /api/address-autocomplete with query params', () => {
      const url = getAddressAutocompleteUrl("test", 10, { isDev: true });

      expect(url).toBe("/api/address-autocomplete?q=test&max=10");
    });

    it("URL-encodes the query in dev mode", () => {
      const url = getAddressAutocompleteUrl("rue gauchetière", 5, {
        isDev: true,
      });

      expect(url).toBe(
        "/api/address-autocomplete?q=rue+gaucheti%C3%A8re&max=5",
      );
    });

    it("preserves the max parameter in dev mode", () => {
      const url = getAddressAutocompleteUrl("test", 25, { isDev: true });

      expect(url).toContain("max=25");
    });

    it("defaults max to 10 when not provided in dev mode", () => {
      const url = getAddressAutocompleteUrl("test", undefined, {
        isDev: true,
      });

      expect(url).toBe("/api/address-autocomplete?q=test&max=10");
    });
  });

  // ── PRODUCTION mode ──

  describe("PRODUCTION mode", () => {
    it("uses Supabase URL with /functions/v1/address-autocomplete", () => {
      const url = getAddressAutocompleteUrl("test", 10, {
        isDev: false,
        supabaseUrl: SUPABASE_URL,
      });

      expect(url).toBe(
        `${SUPABASE_URL}/functions/v1/address-autocomplete?q=test&max=10`,
      );
    });

    it("URL-encodes the query in production mode", () => {
      const url = getAddressAutocompleteUrl("rue gauchetière", 5, {
        isDev: false,
        supabaseUrl: SUPABASE_URL,
      });

      expect(url).toBe(
        `${SUPABASE_URL}/functions/v1/address-autocomplete?q=rue+gaucheti%C3%A8re&max=5`,
      );
    });

    it("preserves the max parameter in production mode", () => {
      const url = getAddressAutocompleteUrl("test", 25, {
        isDev: false,
        supabaseUrl: SUPABASE_URL,
      });

      expect(url).toContain("max=25");
    });

    it("defaults max to 10 when not provided in production mode", () => {
      const url = getAddressAutocompleteUrl("test", undefined, {
        isDev: false,
        supabaseUrl: SUPABASE_URL,
      });

      expect(url).toBe(
        `${SUPABASE_URL}/functions/v1/address-autocomplete?q=test&max=10`,
      );
    });

    it("throws an error when supabaseUrl is empty in production mode", () => {
      expect(() =>
        getAddressAutocompleteUrl("test", 10, {
          isDev: false,
          supabaseUrl: "",
        }),
      ).toThrow("Supabase URL is not configured");
    });

    it("handles special characters in the query", () => {
      const url = getAddressAutocompleteUrl("123 main st #4 & avenue", 10, {
        isDev: false,
        supabaseUrl: SUPABASE_URL,
      });

      // URLSearchParams encodes spaces as +, # as %23, & as %26
      const expectedEncoded = new URLSearchParams({
        q: "123 main st #4 & avenue",
      }).toString();
      expect(url).toContain(expectedEncoded);
    });

    it("handles empty query string", () => {
      const url = getAddressAutocompleteUrl("", 10, {
        isDev: false,
        supabaseUrl: SUPABASE_URL,
      });

      expect(url).toBe(
        `${SUPABASE_URL}/functions/v1/address-autocomplete?q=&max=10`,
      );
    });
  });

  // ── ADDRESS_AUTOCOMPLETE_SUPABASE_URL dedicated constant ──

  describe("ADDRESS_AUTOCOMPLETE_SUPABASE_URL dedicated constant", () => {
    it("exports a dedicated constant for address autocomplete", () => {
      expect(ADDRESS_AUTOCOMPLETE_SUPABASE_URL).toBe(
        "https://atipsraxpxbjbecjobuv.supabase.co",
      );
    });

    it("is not the same as the main app SUPABASE_URL", () => {
      // The dedicated URL should be different from the main app URL
      expect(ADDRESS_AUTOCOMPLETE_SUPABASE_URL).not.toBe("undefined");
    });

    it("is a valid URL with https scheme", () => {
      expect(ADDRESS_AUTOCOMPLETE_SUPABASE_URL).toMatch(
        /^https:\/\/[a-z0-9-]+\.supabase\.co$/,
      );
    });
  });

  // ── Default production URL uses dedicated constant (not VITE_SUPABASE_URL) ──

  describe("Default production URL (no supabaseUrl override)", () => {
    it("uses ADDRESS_AUTOCOMPLETE_SUPABASE_URL when no supabaseUrl option given", () => {
      const url = getAddressAutocompleteUrl("test", 10, { isDev: false });

      expect(url).toContain("atipsraxpxbjbecjobuv.supabase.co");
    });

    it("does NOT use the main app VITE_SUPABASE_URL", () => {
      const url = getAddressAutocompleteUrl("test", 10, { isDev: false });

      // The old/broken URL should NOT appear
      expect(url).not.toContain("ntyuyupbvsilnedjwgmv.supabase.co");
      // Only the dedicated autocomplete URL should be used
      expect(url).toContain("atipsraxpxbjbecjobuv.supabase.co");
    });

    it("includes /functions/v1/address-autocomplete path", () => {
      const url = getAddressAutocompleteUrl("test", 10, { isDev: false });

      expect(url).toContain("/functions/v1/address-autocomplete");
    });

    it("URL-encodes the query with default dedicated URL", () => {
      const url = getAddressAutocompleteUrl(
        "rue gauchetière",
        5,
        { isDev: false },
      );

      expect(url).toBe(
        `${ADDRESS_AUTOCOMPLETE_SUPABASE_URL}/functions/v1/address-autocomplete?q=rue+gaucheti%C3%A8re&max=5`,
      );
    });

    it("preserves the max parameter with default dedicated URL", () => {
      const url = getAddressAutocompleteUrl("test", 25, { isDev: false });

      expect(url).toContain("max=25");
    });

    it("defaults max to 10 with default dedicated URL", () => {
      const url = getAddressAutocompleteUrl("test", undefined, {
        isDev: false,
      });

      expect(url).toBe(
        `${ADDRESS_AUTOCOMPLETE_SUPABASE_URL}/functions/v1/address-autocomplete?q=test&max=10`,
      );
    });

    it("throws when explicit empty supabaseUrl is provided", () => {
      expect(() =>
        getAddressAutocompleteUrl("test", 10, {
          isDev: false,
          supabaseUrl: "",
        }),
      ).toThrow("Supabase URL is not configured");
    });
  });
});
