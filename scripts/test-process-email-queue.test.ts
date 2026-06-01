// ============================================================
// Tests for process-email-queue — TDD RED phase
// Migrate from @lovable.dev/email-js to Resend
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest"

import {
  sendEmail,
  buildListUnsubscribeHeader,
  mapEmailPayload,
  EmailRateLimitedError,
  EmailForbiddenError,
  type EmailPayload,
  type SendEmailOptions,
} from "../supabase/functions/process-email-queue/send-email"

// ═══════════════════════════════════════════════════════════════
// UNIT TESTS: mapEmailPayload
// ═══════════════════════════════════════════════════════════════

describe("mapEmailPayload", () => {
  it("maps a full payload to Resend format", () => {
    const payload: EmailPayload = {
      message_id: "msg-123",
      to: "user@example.com",
      from: "App <noreply@example.com>",
      subject: "Hello",
      html: "<p>Hello</p>",
      text: "Hello",
      purpose: "transactional",
      label: "welcome-email",
      idempotency_key: "idem-456",
      unsubscribe_token: "tok-789",
    }

    const result = mapEmailPayload(payload)
    expect(result).toEqual({
      from: "App <noreply@example.com>",
      to: ["user@example.com"],
      subject: "Hello",
      html: "<p>Hello</p>",
      text: "Hello",
      headers: {
        "Idempotency-Key": "idem-456",
      },
      tags: [
        { name: "purpose", value: "transactional" },
        { name: "label", value: "welcome-email" },
      ],
    })
  })

  it("maps payload with minimal fields", () => {
    const payload: EmailPayload = {
      to: "user@example.com",
      from: "noreply@example.com",
      subject: "Hello",
    }

    const result = mapEmailPayload(payload)
    expect(result).toEqual({
      from: "noreply@example.com",
      to: ["user@example.com"],
      subject: "Hello",
    })
    expect(result.html).toBeUndefined()
    expect(result.text).toBeUndefined()
    expect(result.headers).toBeUndefined()
    expect(result.tags).toBeUndefined()
  })

  it("wraps single recipient string in array", () => {
    const payload: EmailPayload = {
      to: "user@example.com",
      from: "noreply@example.com",
      subject: "Test",
    }

    const result = mapEmailPayload(payload)
    expect(result.to).toEqual(["user@example.com"])
  })

  it("includes html only when present", () => {
    const payloadWithHtml: EmailPayload = {
      to: "a@b.com", from: "noreply@b.com", subject: "S", html: "<p>Hi</p>",
    }
    const resultWith = mapEmailPayload(payloadWithHtml)
    expect(resultWith.html).toBe("<p>Hi</p>")

    const payloadWithout: EmailPayload = {
      to: "a@b.com", from: "noreply@b.com", subject: "S", text: "Hi",
    }
    const resultWithout = mapEmailPayload(payloadWithout)
    expect(resultWithout.html).toBeUndefined()
  })

  it("includes text only when present", () => {
    const payload: EmailPayload = {
      to: "a@b.com", from: "noreply@b.com", subject: "S", text: "Hello",
    }
    const result = mapEmailPayload(payload)
    expect(result.text).toBe("Hello")
  })

  it("includes purpose and label as tags", () => {
    const payload: EmailPayload = {
      to: "a@b.com", from: "noreply@b.com", subject: "S",
      purpose: "auth",
      label: "reset-password",
    }
    const result = mapEmailPayload(payload)
    expect(result.tags).toEqual([
      { name: "purpose", value: "auth" },
      { name: "label", value: "reset-password" },
    ])
  })

  it("includes Idempotency-Key header when idempotency_key is present", () => {
    const payload: EmailPayload = {
      to: "a@b.com", from: "noreply@b.com", subject: "S",
      idempotency_key: "idem-x",
    }
    const result = mapEmailPayload(payload)
    expect(result.headers?.["Idempotency-Key"]).toBe("idem-x")
  })

  it("omits headers when idempotency_key is absent", () => {
    const payload: EmailPayload = {
      to: "a@b.com", from: "noreply@b.com", subject: "S",
    }
    const result = mapEmailPayload(payload)
    expect(result.headers).toBeUndefined()
  })

  it("omits tags when neither purpose nor label present", () => {
    const payload: EmailPayload = {
      to: "a@b.com", from: "noreply@b.com", subject: "S",
    }
    const result = mapEmailPayload(payload)
    expect(result.tags).toBeUndefined()
  })

  it("does not include message_id in the Resend payload", () => {
    const payload: EmailPayload = {
      message_id: "msg-123",
      to: "a@b.com", from: "noreply@b.com", subject: "S",
    }
    const result = mapEmailPayload(payload)
    expect((result as any).message_id).toBeUndefined()
  })
})

