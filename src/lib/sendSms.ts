/**
 * sendSms — Twilio API direct integration
 *
 * ⚠️  SECURITY WARNING  ⚠️
 * This module performs Twilio API calls from the BROWSER using Basic Auth.
 * DO NOT import or call `sendSms()` in any production UI code — doing so
 * would EXPOSE your Twilio Account SID and Auth Token to every browser client.
 *
 * This module exists ONLY for unit-testing the Twilio API client logic
 * (validation, auth header construction, etc.) in a Vitest/jsdom environment.
 *
 * Production SMS sending must go through the server-side Edge Function at:
 *   supabase/functions/send-sms/index.ts
 * which reads credentials from Deno.env and is called via:
 *   supabase.functions.invoke("send-sms", { body: { ... } })
 *
 * ─── Secrets requis (for tests only) ─────────────────────────────────────────
 *   TWILIO_ACCOUNT_SID    – Twilio Account SID (commence par "AC")
 *   TWILIO_AUTH_TOKEN     – Twilio Auth Token
 *   TWILIO_FROM_NUMBER    – Numéro de téléphone Twilio expéditeur (format E.164)
 *
 *   Ces variables sont lues depuis import.meta.env côté client, ou depuis
 *   Deno.env / process.env côté serveur.
 * ──────────────────────────────────────────────────────────────────────────────
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Statut renvoyé par l'API Twilio */
export type TwilioMessageStatus =
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "undelivered"
  | "failed"
  | "accepted"
  | "scheduled"
  | "read"
  | "partially_delivered";

/** Paramètres d'envoi d'un SMS/MMS */
export interface SendSmsParams {
  /** Numéro du destinataire (format local ou international) */
  to: string;
  /** Contenu textuel du message (optionnel si mediaUrls fourni) */
  message?: string;
  /** Identifiant client pour le logging en base */
  clientId: string;
  /** URLs de médias pour MMS (optionnel) */
  mediaUrls?: string[];
}

/** Réponse de l'envoi */
export interface SendSmsResponse {
  /** Indique si l'envoi a été accepté par Twilio */
  success: boolean;
  /** Identifiant Twilio unique du message (sid) */
  messageSid?: string;
  /** Statut retourné par Twilio */
  status: TwilioMessageStatus;
  /** Message d'erreur éventuel */
  error?: string;
  /** Code d'erreur Twilio (ex: 21211) */
  errorCode?: number;
}

/** Résultat de validation des entrées */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Configuration pour l'appel API Twilio */
export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";
const DEFAULT_ERRORS = {
  EMPTY_TO: "Le numéro de destination (to) est requis.",
  EMPTY_CLIENT_ID: "L'identifiant client (clientId) est requis.",
  NO_CONTENT:
    "Un message textuel (message) ou au moins un média (mediaUrls) est requis.",
  INVALID_PHONE:
    "Le numéro de téléphone doit contenir au moins 4 chiffres après normalisation.",
} as const;

// ─── Utilitaires ──────────────────────────────────────────────────────────────

/**
 * Normalise un numéro de téléphone au format E.164.
 *
 * Règles :
 *  - Supprime tous les caractères non chiffrés.
 *  - Si le numéro commence par "+", le préserve (déjà E.164).
 *  - Si le numéro fait 11 chiffres et commence par "1", ajoute "+".
 *  - Si le numéro fait 10 chiffres, ajoute "+1" (Canada/USA par défaut).
 *  - Lance une erreur si le résultat a moins de 4 chiffres.
 *
 * @param phone - Numéro brut (ex: "+1 (514) 708-8976", "15147088976")
 * @returns Numéro normalisé (ex: "+15147088976")
 * @throws {Error} Si l'entrée est vide, null, ou invalide
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) {
    throw new Error("Le numéro de téléphone ne peut pas être vide.");
  }

  const digits = phone.replace(/\D/g, "");

  if (digits.length < 4) {
    throw new Error(
      `Numéro de téléphone invalide après normalisation : "${phone}" → "${digits}" (${digits.length} chiffres).`
    );
  }

  // Déjà au format E.164 (commence par +)
  if (phone.trim().startsWith("+")) {
    // Si le + est suivi d'un 1 et que le numéro fait entre 11 et 12 chiffres, c'est bon
    if (digits.length >= 10 && digits.length <= 15) {
      return `+${digits}`;
    }
    // Sinon, le + était peut-être un indicatif international valide
    return `+${digits}`;
  }

  // 11 chiffres commençant par 1 → +1XXXXXXXXX
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  // 10 chiffres → +1XXXXXXXXX (Canada/USA)
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // Autres longueurs : on suppose que le préfixe international est déjà présent
  // sans le signe +, on l'ajoute
  if (digits.length >= 4) {
    return `+${digits}`;
  }

  // Ne devrait pas arriver à cause du check < 4 plus haut
  throw new Error(
    `Impossible de normaliser le numéro : "${phone}" (${digits.length} chiffres).`
  );
}

/**
 * Valide les paramètres d'envoi SMS.
 *
 * Vérifie que tous les champs obligatoires sont présents et que le numéro
 * de destination est au moins potentiellement valide (4+ chiffres).
 *
 * @param params - Paramètres à valider
 * @returns ValidationResult avec la liste des erreurs
 */
