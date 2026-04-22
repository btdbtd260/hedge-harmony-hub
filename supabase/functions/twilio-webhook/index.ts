import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

// Webhook PUBLIC appelé par Twilio. Pas de JWT user mais on valide via gateway.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

function normalizePhone(p: string): string {
  return p.replace(/[\s\-\(\)\.\+]/g, "").replace(/^1/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");

    const formData = await req.formData();
    const from = (formData.get("From") as string) ?? "";
    const to = (formData.get("To") as string) ?? "";
    const body = (formData.get("Body") as string) ?? "";
    const messageSid = (formData.get("MessageSid") as string) ?? "";
    const numMedia = parseInt((formData.get("NumMedia") as string) ?? "0", 10);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Trouver le client par numéro de téléphone
    const fromNorm = normalizePhone(from);
    const { data: customers } = await admin
      .from("customers")
      .select("id, phone")
      .eq("hidden", false);

    let clientId: string | null = null;
    if (customers) {
      const match = customers.find((c) => {
        if (!c.phone) return false;
        return normalizePhone(c.phone) === fromNorm;
      });
      if (match) clientId = match.id;
    }

    // Télécharger les médias et les pousser dans le bucket
    const mediaUrls: string[] = [];
    if (numMedia > 0 && LOVABLE_API_KEY && TWILIO_API_KEY) {
      for (let i = 0; i < numMedia; i++) {
        const mediaUrl = formData.get(`MediaUrl${i}`) as string;
        const contentType = (formData.get(`MediaContentType${i}`) as string) ?? "image/jpeg";
        if (!mediaUrl) continue;

        try {
          // Twilio media URL nécessite auth basic (Account SID:Auth Token).
          // Via gateway: on remplace api.twilio.com par gateway prefix.
          // mediaUrl est de la forme https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages/{MSID}/Media/{MID}
          const path = mediaUrl.replace(
            /^https?:\/\/api\.twilio\.com\/2010-04-01\/Accounts\/[^/]+/,
            "",
          );
          const gatewayUrl = `https://connector-gateway.lovable.dev/twilio${path}`;
          const mediaResp = await fetch(gatewayUrl, {
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": TWILIO_API_KEY,
            },
            redirect: "follow",
          });
          if (!mediaResp.ok) {
            console.error(`Échec download media ${i}: ${mediaResp.status}`);
            continue;
          }
          const buffer = await mediaResp.arrayBuffer();
          const ext = contentType.split("/")[1]?.split(";")[0] ?? "bin";
          const filename = `${messageSid}_${i}.${ext}`;
          const { error: upErr } = await admin.storage
            .from("message-media")
            .upload(filename, buffer, { contentType, upsert: true });
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