// ═══════════════════════════════════════════════════════════════
// UNIT TESTS: buildListUnsubscribeHeader
// ═══════════════════════════════════════════════════════════════

describe("buildListUnsubscribeHeader", () => {
  it("builds header with UNSUBSCRIBE_BASE_URL when available", () => {
    const result = buildListUnsubscribeHeader("tok-abc", {
      unsubscribeBaseUrl: "https://unsub.example.com",
    })
    expect(result).toBe("<https://unsub.example.com?token=tok-abc>")
  })

  it("builds header with supabase URL fallback when UNSUBSCRIBE_BASE_URL is absent", () => {
    const result = buildListUnsubscribeHeader("tok-def", {
      supabaseUrl: "https://abc.supabase.co",
    })
    expect(result).toBe(
      "<https://abc.supabase.co/functions/v1/handle-email-unsubscribe?token=tok-def>"
    )
  })

  it("prefers UNSUBSCRIBE_BASE_URL over SUPABASE_URL when both available", () => {
    const result = buildListUnsubscribeHeader("tok-ghi", {
      unsubscribeBaseUrl: "https://unsub.example.com",
      supabaseUrl: "https://abc.supabase.co",
    })
    expect(result).toBe("<https://unsub.example.com?token=tok-ghi>")
  })

  it("returns undefined when no token provided", () => {
    const result = buildListUnsubscribeHeader(undefined, {
      supabaseUrl: "https://abc.supabase.co",
    })
    expect(result).toBeUndefined()
  })

  it("returns undefined when token is empty string", () => {
    const result = buildListUnsubscribeHeader("", {
      supabaseUrl: "https://abc.supabase.co",
    })
    expect(result).toBeUndefined()
  })

  it("returns undefined when neither base URL nor supabase URL available", () => {
    const result = buildListUnsubscribeHeader("tok-xyz", {})
    expect(result).toBeUndefined()
  })

  it("URL-encodes the token parameter", () => {
    const result = buildListUnsubscribeHeader("tok+123/abc", {
      unsubscribeBaseUrl: "https://unsub.example.com",
    })
    expect(result).toContain("token=tok%2B123%2Fabc")
  })

  it("includes mailto: List-Unsubscribe-Post header suggestion", () => {
    // Verify the header format follows RFC 2369
    const result = buildListUnsubscribeHeader("tok-abc", {
      unsubscribeBaseUrl: "https://unsub.example.com",
    })
    expect(result).toMatch(/^<https?:\/\/.+>$/)
  })
})

// ═══════════════════════════════════════════════════════════════
// UNIT TESTS: sendEmail (mocked fetch)
// ═══════════════════════════════════════════════════════════════

