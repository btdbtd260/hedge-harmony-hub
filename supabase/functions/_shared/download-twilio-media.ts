/**
 * download-twilio-media — Shared Twilio Media download for Edge Functions
 *
 * Pure TypeScript module (no Deno-specific imports) that downloads media
 * directly from the Twilio REST API using Basic Auth. Works in both Deno
 * (Edge Functions) and browser (Vitest) environments.
 *
 * ─── Secrets requis ──────────────────────────────────────────────────────────
 *   TWILIO_ACCOUNT_SID   – Twilio Account SID (commence par "AC")
 *   TWILIO_AUTH_TOKEN    – Twilio Auth Token
 *
 * Ces secrets sont lus depuis Deno.env dans l'Edge Function appelante.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Types ──────────────────────────────────────────────────────────────────

/** Résultat du téléchargement d'un média Twilio */
export interface TwilioMediaResult {
  /** Données binaires du média */
  data: ArrayBuffer;
  /** Type MIME du média */
  contentType: string;
}

/** Configuration Twilio pour le téléchargement de médias */
export interface TwilioMediaConfig {
  /** Twilio Account SID (commence par "AC") */
  accountSid: string;
  /** Twilio Auth Token */
  authToken: string;
}

// ─── Utilitaires ────────────────────────────────────────────────────────────

/**
 * Crée l'en-tête d'authentification Basic pour l'API Twilio.
 */
function buildAuthHeader(accountSid: string, authToken: string): string {
  const credentials = `${accountSid}:${authToken}`;
  const encoded = btoa(credentials);
  return `Basic ${encoded}`;
}

/**
 * Extrait le chemin relatif d'une URL de média Twilio.
 *
 * @example
 *   input: "https://api.twilio.com/2010-04-01/Accounts/ACxxx/Messages/SMxxx/Media/MExxx"
 *   output: "/Accounts/ACxxx/Messages/SMxxx/Media/MExxx"
 *
 * @throws {Error} Si l'URL ne correspond pas au format attendu
 */
function extractTwilioMediaPath(mediaUrl: string): string {
  // Format: https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages/{MSID}/Media/{MID}
  const match = mediaUrl.match(
    /^https?:\/\/api\.twilio\.com\/2010-04-01(\/Accounts\/[^/]+\/Messages\/[^/]+\/Media\/[^/]+)$/
  );

  if (!match) {
    throw new Error(
      `URL de média Twilio invalide : "${mediaUrl}". Format attendu : https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages/{MSID}/Media/{MID}`
    );
  }

  return match[1];
}

// ─── Fonction principale ────────────────────────────────────────────────────

/**
 * Télécharge un média depuis l'API Twilio en utilisant Basic Auth.
 *
 * @param mediaUrl   - URL complète du média Twilio
 * @param config     - Configuration Twilio (accountSid, authToken)
 * @returns          - Données binaires et type MIME du média
 * @throws {Error}   - Si l'URL est invalide ou si le téléchargement échoue
 */
export async function downloadTwilioMedia(
  mediaUrl: string,
  config: TwilioMediaConfig
): Promise<TwilioMediaResult> {
  // ── Validation ──────────────────────────────────────────────────────────
  if (!mediaUrl) {
    throw new Error("L'URL du média ne peut pas être vide.");
  }

  // Valider le format de l'URL Twilio
  extractTwilioMediaPath(mediaUrl);

  // ── Build request ────────────────────────────────────────────────────────
  const headers: Record<string, string> = {
    Authorization: buildAuthHeader(config.accountSid, config.authToken),
  };

  // ── Send request ─────────────────────────────────────────────────────────
  let response: Response;
  try {
    response = await fetch(mediaUrl, { headers, redirect: "follow" });
  } catch (err) {
    throw new Error(
      `Erreur réseau lors du téléchargement du média : ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `Échec du téléchargement du média depuis Twilio : HTTP ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.arrayBuffer();
  const contentType = response.headers.get("Content-Type") ?? "application/octet-stream";

  return { data, contentType };
}
