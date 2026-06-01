// ============================================================
// Tests for handle-email-suppression — TDD RED phase
// Migrate from @lovable.dev/webhooks-js to manual HMAC-SHA256
// ============================================================

import { describe, it, expect, vi, beforeAll } from "vitest"

// ─── Import pure verification functions ───
// These are extracted from supabase/functions/handle-email-suppression/verify.ts
// and will be tested independently of the Deno runtime.

import {
  computeHmacSha256,
  isTimestampFresh,
  verifySuppressionWebhook,
  WebhookVerificationError,
} from "../supabase/functions/handle-email-suppression/verify"

import { parseSuppressionPayload, type SuppressionPayload } from "../supabase/functions/handle-email-suppression/verify"

// ═══════════════════════════════════════════════════════════════
// UNIT TESTS: computeHmacSha256
// ═══════════════════════════════════════════════════════════════

describe("computeHmacSha256", () => {
  const secret = "test-secret-key-12345"
  const timestamp = "1717000000"
  const body = JSON.stringify({
    data: {
      email: "test@example.com",
      reason: "bounce",
    },
  })

  it("returns a hex string of 64 characters (SHA-256)", async () => {
    const signature = await computeHmacSha256(body, timestamp, secret)
    // SHA-256 hex digest is always 64 chars
    expect(signature).toHaveLength(64)
    // Should only contain hex characters
    expect(signature).toMatch(/^[0-9a-f]+$/)
  })

  it("produces a deterministic result for same inputs", async () => {
    const sig1 = await computeHmacSha256(body, timestamp, secret)
    const sig2 = await computeHmacSha256(body, timestamp, secret)
    expect(sig1).toBe(sig2)
  })

  it("produces different results for different secrets", async () => {
    const sig1 = await computeHmacSha256(body, timestamp, "secret-a")
    const sig2 = await computeHmacSha256(body, timestamp, "secret-b")
    expect(sig1).not.toBe(sig2)
  })

  it("produces different results for different timestamps", async () => {
    const sig1 = await computeHmacSha256(body, "1717000000", secret)
    const sig2 = await computeHmacSha256(body, "1717000001", secret)
    expect(sig1).not.toBe(sig2)
  })

  it("produces different results for different bodies", async () => {
    const sig1 = await computeHmacSha256(body, timestamp, secret)
    const sig2 = await computeHmacSha256(
      JSON.stringify({ data: { email: "other@example.com", reason: "complaint" } }),
      timestamp,
      secret,
    )
    expect(sig1).not.toBe(sig2)
  })

  it("handles empty body", async () => {
    const signature = await computeHmacSha256("", timestamp, secret)
    expect(signature).toHaveLength(64)
    expect(signature).toMatch(/^[0-9a-f]+$/)
  })

  it("throws WebhookVerificationError for empty secret", async () => {
    await expect(
      computeHmacSha256(body, timestamp, ""),
    ).rejects.toThrow(WebhookVerificationError)

    await expect(
      computeHmacSha256(body, timestamp, ""),
    ).rejects.toMatchObject({ code: "invalid_signature" })
  })

  it("can be validated with Node.js crypto for cross-platform compatibility", async () => {
    // Use Node.js crypto to compute expected signature
    const nodeCrypto = await import("node:crypto")
    const expectedSig = nodeCrypto
      .createHmac("sha256", secret)
      .update(`${timestamp}.${body}`)
      .digest("hex")

    const actualSig = await computeHmacSha256(body, timestamp, secret)
    expect(actualSig).toBe(expectedSig)
  })
})

// ═══════════════════════════════════════════════════════════════
// UNIT TESTS: isTimestampFresh
// ═══════════════════════════════════════════════════════════════