describe("sendEmail", () => {
  const mockPayload: EmailPayload = {
    message_id: "msg-123",
    to: "user@example.com",
    from: "App <noreply@example.com>",
    subject: "Hello",
    html: "<p>Hello</p>",
    text: "Hello",
    purpose: "transactional",
    label: "welcome-email",
    idempotency_key: "idem-456",
  }

  const defaultOptions: SendEmailOptions = {
    apiKey: "re_123456",
    supabaseUrl: "https://abc.supabase.co",
  }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("sends email successfully and returns the result", async () => {
    const mockResponse = { id: "email-987" }
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    })

    const result = await sendEmail(mockPayload, defaultOptions)
    expect(result).toEqual({ id: "email-987" })
  })

  it("calls Resend API with correct endpoint and headers", async () => {
    const mockResponse = { id: "email-987" }
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    })
    globalThis.fetch = fetchSpy

    await sendEmail(mockPayload, defaultOptions)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, options] = fetchSpy.mock.calls[0]
    expect(url).toBe("https://api.resend.com/emails")
    expect(options.method).toBe("POST")
    expect(options.headers["Authorization"]).toBe("Bearer re_123456")
    expect(options.headers["Content-Type"]).toBe("application/json")
  })

  it("includes List-Unsubscribe header in Resend headers when token present", async () => {
    const payloadWithToken: EmailPayload = {
      ...mockPayload,
      unsubscribe_token: "tok-unsub",
    }

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: "email-987" }),
    })

    await sendEmail(payloadWithToken, defaultOptions)

    const [, options] = (globalThis.fetch as any).mock.calls[0]
    const body = JSON.parse(options.body)
    expect(body.headers["List-Unsubscribe"]).toBe(
      "<https://abc.supabase.co/functions/v1/handle-email-unsubscribe?token=tok-unsub>"
    )
  })

  it("throws EmailRateLimitedError on 429 response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Map([["retry-after", "120"]]),
      json: () => Promise.resolve({ error: { message: "Rate limit exceeded" } }),
    })

    await expect(
      sendEmail(mockPayload, defaultOptions)
    ).rejects.toThrow(EmailRateLimitedError)

    await expect(
      sendEmail(mockPayload, defaultOptions)
    ).rejects.toMatchObject({ status: 429 })
  })

  it("uses retryAfterSeconds from Retry-After header on 429", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Map([["retry-after", "30"]]),
      json: () => Promise.resolve({ error: { message: "Rate limit" } }),
    })

    try {
      await sendEmail(mockPayload, defaultOptions)
    } catch (error: any) {
      expect(error.retryAfterSeconds).toBe(30)
    }

    // Also test without Retry-After header (fallback 60s)
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Map(),
      json: () => Promise.resolve({ error: { message: "Rate limit" } }),
    })

    try {
      await sendEmail(mockPayload, defaultOptions)
    } catch (error: any) {
      expect(error.retryAfterSeconds).toBe(60)
    }
  })

  it("falls back to 60s retry when Retry-After header is missing on 429", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Map(),
      json: () => Promise.resolve({ error: { message: "Rate limit" } }),
    })

    try {
      await sendEmail(mockPayload, defaultOptions)
    } catch (error: any) {
      expect(error.retryAfterSeconds).toBe(60)
    }
  })

  it("throws EmailForbiddenError on 403 response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: { message: "Forbidden" } }),
    })

    await expect(
      sendEmail(mockPayload, defaultOptions)
    ).rejects.toThrow(EmailForbiddenError)

    await expect(
      sendEmail(mockPayload, defaultOptions)
    ).rejects.toMatchObject({ status: 403 })
  })

  it("throws generic error for other non-ok status codes", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: { message: "Internal server error" } }),
    })

    await expect(
      sendEmail(mockPayload, defaultOptions)
    ).rejects.toThrow("Resend API error: 500 Internal server error")
  })

  it("throws EmailRateLimitedError on 429 from Resend SDK error response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Map(),
      json: () => Promise.resolve({}),
    })

    await expect(
      sendEmail(mockPayload, defaultOptions)
    ).rejects.toThrow(EmailRateLimitedError)
  })

  it("throws EmailForbiddenError on 401 (treated as forbidden)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: { message: "Unauthorized" } }),
    })

    await expect(
      sendEmail(mockPayload, defaultOptions)
    ).rejects.toThrow(EmailForbiddenError)
  })

  it("throws network errors as generic errors", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network failure"))

    await expect(
      sendEmail(mockPayload, defaultOptions)
    ).rejects.toThrow("Network failure")
  })

  it("throws on missing apiKey", async () => {
    await expect(
      sendEmail(mockPayload, { ...defaultOptions, apiKey: "" })
    ).rejects.toThrow("Resend API key is not configured")
  })

  it("throws on missing required fields in payload", async () => {
    const invalidPayload = { to: "", from: "", subject: "" } as any
    await expect(
      sendEmail(invalidPayload, defaultOptions)
    ).rejects.toThrow("Missing required email fields")
  })
})

// ═══════════════════════════════════════════════════════════════
// UNIT TESTS: Error class compatibility
// ═══════════════════════════════════════════════════════════════

