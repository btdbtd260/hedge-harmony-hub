// ============================================================
// Pure verification functions for handle-email-suppression
// (no Deno-specific APIs — testable in any runtime)
// Replace @lovable.dev/webhooks-js with manual HMAC-SHA256
// ============================================================

export interface SuppressionPayload {
  email: string
  reason: 'bounce' | 'complaint' | 'unsubscribe'
  message_id?: string
  metadata?: Record<string, unknown>
  is_retry: boolean
  retry_count: number
}

export class WebhookVerificationError extends Error {
  constructor(
    message: string,
    public code: 'invalid_signature' | 'stale_timestamp' | 'invalid_payload' | 'invalid_json',
  ) {
    super(message)
    this.name = 'WebhookVerificationError'
  }
}

/**
 * Compute HMAC-SHA256 hex digest of `${timestamp}.${body}` using the given secret.
 * Uses crypto.subtle (Web Crypto API) — works in both Deno and modern browsers/Node.
 */
export async function computeHmacSha256(
  body: string,
  timestamp: string,
  secret: string,
): Promise<string> {
  if (!secret) {
    throw new WebhookVerificationError('Webhook secret is not configured (empty)', 'invalid_signature')
  }

  const encoder = new TextEncoder()

  // Import the secret as an HMAC key
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  // Create the message: timestamp + "." + body
  const message = encoder.encode(`${timestamp}.${body}`)

  // Sign
  const signature = await crypto.subtle.sign('HMAC', key, message)

  // Convert to hex string
  const hex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return hex
}

/**
 * Check if a Unix timestamp (in seconds) is within maxAgeMs of the current time.
 * Returns false for invalid/non-numeric timestamps or timestamps in the future.
 */
export function isTimestampFresh(
  timestamp: string,
  maxAgeMs: number = 5 * 60 * 1000,
): boolean {
  if (!timestamp) return false

  const tsSeconds = Number(timestamp)
  if (!Number.isFinite(tsSeconds) || !Number.isInteger(tsSeconds)) return false
  if (tsSeconds <= 0) return false

  const nowMs = Date.now()
  const tsMs = tsSeconds * 1000

  // Reject timestamps in the future
  if (tsMs > nowMs) return false

  const ageMs = nowMs - tsMs
  return ageMs < maxAgeMs
}

/**
 * Verify that the webhook signature is valid and the timestamp is fresh.
 * Throws WebhookVerificationError with appropriate code on failure.
 *
 * Expected headers from sender:
 *   x-webhook-signature: HMAC-SHA256 hex of `${timestamp}.${body}`
 *   x-webhook-timestamp: Unix timestamp (seconds since epoch)
 */
export async function verifySuppressionWebhook(
  body: string,
  signature: string,
  timestamp: string,
  secret: string,
): Promise<void> {
  // Step 1: Validate inputs
  if (!signature) {
    throw new WebhookVerificationError('Missing signature header', 'invalid_signature')
  }

  // Step 2: Check timestamp freshness first (avoids unnecessary HMAC computation)
  if (!isTimestampFresh(timestamp)) {
    throw new WebhookVerificationError('Timestamp is stale or invalid', 'stale_timestamp')
  }

  // Step 3: Compute expected signature
  const expectedSignature = await computeHmacSha256(body, timestamp, secret)

  // Step 4: Constant-time comparison
  if (expectedSignature !== signature) {
    throw new WebhookVerificationError('Invalid signature', 'invalid_signature')
  }
}

/**
 * Parse and validate the suppression event payload from the Go API.
 * The body is expected to be JSON with a top-level "data" property.
 */
export function parseSuppressionPayload(body: string): SuppressionPayload {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new WebhookVerificationError('Invalid JSON body', 'invalid_json')
  }

  if (!parsed.data || typeof parsed.data !== 'object') {
    throw new Error('Missing data field in payload')
  }

  const data = parsed.data as Record<string, unknown>

  if (!data.email || !data.reason) {
    throw new Error('Missing required fields: email, reason')
  }

  return {
    email: String(data.email),
    reason: data.reason as SuppressionPayload['reason'],
    message_id: data.message_id ? String(data.message_id) : undefined,
    metadata: data.metadata ? (data.metadata as Record<string, unknown>) : undefined,
    is_retry: Boolean(data.is_retry),
    retry_count: Number(data.retry_count) || 0,
  }
}

/**
 * Map suppression reason to email_send_log status.
 */
export function mapReasonToStatus(
  reason: string,
): 'bounced' | 'complained' | 'suppressed' {
  switch (reason) {
    case 'bounce':
      return 'bounced'
    case 'complaint':
      return 'complained'
    default:
      return 'suppressed'
  }
}

/**
 * Map suppression reason to a human-readable log message.
 */
export function mapReasonToMessage(reason: string): string {
  switch (reason) {
    case 'bounce':
      return 'Permanent bounce — email address is invalid or rejected'
    case 'complaint':
      return 'Spam complaint — recipient marked email as spam'
    case 'unsubscribe':
      return 'Recipient unsubscribed'
    default:
      return 'Email suppressed'
  }
}
