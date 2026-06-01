import { createClient } from 'npm:@supabase/supabase-js@2'
import { verifySuppressionWebhook, parseSuppressionPayload, mapReasonToStatus, mapReasonToMessage, WebhookVerificationError } from './verify.ts'
import type { SuppressionPayload } from './verify.ts'

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const webhookSecret = Deno.env.get('SUPPRESSION_WEBHOOK_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables')
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  // Verify HMAC-SHA256 signature manually (replaces @lovable.dev/webhooks-js)
  // Expected headers:
  //   x-webhook-signature: HMAC-SHA256 hex of `${timestamp}.${body}`
  //   x-webhook-timestamp: Unix timestamp (seconds since epoch)
  let payload: SuppressionPayload
  try {
    const body = await req.text()
    const signature = req.headers.get('x-webhook-signature') ?? ''
    const timestamp = req.headers.get('x-webhook-timestamp') ?? ''

    await verifySuppressionWebhook(body, signature, timestamp, webhookSecret)
    payload = parseSuppressionPayload(body)
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      switch (error.code) {
        case 'invalid_signature':
          console.error('Invalid webhook signature')
          return jsonResponse({ error: 'Invalid signature' }, 401)
        case 'stale_timestamp':
          console.error('Stale webhook timestamp')
          return jsonResponse({ error: 'Stale timestamp' }, 401)
        case 'invalid_payload':
        case 'invalid_json':
          console.error('Invalid payload', { code: error.code })
          return jsonResponse({ error: 'Invalid payload' }, 400)
        default:
          console.error('Webhook verification failed', {
            code: error.code,
            message: error.message,
          })
          return jsonResponse({ error: 'Verification failed' }, 401)
      }
    }
    console.error('Unexpected error during verification', { error })
    return jsonResponse({ error: 'Internal error' }, 500)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const normalizedEmail = payload.email.toLowerCase()

  // 1. Upsert to suppressed_emails (idempotent — safe for retries)
  const { error: suppressError } = await supabase
    .from('suppressed_emails')
    .upsert(
      {
        email: normalizedEmail,
        reason: payload.reason,
        metadata: payload.metadata ?? null,
      },
      { onConflict: 'email' },
    )

  if (suppressError) {
    console.error('Failed to upsert suppressed email', {
      error: suppressError,
      email_redacted: normalizedEmail[0] + '***@' + normalizedEmail.split('@')[1],
    })
    return jsonResponse({ error: 'Failed to write suppression' }, 500)
  }

  // 2. Append a new log entry for the suppression event (never update existing rows)
  const sendLogStatus = mapReasonToStatus(payload.reason)
  const sendLogMessage = mapReasonToMessage(payload.reason)

  const { error: insertError } = await supabase
    .from('email_send_log')
    .insert({
      message_id: payload.message_id ?? null,
      template_name: 'system',
      recipient_email: normalizedEmail,
      status: sendLogStatus,
      error_message: sendLogMessage,
      metadata: payload.metadata ?? null,
    })

  if (insertError) {
    // Non-fatal — log and continue. The suppression was already recorded.
    console.warn('Failed to insert email_send_log', {
      error: insertError,
    })
  }

  console.log('Suppression processed', {
    email_redacted: normalizedEmail[0] + '***@' + normalizedEmail.split('@')[1],
    reason: payload.reason,
    is_retry: payload.is_retry,
    retry_count: payload.retry_count,
    has_message_id: !!payload.message_id,
  })

  return jsonResponse({ success: true })
})