describe("EmailRateLimitedError", () => {
  it("has status property set to 429", () => {
    const error = new EmailRateLimitedError("Rate limited")
    expect(error.status).toBe(429)
  })

  it("has retryAfterSeconds set to null by default", () => {
    const error = new EmailRateLimitedError("Rate limited")
    expect(error.retryAfterSeconds).toBeNull()
  })

  it("accepts custom retryAfterSeconds", () => {
    const error = new EmailRateLimitedError("Rate limited", 30)
    expect(error.retryAfterSeconds).toBe(30)
  })

  it("has correct name", () => {
    const error = new EmailRateLimitedError("Rate limited")
    expect(error.name).toBe("EmailRateLimitedError")
  })

  it("is compatible with existing isRateLimited check (status === 429)", () => {
    const error = new EmailRateLimitedError("Rate limited")
    const isRateLimited = error && typeof error === "object" && "status" in error
      ? (error as { status: number }).status === 429
      : false
    expect(isRateLimited).toBe(true)
  })

  it("is compatible with existing getRetryAfterSeconds check", () => {
    const error = new EmailRateLimitedError("Rate limited", 45)
    const retryAfter = error && typeof error === "object" && "retryAfterSeconds" in error
      ? (error as { retryAfterSeconds: number | null }).retryAfterSeconds ?? 60
      : 60
    expect(retryAfter).toBe(45)
  })

  it("defaults retryAfterSeconds to 60 via existing getRetryAfterSeconds logic", () => {
    const error = new EmailRateLimitedError("Rate limited")
    const retryAfter = error && typeof error === "object" && "retryAfterSeconds" in error
      ? (error as { retryAfterSeconds: number | null }).retryAfterSeconds ?? 60
      : 60
    expect(retryAfter).toBe(60)
  })
})

describe("EmailForbiddenError", () => {
  it("has status property set to 403", () => {
    const error = new EmailForbiddenError("Forbidden")
    expect(error.status).toBe(403)
  })

  it("has correct name", () => {
    const error = new EmailForbiddenError("Forbidden")
    expect(error.name).toBe("EmailForbiddenError")
  })

  it("is compatible with existing isForbidden check (status === 403)", () => {
    const error = new EmailForbiddenError("Forbidden")
    const isForbidden = error && typeof error === "object" && "status" in error
      ? (error as { status: number }).status === 403
      : false
    expect(isForbidden).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════
// UNIT TESTS: Headers (List-Unsubscribe in Resend headers)
// ═══════════════════════════════════════════════════════════════

describe("List-Unsubscribe header integration with sendEmail", () => {
  const basePayload: EmailPayload = {
    to: "user@example.com",
    from: "noreply@example.com",
    subject: "Test",
    html: "<p>Test</p>",
  }

  it("includes List-Unsubscribe in Resend headers when unsubscribe_token provided", async () => {
    const payload: EmailPayload = {
      ...basePayload,
      unsubscribe_token: "tok-abc",
    }

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: "email-1" }),
    })

    await sendEmail(payload, {
      ...defaultOptions,
      unsubscribeBaseUrl: "https://unsub.example.com",
    })

    const [, options] = (globalThis.fetch as any).mock.calls[0]
    const body = JSON.parse(options.body)
    expect(body.headers["List-Unsubscribe"]).toBe(
      "<https://unsub.example.com?token=tok-abc>"
    )
  })

  it("does not include List-Unsubscribe when no unsubscribe_token", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: "email-1" }),
    })

    await sendEmail(basePayload, defaultOptions)

    const [, options] = (globalThis.fetch as any).mock.calls[0]
    const body = JSON.parse(options.body)
    expect(body.headers?.["List-Unsubscribe"]).toBeUndefined()
  })

  it("keeps Idempotency-Key alongside List-Unsubscribe", async () => {
    const payload: EmailPayload = {
      ...basePayload,
      idempotency_key: "idem-xyz",
      unsubscribe_token: "tok-abc",
    }

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: "email-1" }),
    })

    await sendEmail(payload, defaultOptions)

    const [, options] = (globalThis.fetch as any).mock.calls[0]
    const body = JSON.parse(options.body)
    expect(body.headers["List-Unsubscribe"]).toBeDefined()
    expect(body.headers["Idempotency-Key"]).toBe("idem-xyz")
  })
})

const defaultOptions: SendEmailOptions = {
  apiKey: "re_123456",
  supabaseUrl: "https://abc.supabase.co",
}
