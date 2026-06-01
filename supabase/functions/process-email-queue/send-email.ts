// ============================================================
// Resend email sender for process-email-queue
// Replaces @lovable.dev/email-js with direct Resend API calls
// ============================================================

/**
 * Payload shape from pgmq queue messages sent by send-transactional-email
 * and other enqueuers.
 */
export interface EmailPayload {
  message_id?: string
  to: string
  from: string
  sender_domain?: string
  subject: string
  html?: string
  text?: string
  purpose?: string
  label?: string
  idempotency_key?: string
  unsubscribe_token?: string
  run_id?: string
  queued_at?: string
}

export interface SendEmailOptions {
  apiKey: string
  unsubscribeBaseUrl?: string
  supabaseUrl?: string
}

export interface SendEmailResult {
  id: string
}

/** Resend email payload as sent to the API */
export interface ResendEmailPayload {
  from: string
  to: string[]
  subject: string
  html?: string
  text?: string
  headers?: Record<string, string>
  tags?: { name: string; value: string }[]
}

// ═══════════════════════════════════════════════════════════════
// Custom Error Classes
// ═══════════════════════════════════════════════════════════════

/**
 * Rate-limit error. Compatible with the existing isRateLimited / getRetryAfterSeconds
 * checks in index.ts which look for a `status` property (=== 429) and
 * `retryAfterSeconds` property.
 */
export class EmailRateLimitedError extends Error {
  public status = 429
  public retryAfterSeconds: number | null

  constructor(message: string, retryAfterSeconds?: number | null) {
    super(message)
    this.name = 'EmailRateLimitedError'
    this.retryAfterSeconds = retryAfterSeconds ?? null
  }
}

/**
 * Forbidden error (403). Compatible with the existing isForbidden check in index.ts
 * which looks for a `status` property (=== 403).
 */
export class EmailForbiddenError extends Error {
  public status = 403

  constructor(message: string) {
    super(message)
    this.name = 'EmailForbiddenError'
  }
}

// ═══════════════════════════════════════════════════════════════
// Payload Mapping
// ═══════════════════════════════════════════════════════════════

/**
 * Maps a pgmq queue payload to the Resend API format.
 */
export function mapEmailPayload(payload: EmailPayload): ResendEmailPayload {
  const resendPayload: ResendEmailPayload = {
    from: payload.from,
    to: [payload.to],
    subject: payload.subject,
  }

  if (payload.html) {
    resendPayload.html = payload.html
  }

  if (payload.text) {
    resendPayload.text = payload.text
  }

  // Build headers
  const headers: Record<string, string> = {}
  if (payload.idempotency_key) {
    headers['Idempotency-Key'] = payload.idempotency_key
  }
  if (Object.keys(headers).length > 0) {
    resendPayload.headers = headers
  }

  // Build tags
  const tags: { name: string; value: string }[] = []
  if (payload.purpose) {
    tags.push({ name: 'purpose', value: payload.purpose })
  }
  if (payload.label) {
    tags.push({ name: 'label', value: payload.label })
  }
  if (tags.length > 0) {
    resendPayload.tags = tags
  }

  return resendPayload
}

// ═══════════════════════════════════════════════════════════════
// List-Unsubscribe Header
// ═══════════════════════════════════════════════════════════════

/**
 * Builds a List-Unsubscribe header value per RFC 2369.
 *
 * Priority:
 * 1. UNSUBSCRIBE_BASE_URL if available
 * 2. SUPABASE_URL + /functions/v1/handle-email-unsubscribe as fallback
 * 3. Returns undefined if neither is available or token is missing
 */
export function buildListUnsubscribeHeader(
  unsubscribeToken: string | undefined,
  options: { unsubscribeBaseUrl?: string; supabaseUrl?: string }
): string | undefined {
  if (!unsubscribeToken) {
    return undefined
  }

  const baseUrl = options.unsubscribeBaseUrl ?? options.supabaseUrl
  if (!baseUrl) {
    return undefined
  }

  const encodedToken = encodeURIComponent(unsubscribeToken)

  if (options.unsubscribeBaseUrl) {
    return `<${options.unsubscribeBaseUrl}?token=${encodedToken}>`
  }

  return `<${options.supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${encodedToken}>`
}

// ═══════════════════════════════════════════════════════════════
// Resend API
// ═══════════════════════════════════════════════════════════════

const RESEND_API_URL = 'https://api.resend.com/emails'

/**
 * Sends an email via the Resend API.
 *
 * @throws {EmailRateLimitedError} on 429 responses (with optional retryAfterSeconds)
 * @throws {EmailForbiddenError} on 401/403 responses
 * @throws {Error} on other failures
 */
export async function sendEmail(
  payload: EmailPayload,
  options: SendEmailOptions
): Promise<SendEmailResult> {
  if (!options.apiKey) {
    throw new Error('Resend API key is not configured')
  }

  if (!payload.to || !payload.from || !payload.subject) {
    throw new Error('Missing required email fields')
  }

  // Build the Resend API payload
  const resendPayload = mapEmailPayload(payload)

  // Add List-Unsubscribe header if token present
  if (payload.unsubscribe_token) {
    const listUnsubscribe = buildListUnsubscribeHeader(
      payload.unsubscribe_token,
      options
    )
    if (listUnsubscribe) {
      resendPayload.headers = {
        ...resendPayload.headers,
        'List-Unsubscribe': listUnsubscribe,
      }
    }
  }

  // Call Resend API
  let response: Response
  try {
    response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resendPayload),
    })
  } catch (error) {
    // Network errors
    throw new Error(
      `Resend network error: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    const errorMessage =
      (errorBody as any)?.error?.message ??
      (errorBody as any)?.message ??
      response.statusText

    if (response.status === 429) {
      // Rate limited
      const retryAfter = response.headers.get('retry-after')
      const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : 60
      throw new EmailRateLimitedError(
        `Resend rate limited: ${errorMessage}`,
        isNaN(retryAfterSeconds) ? 60 : retryAfterSeconds
      )
    }

    if (response.status === 401 || response.status === 403) {
      throw new EmailForbiddenError(
        `Resend auth error: ${errorMessage}`
      )
    }

    throw new Error(
      `Resend API error: ${response.status} ${errorMessage}`
    )
  }

  const result = (await response.json()) as { id: string }
  return { id: result.id }
}
