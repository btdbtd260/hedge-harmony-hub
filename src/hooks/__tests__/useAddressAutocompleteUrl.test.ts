// ============================================================
// Tests for getAddressAutocompleteUrl — URL builder
// ============================================================
// TDD: Tests written FIRST (RED phase), then implementation.
// ============================================================

import { describe, it, expect } from "vitest";
import { getAddressAutocompleteUrl } from "../useAddressAutocomplete";

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
});
