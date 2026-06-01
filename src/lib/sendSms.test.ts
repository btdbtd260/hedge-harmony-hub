import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  normalizePhoneNumber,
  validateSmsInput,
  buildTwilioAuthHeader,
  buildTwilioFormBody,
  sendSms,
  type SendSmsParams,
  type TwilioConfig,
} from "@/lib/sendSms";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_PARAMS: SendSmsParams = {
  to: "+15147088976",
  message: "Bonjour, ceci est un test.",
  clientId: "550e8400-e29b-41d4-a716-446655440000",
};

const VALID_CONFIG: TwilioConfig = {
  accountSid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  authToken: "sk_test_1234567890abcdef",
  fromNumber: "+15105551234",
};

// ─── normalizePhoneNumber ─────────────────────────────────────────────────────

describe("normalizePhoneNumber", () => {
  it("throws for null input", () => {
    expect(() => normalizePhoneNumber(null as unknown as string)).toThrow(
      "Le numéro de téléphone ne peut pas être vide."
    );
  });

  it("throws for undefined input", () => {
    expect(() => normalizePhoneNumber(undefined as unknown as string)).toThrow(
      "Le numéro de téléphone ne peut pas être vide."
    );
  });

  it("throws for empty string", () => {
    expect(() => normalizePhoneNumber("")).toThrow(
      "Le numéro de téléphone ne peut pas être vide."
    );
  });

  it("throws for string with only spaces", () => {
    // "   " → "" après strip → < 4 chiffres → "invalide"
    expect(() => normalizePhoneNumber("   ")).toThrow("invalide");
  });

  it("adds +1 to a 10-digit Canadian number", () => {
    expect(normalizePhoneNumber("5147088976")).toBe("+15147088976");
  });

  it("adds + to an 11-digit number starting with 1", () => {
    expect(normalizePhoneNumber("15147088976")).toBe("+15147088976");
  });

  it("preserves an already-formatted E.164 number", () => {
    expect(normalizePhoneNumber("+15147088976")).toBe("+15147088976");
  });

  it("strips spaces from a formatted number", () => {
    expect(normalizePhoneNumber("+1 514 708 8976")).toBe("+15147088976");
  });

  it("strips dashes from a formatted number", () => {
    expect(normalizePhoneNumber("514-708-8976")).toBe("+15147088976");
  });

  it("strips parentheses and spaces from (514) 708-8976", () => {
    // "(514) 708-8976" → 10 digits "5147088976" → +15147088976
    expect(normalizePhoneNumber("(514) 708-8976")).toBe("+15147088976");
  });

  it("strips dots from a dotted number", () => {
    expect(normalizePhoneNumber("514.708.8976")).toBe("+15147088976");
  });

  it("handles international number with + prefix", () => {
    expect(normalizePhoneNumber("+33612345678")).toBe("+33612345678");
  });

  it("handles international number without + prefix", () => {
    // 33612345678 → 11 digits, doesn't start with 1 → just add +
    expect(normalizePhoneNumber("33612345678")).toBe("+33612345678");
  });

  it("throws for string with fewer than 4 digits", () => {
    expect(() => normalizePhoneNumber("123")).toThrow("invalide");
  });

  it("handles number with leading country code 1 without +", () => {
    expect(normalizePhoneNumber("14155551234")).toBe("+14155551234");
  });

  it("handles number with extension by stripping letters", () => {
    // "5147088976 x123" → digits "5147088976123" (13 digits, pas 10/11) → "+5147088976123"
    // L'extension n'est pas interprétée ; le caller doit la nettoyer au préalable.
    const result = normalizePhoneNumber("5147088976 x123");
    expect(result).toBe("+5147088976123");
  });

  it("preserves the plus sign when already in E.164 with country code", () => {
    expect(normalizePhoneNumber("+447911123456")).toBe("+447911123456");
  });

  it("throws for a string with no digits at all", () => {
    // "abc-xyz" → "" après strip → < 4 chiffres → "invalide"
    expect(() => normalizePhoneNumber("abc-xyz")).toThrow("invalide");
  });

  it("handles a number with leading +1 and dashes", () => {
    expect(normalizePhoneNumber("+1-514-708-8976")).toBe("+15147088976");
  });
});

// ─── validateSmsInput ─────────────────────────────────────────────────────────