export function validateSmsInput(params: SendSmsParams): ValidationResult {
  const errors: string[] = [];

  if (!params.to) {
    errors.push(DEFAULT_ERRORS.EMPTY_TO);
  } else {
    try {
      normalizePhoneNumber(params.to);
    } catch {
      errors.push(DEFAULT_ERRORS.INVALID_PHONE);
    }
  }

  if (!params.clientId) {
    errors.push(DEFAULT_ERRORS.EMPTY_CLIENT_ID);
  }

  if (!params.message && (!params.mediaUrls || params.mediaUrls.length === 0)) {
    errors.push(DEFAULT_ERRORS.NO_CONTENT);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Crée l'en-tête d'authentification Basic pour l'API Twilio.
 *
 * @param config - Configuration Twilio
 * @returns En-tête Authorization au format "Basic <base64>"
 */
export function buildTwilioAuthHeader(config: TwilioConfig): string {
  const credentials = `${config.accountSid}:${config.authToken}`;
  const encoded = btoa(credentials);
  return `Basic ${encoded}`;
}

/**
 * Construit le corps de la requête au format application/x-www-form-urlencoded
 * pour l'API Twilio Messages.
 *
 * @param params - Paramètres d'envoi
 * @param fromNumber - Numéro expéditeur Twilio (E.164)
 * @returns URLSearchParams prêt à être envoyé
 */
export function buildTwilioFormBody(
  params: SendSmsParams,
  fromNumber: string
): URLSearchParams {
  const formData = new URLSearchParams();
  const to = normalizePhoneNumber(params.to);

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

// ─── Fonction principale ──────────────────────────────────────────────────────

/**
 * Envoie un SMS/MMS via l'API REST Twilio.
 *
 * @param params    - Paramètres d'envoi (to, message, clientId, mediaUrls)
 * @param config    - Configuration Twilio (accountSid, authToken, fromNumber)
 * @returns         - Réponse de l'API Twilio
 * @throws {Error}  - Si la validation échoue ou si l'API renvoie une erreur
 */
/**
 * @deprecated DANGER: This function sends Twilio credentials client-side.
 * Only use in test files. For production, call the server-side Edge Function:
 *   supabase.functions.invoke("send-sms", { body: { ... } })
 */
export async function sendSms(
  params: SendSmsParams,
  config: TwilioConfig
): Promise<SendSmsResponse> {
  // Safety guard: prevent accidental use in production browser bundle
  if (typeof window !== "undefined" && import.meta.env.PROD) {
    throw new Error(
      "sendSms() is a TEST-ONLY function. Do not call it from production code. " +
      "Use supabase.functions.invoke('send-sms', ...) instead."
    );
  }

  const validation = validateSmsInput(params);
  if (!validation.valid) {
    throw new Error(validation.errors.join(" | "));
  }

  const url = `${TWILIO_API_BASE}/Accounts/${config.accountSid}/Messages.json`;
  const headers = {
    Authorization: buildTwilioAuthHeader(config),
    "Content-Type": "application/x-www-form-urlencoded",
  };
  const body = buildTwilioFormBody(params, config.fromNumber);

  let response: Response;
  try {
    response = await fetch(url, { method: "POST", headers, body });
  } catch (err) {
    throw new Error(
      `Erreur réseau lors de l'envoi du SMS : ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const data = await response.json();

  if (!response.ok) {
    const twilioError = data as { code?: number; message?: string };
    return {
      success: false,
      status: "failed",
      error: twilioError.message ?? `Erreur Twilio HTTP ${response.status}`,
      errorCode: twilioError.code,
    };
  }

  const twilioResponse = data as { sid?: string; status?: string };
  return {
    success: true,
    messageSid: twilioResponse.sid,
    status: (twilioResponse.status as TwilioMessageStatus) ?? "queued",
  };
}
