import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { downloadTwilioMedia } from "../_shared/download-twilio-media.ts";
import type { TwilioMediaConfig } from "../_shared/download-twilio-media.ts";

// Webhook PUBLIC appelé par Twilio. Pas de JWT user. Accès direct Twilio avec Basic Auth.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

function normalizePhone(p: string): string {
  return p.replace(/[\s\-().+]/g, "").replace(/^1/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");

    const formData = await req.formData();
    const from = (formData.get("From") as string) ?? "";
    const to = (formData.get("To") as string) ?? "";
    const body = (formData.get("Body") as string) ?? "";
    const messageSid = (formData.get("MessageSid") as string) ?? "";
    const numMedia = parseInt((formData.get("NumMedia") as string) ?? "0", 10);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Vérifier si le numéro émetteur est bloqué — on ignore complètement le message
    const fromNorm = normalizePhone(from).slice(-10);
    if (fromNorm) {
      const { data: blocked } = await admin
        .from("blocked_numbers")
        .select("id")
        .eq("phone_normalized", fromNorm)
        .maybeSingle();
      if (blocked) {
        console.log(`[twilio-webhook] Message ignoré — numéro bloqué: ${from}`);
        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
          { headers: { "Content-Type": "text/xml" }, status: 200 },
        );
      }
    }

    // Trouver le client par numéro de téléphone
    const { data: customers } = await admin
      .from("customers")
      .select("id, phone")
      .eq("hidden", false);

    let clientId: string | null = null;
    if (customers) {
      const match = customers.find((c) => {
        if (!c.phone) return false;
        return normalizePhone(c.phone).slice(-10) === fromNorm;
      });
      if (match) clientId = match.id;
    }

    // Télécharger les médias directement via Twilio API (Basic Auth) et les pousser dans le bucket
    const mediaUrls: string[] = [];
    if (numMedia > 0 && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      const twilioConfig: TwilioMediaConfig = {
        accountSid: TWILIO_ACCOUNT_SID,
        authToken: TWILIO_AUTH_TOKEN,
      };

      for (let i = 0; i < numMedia; i++) {
        const mediaUrl = formData.get(`MediaUrl${i}`) as string;
        const contentType = (formData.get(`MediaContentType${i}`) as string) ?? "image/jpeg";
        if (!mediaUrl) continue;

        try {
          const mediaResult = await downloadTwilioMedia(mediaUrl, twilioConfig);
          const ext = contentType.split("/")[1]?.split(";")[0] ?? "bin";
          const filename = `${messageSid}_${i}.${ext}`;
          const { error: upErr } = await admin.storage
            .from("message-media")
            .upload(filename, mediaResult.data, { contentType: mediaResult.contentType, upsert: true });
          if (upErr) {
            console.error("Upload media erreur:", upErr);
            continue;
          }
          const { data: pub } = admin.storage.from("message-media").getPublicUrl(filename);
          mediaUrls.push(pub.publicUrl);
        } catch (e) {
          console.error("Erreur traitement media:", e);
        }
      }
    }

    const { error: insertErr } = await admin.from("messages").insert({
      client_id: clientId ?? "00000000-0000-0000-0000-000000000000",
      direction: "inbound",
      body,
      media_urls: mediaUrls,
      from_number: from,
      to_number: to,
      twilio_sid: messageSid,
      status: "received",
      read: false,
    });

    if (insertErr) {
      console.error("Erreur insert inbound:", insertErr);
    }

    // Réponse TwiML vide (pas de réponse auto)
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { "Content-Type": "text/xml" },
      status: 200,
    });
  } catch (err) {
    console.error("twilio-webhook error:", err);
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { "Content-Type": "text/xml" },
      status: 200,
    });
  }
});