describe("validateSmsInput", () => {
  it("returns valid for complete valid input", () => {
    const result = validateSmsInput(VALID_PARAMS);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns valid when only mediaUrls provided without message", () => {
    const result = validateSmsInput({
      to: "+15147088976",
      clientId: "550e8400-e29b-41d4-a716-446655440000",
      mediaUrls: ["https://example.com/photo.jpg"],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns error for empty to", () => {
    const result = validateSmsInput({
      ...VALID_PARAMS,
      to: "",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Le numéro de destination (to) est requis.");
  });

  it("returns error for null to", () => {
    const result = validateSmsInput({
      ...VALID_PARAMS,
      to: null as unknown as string,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("returns error for undefined to", () => {
    const result = validateSmsInput({
      ...VALID_PARAMS,
      to: undefined as unknown as string,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("returns error for invalid phone number (too few digits)", () => {
    const result = validateSmsInput({
      ...VALID_PARAMS,
      to: "abc",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Le numéro de téléphone doit contenir au moins 4 chiffres après normalisation."
    );
  });

  it("returns error for empty clientId", () => {
    const result = validateSmsInput({
      ...VALID_PARAMS,
      clientId: "",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "L'identifiant client (clientId) est requis."
    );
  });

  it("returns error for missing clientId", () => {
    const result = validateSmsInput({
      ...VALID_PARAMS,
      clientId: null as unknown as string,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("returns error when both message and mediaUrls are missing", () => {
    const result = validateSmsInput({
      to: "+15147088976",
      clientId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Un message textuel (message) ou au moins un média (mediaUrls) est requis."
    );
  });

  it("returns error when message is empty and mediaUrls is empty array", () => {
    const result = validateSmsInput({
      ...VALID_PARAMS,
      message: "",
      mediaUrls: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Un message textuel (message) ou au moins un média (mediaUrls) est requis."
    );
  });

  it("returns multiple errors when several fields are missing", () => {
    const result = validateSmsInput({} as SendSmsParams);
    expect(result.valid).toBe(false);
    // Should have at least 2 errors (missing to, missing clientId, maybe no content)
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
    expect(result.errors).toContain(
      "Le numéro de destination (to) est requis."
    );
    expect(result.errors).toContain(
      "L'identifiant client (clientId) est requis."
    );
  });

  it("returns only one error per issue (no duplicates)", () => {
    const result = validateSmsInput({
      ...VALID_PARAMS,
      to: "",
      clientId: "",
    });
    // Count occurrences of each error
    const toErrors = result.errors.filter(
      (e) => e === "Le numéro de destination (to) est requis."
    );
    expect(toErrors).toHaveLength(1);
  });
});

// ─── buildTwilioAuthHeader ─────────────────────────────────────────────────────

describe("buildTwilioAuthHeader", () => {
  it("returns a valid Basic auth header", () => {
    const header = buildTwilioAuthHeader(VALID_CONFIG);
    expect(header).toMatch(/^Basic /);
    const encoded = header.replace("Basic ", "");
    const decoded = atob(encoded);
    expect(decoded).toBe(
      `${VALID_CONFIG.accountSid}:${VALID_CONFIG.authToken}`
    );
  });

  it("produces different headers for different credentials", () => {
    const header1 = buildTwilioAuthHeader(VALID_CONFIG);
    const config2: TwilioConfig = {
      ...VALID_CONFIG,
      accountSid: "ACbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    };
    const header2 = buildTwilioAuthHeader(config2);
    expect(header1).not.toBe(header2);
  });

  it("handles empty accountSid gracefully", () => {
    const header = buildTwilioAuthHeader({
      accountSid: "",
      authToken: "token",
      fromNumber: "+15105551234",
    });
    expect(header).toBe("Basic " + btoa(":token"));
  });

  it("handles empty authToken gracefully", () => {
    const header = buildTwilioAuthHeader({
      accountSid: "AC123",
      authToken: "",
      fromNumber: "+15105551234",
    });
    expect(header).toBe("Basic " + btoa("AC123:"));
  });
});

// ─── buildTwilioFormBody ──────────────────────────────────────────────────────

describe("buildTwilioFormBody", () => {
  it("builds a form body with To, From, and Body", () => {
    const body = buildTwilioFormBody(VALID_PARAMS, VALID_CONFIG.fromNumber);
    expect(body.get("To")).toBe("+15147088976");
    expect(body.get("From")).toBe(VALID_CONFIG.fromNumber);
    expect(body.get("Body")).toBe(VALID_PARAMS.message);
    expect(body.get("MediaUrl")).toBeNull();
  });

  it("includes MediaUrl when provided", () => {
    const body = buildTwilioFormBody(
      {
        ...VALID_PARAMS,
        mediaUrls: [
          "https://example.com/image1.jpg",
          "https://example.com/image2.jpg",
        ],
      },
      VALID_CONFIG.fromNumber
    );
    const mediaUrls = body.getAll("MediaUrl");
    expect(mediaUrls).toHaveLength(2);
    expect(mediaUrls[0]).toBe("https://example.com/image1.jpg");
    expect(mediaUrls[1]).toBe("https://example.com/image2.jpg");
  });

  it("does not include Body when message is empty", () => {
    const body = buildTwilioFormBody(
      {
        ...VALID_PARAMS,
        message: "",
      },
      VALID_CONFIG.fromNumber
    );
    expect(body.get("Body")).toBeNull();
  });

  it("does not include MediaUrl when mediaUrls is empty array", () => {
    const body = buildTwilioFormBody(
      {
        ...VALID_PARAMS,
        mediaUrls: [],
      },
      VALID_CONFIG.fromNumber
    );
    expect(body.get("MediaUrl")).toBeNull();
  });

  it("does not include MediaUrl when mediaUrls is undefined", () => {
    const body = buildTwilioFormBody(VALID_PARAMS, VALID_CONFIG.fromNumber);
    expect(body.get("MediaUrl")).toBeNull();
  });

  it("normalizes the To number via normalizePhoneNumber", () => {
    const body = buildTwilioFormBody(
      { ...VALID_PARAMS, to: "514-708-8976" },
      VALID_CONFIG.fromNumber
    );
    expect(body.get("To")).toBe("+15147088976");
  });

  it("throws for invalid To number", () => {
    expect(() =>
      buildTwilioFormBody(
        { ...VALID_PARAMS, to: "" },
        VALID_CONFIG.fromNumber
      )
    ).toThrow();
  });
});

// ─── sendSms ─────────────────────────────────────────────────────────────────

describe("sendSms", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns success response when Twilio API accepts the message", async () => {
    const mockSid = "SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ sid: mockSid, status: "queued" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await sendSms(VALID_PARAMS, VALID_CONFIG);
    expect(response.success).toBe(true);
    expect(response.messageSid).toBe(mockSid);
    expect(response.status).toBe("queued");
    expect(response.error).toBeUndefined();
  });

  it("returns error response when Twilio API returns an error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 21211,
          message: "The 'To' number is not a valid phone number.",
          status: 400,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );

    const invalidParams: SendSmsParams = {
      ...VALID_PARAMS,
      to: "+15005550006",
    };
    const response = await sendSms(invalidParams, VALID_CONFIG);
    expect(response.success).toBe(false);
    expect(response.error).toContain("not a valid phone number");
    expect(response.errorCode).toBe(21211);
  });

  it("throws when input validation fails", async () => {
    const invalidParams = { ...VALID_PARAMS, to: "" };
    await expect(
      sendSms(invalidParams, VALID_CONFIG),
    ).rejects.toThrow("Le numéro de destination (to) est requis.");
  });

  it("returns error on network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("fetch failed"),
    );

    const response = await sendSms(VALID_PARAMS, VALID_CONFIG).catch(
      (e) => e,
    );
    expect(response).toBeInstanceOf(Error);
    expect(response.message).toContain("Erreur réseau");
  });

  it("sends MMS with media URLs", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ sid: "SMmms12345", status: "queued" }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );

    const mmsParams: SendSmsParams = {
      ...VALID_PARAMS,
      message: "Voici les photos :",
      mediaUrls: [
        "https://example.com/photo1.jpg",
        "https://example.com/photo2.jpg",
      ],
    };
    const response = await sendSms(mmsParams, VALID_CONFIG);
    expect(response.success).toBe(true);
    expect(response.messageSid).toBe("SMmms12345");
  });

  it("sends message without optional media URLs", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ sid: "SMplain123", status: "queued" }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );

    const response = await sendSms(
      { to: "+15147088976", message: "Test", clientId: "abc-123" },
      VALID_CONFIG,
    );
    expect(response.success).toBe(true);
    expect(response.messageSid).toBe("SMplain123");
  });
});
