/**
 * Tests for supabase/functions/_shared/send-twilio.ts
 *
 * Tests the shared Twilio API client that Edge Functions use
 * for direct Twilio SMS sending (replacing the Lovable gateway).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  sendSmsViaTwilio,
  type SendTwilioParams,
  type SendTwilioConfig,
} from "../../supabase/functions/_shared/send-twilio";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_PARAMS: SendTwilioParams = {
  to: "+15147088976",
  message: "Bonjour, ceci est un test Edge Function.",
};

const VALID_CONFIG: SendTwilioConfig = {
  accountSid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  authToken: "sk_test_1234567890abcdef",
  fromNumber: "+15105551234",
};

// ─── sendSmsViaTwilio ─────────────────────────────────────────────────────────

describe("sendSmsViaTwilio", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it("calls Twilio API directly (not connector-gateway)", async () => {
    const mockSid = "SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ sid: mockSid, status: "queued" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );

    await sendSmsViaTwilio(VALID_PARAMS, VALID_CONFIG);

    // Verify the URL is the direct Twilio API, not the Lovable gateway
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain("api.twilio.com");
    expect(calledUrl).not.toContain("connector-gateway.lovable.dev");
    expect(calledUrl).toContain(
      `/Accounts/${VALID_CONFIG.accountSid}/Messages.json`
    );
  });

  it("uses Basic auth (not Bearer token)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ sid: "SMtest", status: "queued" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );

    await sendSmsViaTwilio(VALID_PARAMS, VALID_CONFIG);

    const headers = fetchSpy.mock.calls[0][1] as RequestInit;
    const authHeader = (headers.headers as Record<string, string>).Authorization;
    expect(authHeader).toMatch(/^Basic /);
    expect(authHeader).not.toMatch(/^Bearer /);
  });

  it("returns success response with sid and status", async () => {
    const mockSid = "SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ sid: mockSid, status: "queued" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await sendSmsViaTwilio(VALID_PARAMS, VALID_CONFIG);

    expect(result.success).toBe(true);
    expect(result.sid).toBe(mockSid);
    expect(result.status).toBe("queued");
    expect(result.error).toBeUndefined();
    expect(result.errorCode).toBeUndefined();
  });

  // ── MMS support ──────────────────────────────────────────────────────────

  it("sends MMS with media URLs", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ sid: "SMmms12345", status: "queued" }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      )
    );

    const mmsParams: SendTwilioParams = {
      ...VALID_PARAMS,
      mediaUrls: [
        "https://example.com/photo1.jpg",
        "https://example.com/photo2.jpg",
      ],
    };
    const result = await sendSmsViaTwilio(mmsParams, VALID_CONFIG);
    expect(result.success).toBe(true);
    expect(result.sid).toBe("SMmms12345");
  });

  it("includes MediaUrl fields in the request body", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ sid: "SMmms", status: "queued" }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      )
    );

    await sendSmsViaTwilio(
      {
        ...VALID_PARAMS,
        mediaUrls: ["https://example.com/img.jpg"],
      },
      VALID_CONFIG
    );

    const body = fetchSpy.mock.calls[0][1] as RequestInit;
    const bodyStr = (body.body as URLSearchParams).toString();
    expect(bodyStr).toContain("MediaUrl=https%3A%2F%2Fexample.com%2Fimg.jpg");
  });

  // ── Error handling ────────────────────────────────────────────────────────

  it("returns error response when Twilio API returns an error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 21211,
          message: "The 'To' number is not a valid phone number.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await sendSmsViaTwilio(
      { ...VALID_PARAMS, to: "+15005550006" },
      VALID_CONFIG
    );

    expect(result.success).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.error).toContain("not a valid phone number");
    expect(result.errorCode).toBe(21211);
  });

  it("handles non-JSON Twilio error response gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Service Unavailable", {
        status: 503,
        headers: { "Content-Type": "text/plain" },
      })
    );

    const result = await sendSmsViaTwilio(VALID_PARAMS, VALID_CONFIG);

    expect(result.success).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.error).toContain("503");
  });

  it("handles network failure gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("fetch failed")
    );

    await expect(
      sendSmsViaTwilio(VALID_PARAMS, VALID_CONFIG)
    ).rejects.toThrow("Erreur réseau");
  });

  // ── Validation ───────────────────────────────────────────────────────────

  it("throws when 'to' is missing", async () => {
    await expect(
      sendSmsViaTwilio(
        { ...VALID_PARAMS, to: "" },
        VALID_CONFIG
      )
    ).rejects.toThrow("Le numéro de destination (to) est requis.");
  });

  it("throws when both message and mediaUrls are missing", async () => {
    await expect(
      sendSmsViaTwilio(
        { to: "+15147088976", mediaUrls: [] },
        VALID_CONFIG
      )
    ).rejects.toThrow(
      "Un message textuel (message) ou au moins un média (mediaUrls) est requis."
    );
  });

  it("normalizes the destination phone number to E.164", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ sid: "SMnorm", status: "queued" }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      )
    );

    await sendSmsViaTwilio(
      { ...VALID_PARAMS, to: "(514) 708-8976" },
      VALID_CONFIG
    );

    const body = fetchSpy.mock.calls[0][1] as RequestInit;
    const bodyStr = (body.body as URLSearchParams).toString();
    expect(bodyStr).toContain("To=%2B15147088976");
  });

  // ── Phone normalization branches ─────────────────────────────────────────

  it("throws for phone with too few digits after normalization", async () => {
    // This tests the normalizePhone digits.length < 4 branch (line 78)
    await expect(
      sendSmsViaTwilio(
        { ...VALID_PARAMS, to: "abc" },
        VALID_CONFIG
      )
    ).rejects.toThrow("invalide");
  });

  it("normalizes 11-digit number starting with 1 without +", async () => {
    // This tests the normalizePhone 11-digit branch (lines 85-86)
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ sid: "SM11dig", status: "queued" }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      )
    );

    await sendSmsViaTwilio(
      { ...VALID_PARAMS, to: "15147088976" },
      VALID_CONFIG
    );

    const body = fetchSpy.mock.calls[0][1] as RequestInit;
    const bodyStr = (body.body as URLSearchParams).toString();
    expect(bodyStr).toContain("To=%2B15147088976");
  });

  it("normalizes international number without + prefix", async () => {
    // This tests the normalizePhone fallback branch (lines 92-93)
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ sid: "SMintl", status: "queued" }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      )
    );

    await sendSmsViaTwilio(
      { ...VALID_PARAMS, to: "33612345678" },
      VALID_CONFIG
    );

    const body = fetchSpy.mock.calls[0][1] as RequestInit;
    const bodyStr = (body.body as URLSearchParams).toString();
    expect(bodyStr).toContain("To=%2B33612345678");
  });

  // ── Content-Type ─────────────────────────────────────────────────────────

  it("sends request with application/x-www-form-urlencoded Content-Type", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ sid: "SMct", status: "queued" }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      )
    );

    await sendSmsViaTwilio(VALID_PARAMS, VALID_CONFIG);

    const headers = fetchSpy.mock.calls[0][1] as RequestInit;
    const ctHeader = (headers.headers as Record<string, string>)["Content-Type"];
    expect(ctHeader).toBe("application/x-www-form-urlencoded");
  });
});
