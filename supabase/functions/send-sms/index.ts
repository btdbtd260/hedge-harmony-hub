import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY non configuré" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!TWILIO_API_KEY) {
      return new Response(
        JSON.stringify({ error: "TWILIO_API_KEY non configuré" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!TWILIO_PHONE_NUMBER) {
      return new Response(
        JSON.stringify({ error: "TWILIO_PHONE_NUMBER non configuré" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { client_id, to, message, media_urls } = body as {
      client_id?: string;
      to?: string;
      message?: string;
      media_urls?: string[];
    };

    if (!client_id || !to || (!message && (!media_urls || media_urls.length === 0))) {
      return new Response(
        JSON.stringify({ error: "client_id, to et message (ou media_urls) requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Normaliser le numéro destinataire au format E.164 (assume CA si pas de +)
    let normalizedTo = to.replace(/[\s\-\(\)\.]/g, "");
    if (!normalizedTo.startsWith("+")) {
      if (normalizedTo.length === 10) normalizedTo = "+1" + normalizedTo;
      else if (normalizedTo.length === 11 && normalizedTo.startsWith("1"))
        normalizedTo = "+" + normalizedTo;
      else normalizedTo = "+" + normalizedTo;
    }

    // Envoyer via gateway Twilio
    const formData = new URLSearchParams();
    formData.append("To", normalizedTo);
    formData.append("From", TWILIO_PHONE_NUMBER);
    if (message) formData.append("Body", message);
    if (media_urls && media_urls.length > 0) {
      for (const url of media_urls) formData.append("MediaUrl", url);
    }

    const twilioResp = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    const twilioData = await twilioResp.json();

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (!twilioResp.ok) {
      // Log message échec
      await adminClient.from("messages").insert({
        client_id,
        direction: "outbound",
        body: message ?? "",
        media_urls: media_urls ?? [],
        from_number: TWILIO_PHONE_NUMBER,
        to_number: normalizedTo,
        status: "failed",
        error_message: twilioData?.message ?? `HTTP ${twilioResp.status}`,
        read: true,
      });
      return new Response(
        JSON.stringify({
          error: "Échec envoi Twilio",
          status: twilioResp.status,
          details: twilioData,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Insertion message envoyé
    const { data: inserted, error: insertErr } = await adminClient
      .from("messages")
      .insert({
        client_id,
        direction: "outbound",
        body: message ?? "",
        media_urls: media_urls ?? [],
        from_number: TWILIO_PHONE_NUMBER,
        to_number: normalizedTo,
        twilio_sid: twilioData?.sid ?? null,
        status: twilioData?.status ?? "sent",
        read: true,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Erreur insert message:", insertErr);
    }

    return new Response(
      JSON.stringify({ success: true, message: inserted, twilio: twilioData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-sms error:", err);
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
