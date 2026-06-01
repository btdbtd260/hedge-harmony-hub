/**
 * Tests for supabase/functions/_shared/download-twilio-media.ts
 *
 * Tests the shared Twilio Media download module that replaces
 * the Lovable connector-gateway for media download.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  downloadTwilioMedia,
  type TwilioMediaConfig,
} from "../../supabase/functions/_shared/download-twilio-media";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_CONFIG: TwilioMediaConfig = {
  accountSid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  authToken: "sk_test_1234567890abcdef",
};

const VALID_MEDIA_URL =
  "https://api.twilio.com/2010-04-01/Accounts/ACxxx/Messages/SMxxx/Media/MExxx";

// ─── downloadTwilioMedia ────────────────────────────────────────────────────

describe("downloadTwilioMedia", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it("downloads media directly from Twilio API (not connector-gateway)", async () => {
    // This test MUST FAIL first (RED phase)
    const imageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(imageData, {
        status: 200,
        headers: { "Content-Type": "image/png" },
      })
    );

    const result = await downloadTwilioMedia(VALID_MEDIA_URL, VALID_CONFIG);

    // Verify the URL is the direct Twilio API, not the Lovable gateway
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toBe(VALID_MEDIA_URL);
    expect(calledUrl).not.toContain("connector-gateway.lovable.dev");

    // Verify Basic auth (not Bearer token)
    const headers = fetchSpy.mock.calls[0][1] as RequestInit;
    const authHeader = (headers.headers as Record<string, string>).Authorization;
    expect(authHeader).toMatch(/^Basic /);
    expect(authHeader).not.toMatch(/^Bearer /);

    // Verify the result
    expect(result.contentType).toBe("image/png");
    expect(new Uint8Array(result.data)).toEqual(imageData);
  });

  it("uses Basic auth with accountSid:authToken", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(new Uint8Array([0x01]), {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      })
    );

    await downloadTwilioMedia(VALID_MEDIA_URL, VALID_CONFIG);

    const options = fetchSpy.mock.calls[0][1] as RequestInit;
    const authHeader = (options.headers as Record<string, string>).Authorization;
    const encoded = authHeader.replace("Basic ", "");
    const decoded = atob(encoded);
    expect(decoded).toBe(
      `${VALID_CONFIG.accountSid}:${VALID_CONFIG.authToken}`
    );
  });

  // ── Content-Type ─────────────────────────────────────────────────────────

  it("returns the content type from the response headers", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(new Uint8Array([0x01]), {
        status: 200,
        headers: { "Content-Type": "video/mp4" },
      })
    );

    const result = await downloadTwilioMedia(VALID_MEDIA_URL, VALID_CONFIG);
    expect(result.contentType).toBe("video/mp4");
  });

  it("defaults to application/octet-stream when Content-Type header is missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(new Uint8Array([0x01, 0x02, 0x03]), {
        status: 200,
        // No Content-Type header
      })
    );

    const result = await downloadTwilioMedia(VALID_MEDIA_URL, VALID_CONFIG);
    expect(result.contentType).toBe("application/octet-stream");
    expect(result.data.byteLength).toBe(3);
  });

  // ── Error handling ────────────────────────────────────────────────────────

  it("throws when Twilio API returns non-OK status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Not Found", {
        status: 404,
        headers: { "Content-Type": "text/plain" },
      })
    );

    await expect(
      downloadTwilioMedia(VALID_MEDIA_URL, VALID_CONFIG)
    ).rejects.toThrow("404");
  });

  it("throws when Twilio API returns 401 (unauthorized)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Unauthorized", {
        status: 401,
        headers: { "Content-Type": "text/plain" },
      })
    );

    await expect(
      downloadTwilioMedia(VALID_MEDIA_URL, VALID_CONFIG)
    ).rejects.toThrow("401");
  });

  it("throws when Twilio API returns 403 (forbidden)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Forbidden", {
        status: 403,
        headers: { "Content-Type": "text/plain" },
      })
    );

    await expect(
      downloadTwilioMedia(VALID_MEDIA_URL, VALID_CONFIG)
    ).rejects.toThrow("403");
  });

  it("handles network failure gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network error")
    );

    await expect(
      downloadTwilioMedia(VALID_MEDIA_URL, VALID_CONFIG)
    ).rejects.toThrow("Erreur réseau");
  });

  it("handles non-Error rejection (string) in network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      "String error"
    );

    await expect(
      downloadTwilioMedia(VALID_MEDIA_URL, VALID_CONFIG)
    ).rejects.toThrow("Erreur réseau");
  });

  // ── Input validation ─────────────────────────────────────────────────────

  it("throws for empty media URL", async () => {
    await expect(
      downloadTwilioMedia("", VALID_CONFIG)
    ).rejects.toThrow("L'URL du média ne peut pas être vide.");
  });

  it("throws for invalid media URL format", async () => {
    await expect(
      downloadTwilioMedia("https://example.com/not-twilio", VALID_CONFIG)
    ).rejects.toThrow("URL de média Twilio invalide");
  });

  it("throws for null media URL", async () => {
    await expect(
      downloadTwilioMedia(null as unknown as string, VALID_CONFIG)
    ).rejects.toThrow();
  });

  // ── Media URL format variants ────────────────────────────────────────────

  it("handles http (non-https) Twilio media URL", async () => {
    const httpUrl =
      "http://api.twilio.com/2010-04-01/Accounts/ACxxx/Messages/SMxxx/Media/MExxx";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(new Uint8Array([0x01]), {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      })
    );

    const result = await downloadTwilioMedia(httpUrl, VALID_CONFIG);
    expect(result).toBeDefined();
    expect(result.contentType).toBe("image/jpeg");
  });

  it("handles media URL with different Account SID", async () => {
    const url =
      "https://api.twilio.com/2010-04-01/Accounts/ACdifferent/Messages/SMother/Media/MEother";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(new Uint8Array([0x01]), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      })
    );

    const result = await downloadTwilioMedia(url, VALID_CONFIG);
    expect(result.contentType).toBe("image/png");
    expect(fetchSpy.mock.calls[0][0] as string).toBe(url);
  });

  it("adds follow redirect by default", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(new Uint8Array([0x01]), {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      })
    );

    await downloadTwilioMedia(VALID_MEDIA_URL, VALID_CONFIG);

    const options = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(options.redirect).toBe("follow");
  });
});
