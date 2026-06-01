/**
 * send-twilio — Shared Twilio API client for Edge Functions
 *
 * Pure TypeScript module (no Deno-specific imports) that sends SMS/MMS
 * directly to the Twilio REST API. Works in both Deno (Edge Functions)
 * and browser (Vitest) environments.
 *
 * ─── Secrets requis ──────────────────────────────────────────────────────────
 *   TWILIO_ACCOUNT_SID   – Twilio Account SID (commence par "AC")
 *   TWILIO_AUTH_TOKEN    – Twilio Auth Token
 *   TWILIO_FROM_NUMBER   – Numéro de téléphone Twilio expéditeur (E.164)
 *
 * Ces secrets sont passés via le paramètre `config` (et lus depuis Deno.env
 * dans l'Edge Function appelante).
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Types ──────────────────────────────────────────────────────────────────

/** Paramètres d'envoi d'un SMS/MMS */
export interface SendTwilioParams {
  /** Numéro du destinataire (format local ou international) */
  to: string;
  /** Contenu textuel du message (optionnel si mediaUrls fourni) */
  message?: string;
  /** URLs de médias pour MMS (optionnel) */
  mediaUrls?: string[];
}

/** Configuration Twilio */
export interface SendTwilioConfig {
  /** Twilio Account SID (commence par "AC") */
  accountSid: string;
  /** Twilio Auth Token */
  authToken: string;
  /** Numéro Twilio expéditeur au format E.164 */
  fromNumber: string;
}

/** Réponse de l'API Twilio */
export interface SendTwilioResponse {
  /** Indique si l'envoi a été accepté par Twilio */
  success: boolean;
  /** Identifiant Twilio du message (sid) */
  sid?: string;
  /** Statut retourné par Twilio (queued, sent, failed, etc.) */
  status: string;
  /** Message d'erreur éventuel */
  error?: string;
  /** Code d'erreur Twilio (ex: 21211) */
  errorCode?: number;
}

// ─── Constantes ─────────────────────────────────────────────────────────────

const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";

// ─── Utilitaires ────────────────────────────────────────────────────────────

/**
 * Normalise un numéro de téléphone au format E.164.
 *
 * @param phone - Numéro brut
 * @returns Numéro normalisé (ex: "+15147088976")
 * @throws {Error} Si l'entrée est vide ou invalide
 */
function normalizePhone(phone: string): string {
  if (!phone) {
    throw new Error("Le numéro de téléphone ne peut pas être vide.");
  }

  const digits = phone.replace(/\D/g, "");

  if (digits.length < 4) {
    throw new Error(
      `Numéro de téléphone invalide après normalisation : "${phone}" → "${digits}" (${digits.length} chiffres).`
    );
  }

  if (phone.trim().startsWith("+")) {
    return `+${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  return `+${digits}`;
}

/**
 * Crée l'en-tête d'authentification Basic pour l'API Twilio.
 */
function buildAuthHeader(config: SendTwilioConfig): string {
  const credentials = `${config.accountSid}:${config.authToken}`;
  const encoded = btoa(credentials);
  return `Basic ${encoded}`;
}

/**
 * Construit le corps de la requête au format application/x-www-form-urlencoded.
 */
function buildFormBody(
  params: SendTwilioParams,
  fromNumber: string
): URLSearchParams {
  const formData = new URLSearchParams();
  const to = normalizePhone(params.to);

  formData.append("To", to);
  formData.append("From", fromNumber);

  if (params.message) {
    formData.append("Body", params.message);
  }

  if (params.mediaUrls && params.mediaUrls.length > 0) {
    for (const url of params.mediaUrls) {
      formData.append("MediaUrl", url);
    }
  }

  return formData;
}

// ─── Fonction principale ────────────────────────────────────────────────────

/**
 * Envoie un SMS/MMS directement via l'API REST Twilio.
 *
 * @param params  - Paramètres d'envoi (to, message, mediaUrls)
 * @param config  - Configuration Twilio (accountSid, authToken, fromNumber)
 * @returns       - Réponse structurée de l'API Twilio
 * @throws {Error} Si les paramètres sont invalides ou si erreur réseau
 */
export async function sendSmsViaTwilio(
  params: SendTwilioParams,
  config: SendTwilioConfig
): Promise<SendTwilioResponse> {
  // ── Validation ──────────────────────────────────────────────────────────
  const errors: string[] = [];
  if (!params.to) {
    errors.push("Le numéro de destination (to) est requis.");
  }
  if (!params.message && (!params.mediaUrls || params.mediaUrls.length === 0)) {
    errors.push(
      "Un message textuel (message) ou au moins un média (mediaUrls) est requis.",
    );
  }
  if (errors.length > 0) {
    throw new Error(errors.join(" | "));
  }

  // ── Build request ────────────────────────────────────────────────────────
  const url = `${TWILIO_API_BASE}/Accounts/${config.accountSid}/Messages.json`;
  const headers: Record<string, string> = {
    Authorization: buildAuthHeader(config),
    "Content-Type": "application/x-www-form-urlencoded",
  };
  const body = buildFormBody(params, config.fromNumber);

  // ── Send request ─────────────────────────────────────────────────────────
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", headers, body });
  } catch (err) {
    throw new Error(
      `Erreur réseau lors de l'envoi du SMS : ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // ── Parse response ───────────────────────────────────────────────────────
  const data: Record<string, unknown> = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      success: false,
      status: "failed",
      error:
        (data.message as string | undefined) ??
        `Erreur Twilio HTTP ${response.status}`,
      errorCode: data.code as number | undefined,
    };
  }

  return {
    success: true,
    sid: data.sid as string | undefined,
    status: (data.status as string) ?? "queued",
  };
}
