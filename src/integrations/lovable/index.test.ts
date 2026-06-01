import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase client using vi.hoisted to avoid hoisting issues
const { mockSignInWithOAuth } = vi.hoisted(() => ({
  mockSignInWithOAuth: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
    },
  },
}));

// Import AFTER mocking
import { lovable } from "./index";

describe("lovable.auth.signInWithOAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("success cases", () => {
    it("calls supabase.auth.signInWithOAuth with Google provider and redirect_uri", async () => {
      mockSignInWithOAuth.mockResolvedValueOnce({
        data: { provider: "google" },
        error: null,
      });

      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: "http://localhost:5173",
      });

      expect(mockSignInWithOAuth).toHaveBeenCalledTimes(1);
      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: "http://localhost:5173",
        },
      });
      expect(result.error).toBeNull();
    });

    it("calls supabase.auth.signInWithOAuth with Apple provider and no options", async () => {
      mockSignInWithOAuth.mockResolvedValueOnce({
        data: { provider: "apple" },
        error: null,
      });

      const result = await lovable.auth.signInWithOAuth("apple");

      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: "apple",
        options: {},
      });
      expect(result.error).toBeNull();
    });

    it("calls supabase.auth.signInWithOAuth with Microsoft provider", async () => {
      mockSignInWithOAuth.mockResolvedValueOnce({
        data: { provider: "microsoft" },
        error: null,
      });

      const result = await lovable.auth.signInWithOAuth("microsoft", {
        redirect_uri: "https://app.example.com",
      });

      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: "microsoft",
        options: {
          redirectTo: "https://app.example.com",
        },
      });
      expect(result.error).toBeNull();
    });

    it("passes extraParams as queryParams", async () => {
      mockSignInWithOAuth.mockResolvedValueOnce({
        data: { provider: "google" },
        error: null,
      });

      await lovable.auth.signInWithOAuth("google", {
        extraParams: { prompt: "select_account", hd: "example.com" },
      });

      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          queryParams: { prompt: "select_account", hd: "example.com" },
        },
      });
    });

    it("returns error: null on successful popup auth (no redirect)", async () => {
      mockSignInWithOAuth.mockResolvedValueOnce({
        data: { provider: "google" },
        error: null,
      });

      const result = await lovable.auth.signInWithOAuth("google");

      expect(result).toEqual({
        error: null,
      });
      expect(result.redirected).toBeUndefined();
    });
  });

  describe("redirect flow", () => {
    it("redirects when supabase returns a url and returns redirected: true", async () => {
      const oauthUrl = "https://accounts.google.com/o/oauth2/auth?state=xyz";
      const originalLocation = window.location;

      // Spy on location.href assignment
      let assignedUrl = "";
      Object.defineProperty(window, "location", {
        value: {
          ...originalLocation,
          href: "",
          assign: vi.fn(),
        },
        writable: true,
        configurable: true,
      });

      Object.defineProperty(window.location, "href", {
        set: (url: string) => {
          assignedUrl = url;
        },
        get: () => assignedUrl || originalLocation.href,
        configurable: true,
      });

      mockSignInWithOAuth.mockResolvedValueOnce({
        data: { provider: "google", url: oauthUrl },
        error: null,
      });

      const result = await lovable.auth.signInWithOAuth("google");

      expect(assignedUrl).toBe(oauthUrl);
      expect(result.error).toBeNull();
      expect(result.redirected).toBe(true);
    });
  });

  describe("error cases", () => {
    it("wraps supabase auth error as Error object", async () => {
      mockSignInWithOAuth.mockResolvedValueOnce({
        data: null,
        error: { message: "OAuth error occurred" },
      });

      const result = await lovable.auth.signInWithOAuth("google");

      expect(result.error).toBeInstanceOf(Error);
      expect(result.error!.message).toBe("OAuth error occurred");
      expect(result.redirected).toBeFalsy();
    });

    it("wraps supabase auth error with custom message", async () => {
      mockSignInWithOAuth.mockResolvedValueOnce({
        data: null,
        error: { message: "Popup closed" },
      });

      const result = await lovable.auth.signInWithOAuth("google");

      expect(result.error).toBeInstanceOf(Error);
      expect(result.error!.message).toBe("Popup closed");
    });

    it("does not throw when signInWithOAuth succeeds", async () => {
      mockSignInWithOAuth.mockResolvedValueOnce({
        data: { provider: "google" },
        error: null,
      });

      await expect(
        lovable.auth.signInWithOAuth("google")
      ).resolves.not.toThrow();
    });
  });

  describe("edge cases", () => {
    it("handles undefined options gracefully", async () => {
      mockSignInWithOAuth.mockResolvedValueOnce({
        data: { provider: "google" },
        error: null,
      });

      const result = await lovable.auth.signInWithOAuth("google", undefined);

      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {},
      });
      expect(result.error).toBeNull();
    });

    it("ignores empty extraParams (no queryParams sent)", async () => {
      mockSignInWithOAuth.mockResolvedValueOnce({
        data: { provider: "google" },
        error: null,
      });

      const result = await lovable.auth.signInWithOAuth("google", {
        extraParams: {},
      });

      // Empty extraParams should not result in a queryParams field
      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {},
      });
      expect(result.error).toBeNull();
    });

    it("wraps supabase error message into a new Error", async () => {
      mockSignInWithOAuth.mockResolvedValueOnce({
        data: null,
        error: { message: "Network failure" },
      });

      const result = await lovable.auth.signInWithOAuth("google");

      expect(result.error).toBeInstanceOf(Error);
      expect(result.error!.message).toBe("Network failure");
    });

    it("surfaces non-string error messages as string", async () => {
      mockSignInWithOAuth.mockResolvedValueOnce({
        data: null,
        error: { message: 12345 },
      });

      const result = await lovable.auth.signInWithOAuth("google");

      expect(result.error).toBeInstanceOf(Error);
      expect(result.error!.message).toBe("12345");
    });
  });
});