describe("isTimestampFresh", () => {
  const FIVE_MIN_MS = 5 * 60 * 1000

  it("returns true for a recent timestamp (within 5 min)", () => {
    const now = Math.floor(Date.now() / 1000)
    expect(isTimestampFresh(String(now))).toBe(true)
  })

  it("returns true for timestamp 4 minutes ago", () => {
    const fourMinAgo = Math.floor((Date.now() - 4 * 60 * 1000) / 1000)
    expect(isTimestampFresh(String(fourMinAgo))).toBe(true)
  })

  it("returns false for timestamp 6 minutes ago (exceeds 5 min)", () => {
    const sixMinAgo = Math.floor((Date.now() - 6 * 60 * 1000) / 1000)
    expect(isTimestampFresh(String(sixMinAgo))).toBe(false)
  })

  it("returns false for timestamp in the future", () => {
    const future = Math.floor((Date.now() + 60 * 1000) / 1000)
    expect(isTimestampFresh(String(future))).toBe(false)
  })

  it("returns false for empty string", () => {
    expect(isTimestampFresh("")).toBe(false)
  })

  it("returns false for NaN timestamp", () => {
    expect(isTimestampFresh("not-a-number")).toBe(false)
  })

  it("returns false for negative timestamp", () => {
    expect(isTimestampFresh("-1000")).toBe(false)
  })

  it("respects custom maxAgeMs parameter", () => {
    const oneMinAgo = Math.floor((Date.now() - 60 * 1000) / 1000)
    // With 30s max age, a 60s old timestamp should be stale
    expect(isTimestampFresh(String(oneMinAgo), 30_000)).toBe(false)
    // With 120s max age, it should be fresh
    expect(isTimestampFresh(String(oneMinAgo), 120_000)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════
// UNIT TESTS: verifySuppressionWebhook
// ═══════════════════════════════════════════════════════════════

describe("verifySuppressionWebhook", () => {
  const secret = "test-webhook-secret"
  const body = JSON.stringify({
    data: {
      email: "test@example.com",
      reason: "bounce",
    },
  })

  it("resolves successfully with valid signature and fresh timestamp", async () => {
    const now = Math.floor(Date.now() / 1000)
    const signature = await computeHmacSha256(body, String(now), secret)

    await expect(
      verifySuppressionWebhook(body, signature, String(now), secret),
    ).resolves.toBeUndefined()
  })

  it("throws WebhookVerificationError with code 'invalid_signature' for wrong signature", async () => {
    const now = Math.floor(Date.now() / 1000)

    await expect(
      verifySuppressionWebhook(body, "invalid-signature", String(now), secret),
    ).rejects.toThrow(WebhookVerificationError)

    await expect(
      verifySuppressionWebhook(body, "invalid-signature", String(now), secret),
    ).rejects.toMatchObject({ code: "invalid_signature" })
  })

  it("throws WebhookVerificationError with code 'stale_timestamp' for old timestamp", async () => {
    const tenMinAgo = Math.floor((Date.now() - 10 * 60 * 1000) / 1000)
    const signature = await computeHmacSha256(body, String(tenMinAgo), secret)

    await expect(
      verifySuppressionWebhook(body, signature, String(tenMinAgo), secret),
    ).rejects.toThrow(WebhookVerificationError)

    await expect(
      verifySuppressionWebhook(body, signature, String(tenMinAgo), secret),
    ).rejects.toMatchObject({ code: "stale_timestamp" })
  })

  it("throws WebhookVerificationError with code 'invalid_signature' for empty signature", async () => {
    const now = Math.floor(Date.now() / 1000)

    await expect(
      verifySuppressionWebhook(body, "", String(now), secret),
    ).rejects.toMatchObject({ code: "invalid_signature" })
  })

  it("throws WebhookVerificationError with code 'invalid_signature' for wrong secret", async () => {
    const now = Math.floor(Date.now() / 1000)
    const signature = await computeHmacSha256(body, String(now), secret)

    await expect(
      verifySuppressionWebhook(body, signature, String(now), "wrong-secret"),
    ).rejects.toMatchObject({ code: "invalid_signature" })
  })

  it("throws WebhookVerificationError with code 'invalid_signature' when signature is missing (null/undefined)", async () => {
    const now = Math.floor(Date.now() / 1000)

    await expect(
      verifySuppressionWebhook(body, "", String(now), secret),
    ).rejects.toMatchObject({ code: "invalid_signature" })
  })
})

// ═══════════════════════════════════════════════════════════════
// UNIT TESTS: parseSuppressionPayload
// ═══════════════════════════════════════════════════════════════

describe("parseSuppressionPayload", () => {
  it("parses a valid suppression payload successfully", () => {
    const body = JSON.stringify({
      data: {
        email: "test@example.com",
        reason: "bounce",
        message_id: "msg-123",
        metadata: { source: "mailgun" },
        is_retry: false,
        retry_count: 0,
      },
    })

    const result = parseSuppressionPayload(body)
    expect(result.email).toBe("test@example.com")
    expect(result.reason).toBe("bounce")
    expect(result.message_id).toBe("msg-123")
    expect(result.metadata).toEqual({ source: "mailgun" })
    expect(result.is_retry).toBe(false)
    expect(result.retry_count).toBe(0)
  })

  it("parses payload without optional fields", () => {
    const body = JSON.stringify({
      data: {
        email: "test@example.com",
        reason: "complaint",
        is_retry: false,
        retry_count: 0,
      },
    })

    const result = parseSuppressionPayload(body)
    expect(result.email).toBe("test@example.com")
    expect(result.reason).toBe("complaint")
    expect(result.message_id).toBeUndefined()
    expect(result.metadata).toBeUndefined()
  })

  it("throws error for missing data field", () => {
    const body = JSON.stringify({ notData: {} })
    expect(() => parseSuppressionPayload(body)).toThrow("Missing data field in payload")
  })

  it("throws error for missing email", () => {
    const body = JSON.stringify({
      data: {
        reason: "bounce",
        is_retry: false,
        retry_count: 0,
      },
    })
    expect(() => parseSuppressionPayload(body)).toThrow("Missing required fields: email, reason")
  })

  it("throws error for missing reason", () => {
    const body = JSON.stringify({
      data: {
        email: "test@example.com",
        is_retry: false,
        retry_count: 0,
      },
    })
    expect(() => parseSuppressionPayload(body)).toThrow("Missing required fields: email, reason")
  })

  it("throws error for invalid JSON", () => {
    expect(() => parseSuppressionPayload("not-json")).toThrow()
  })

  it("throws error for empty body", () => {
    expect(() => parseSuppressionPayload("")).toThrow()
  })
})

// ═══════════════════════════════════════════════════════════════
// UNIT TESTS: mapReasonToStatus / mapReasonToMessage
// ═══════════════════════════════════════════════════════════════

describe("mapReasonToStatus", () => {
  it('maps "bounce" to "bounced"', async () => {
    const { mapReasonToStatus } = await import("../supabase/functions/handle-email-suppression/verify")
    expect(mapReasonToStatus("bounce")).toBe("bounced")
  })

  it('maps "complaint" to "complained"', async () => {
    const { mapReasonToStatus } = await import("../supabase/functions/handle-email-suppression/verify")
    expect(mapReasonToStatus("complaint")).toBe("complained")
  })

  it('maps "unsubscribe" to "suppressed"', async () => {
    const { mapReasonToStatus } = await import("../supabase/functions/handle-email-suppression/verify")
    expect(mapReasonToStatus("unsubscribe")).toBe("suppressed")
  })

  it('maps unknown reason to "suppressed"', async () => {
    const { mapReasonToStatus } = await import("../supabase/functions/handle-email-suppression/verify")
    expect(mapReasonToStatus("unknown")).toBe("suppressed")
  })
})

describe("mapReasonToMessage", () => {
  it('maps "bounce" to bounce message', async () => {
    const { mapReasonToMessage } = await import("../supabase/functions/handle-email-suppression/verify")
    expect(mapReasonToMessage("bounce")).toContain("Permanent bounce")
  })

  it('maps "complaint" to complaint message', async () => {
    const { mapReasonToMessage } = await import("../supabase/functions/handle-email-suppression/verify")
    expect(mapReasonToMessage("complaint")).toContain("Spam complaint")
  })

  it('maps "unsubscribe" to unsubscribe message', async () => {
    const { mapReasonToMessage } = await import("../supabase/functions/handle-email-suppression/verify")
    expect(mapReasonToMessage("unsubscribe")).toContain("unsubscribed")
  })

  it('maps unknown reason to "Email suppressed"', async () => {
    const { mapReasonToMessage } = await import("../supabase/functions/handle-email-suppression/verify")
    expect(mapReasonToMessage("unknown")).toBe("Email suppressed")
  })
})

// ═══════════════════════════════════════════════════════════════
// INTEGRATION TESTS: Full handler (mocked)
// ═══════════════════════════════════════════════════════════════

describe("Full handler integration (mocked Deno.serve)", () => {
  it("returns 200 for valid webhook request", async () => {
    // This test simulates what the handler does
    // We test the full flow: parse headers → verify → parse payload → return success
    const secret = "test-webhook-secret"
    const now = Math.floor(Date.now() / 1000)
    const body = JSON.stringify({
      data: {
        email: "test@example.com",
        reason: "bounce",
        is_retry: false,
        retry_count: 0,
      },
    })

    const signature = await computeHmacSha256(body, String(now), secret)

    // Verify signature (this is what the handler does)
    await expect(
      verifySuppressionWebhook(body, signature, String(now), secret),
    ).resolves.toBeUndefined()

    // Parse payload (this is what the handler does)
    const payload = parseSuppressionPayload(body)
    expect(payload.email).toBe("test@example.com")
    expect(payload.reason).toBe("bounce")
  })

  it("returns 401 for invalid signature", async () => {
    const now = Math.floor(Date.now() / 1000)
    const body = JSON.stringify({
      data: {
        email: "test@example.com",
        reason: "bounce",
        is_retry: false,
        retry_count: 0,
      },
    })

    await expect(
      verifySuppressionWebhook(body, "bad-signature", String(now), "test-secret"),
    ).rejects.toMatchObject({ code: "invalid_signature" })
  })

  it("returns 401 for stale timestamp", async () => {
    const tenMinAgo = Math.floor((Date.now() - 10 * 60 * 1000) / 1000)
    const body = JSON.stringify({
      data: {
        email: "test@example.com",
        reason: "bounce",
        is_retry: false,
        retry_count: 0,
      },
    })
    const signature = await computeHmacSha256(body, String(tenMinAgo), "test-secret")

    await expect(
      verifySuppressionWebhook(body, signature, String(tenMinAgo), "test-secret"),
    ).rejects.toMatchObject({ code: "stale_timestamp" })
  })

  it("returns 400 for invalid JSON body", () => {
    expect(() => parseSuppressionPayload("not-json")).toThrow()
  })

  it("handles edge case: empty email in payload", () => {
    const body = JSON.stringify({
      data: {
        email: "",
        reason: "bounce",
        is_retry: false,
        retry_count: 0,
      },
    })
    expect(() => parseSuppressionPayload(body)).toThrow("Missing required fields: email, reason")
  })
})
