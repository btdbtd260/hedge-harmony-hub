import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { sendSmsViaTwilio } from "../_shared/send-twilio.ts";
import type { SendTwilioConfig, SendTwilioResponse } from "../_shared/send-twilio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER");

    if (!TWILIO_ACCOUNT_SID) {
      return new Response(
        JSON.stringify({ error: "TWILIO_ACCOUNT_SID non configuré" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!TWILIO_AUTH_TOKEN) {
      return new Response(
        JSON.stringify({ error: "TWILIO_AUTH_TOKEN non configuré" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!TWILIO_FROM_NUMBER) {
      return new Response(
        JSON.stringify({ error: "TWILIO_FROM_NUMBER non configuré" }),
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

    // Normaliser le numéro destinataire pour la vérification des numéros bloqués
    // On réutilise la même logique que normalizePhoneNumber dans send-twilio
    let normalizedTo = to.replace(/[\s\-().]/g, "");
    if (!normalizedTo.startsWith("+")) {
      if (normalizedTo.length === 10) normalizedTo = "+1" + normalizedTo;
      else if (normalizedTo.length === 11 && normalizedTo.startsWith("1"))
        normalizedTo = "+" + normalizedTo;
      else normalizedTo = "+" + normalizedTo;
    }

    // Vérifier la liste des numéros bloqués
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const rawDigits = (to ?? "").replace(/\D/g, "");
    const toDigits = normalizedTo.replace(/\D/g, "").slice(-10);
    const candidates = Array.from(new Set([toDigits, rawDigits].filter(Boolean)));
    const { data: blocked } = await adminClient
      .from("blocked_numbers")
      .select("id")
      .in("phone_normalized", candidates)
      .maybeSingle();
    if (blocked) {
      return new Response(
        JSON.stringify({ error: "Ce numéro est bloqué", code: "BLOCKED" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Envoyer via Twilio API direct ─────────────────────────────────────
    const twilioConfig: SendTwilioConfig = {
      accountSid: TWILIO_ACCOUNT_SID,
      authToken: TWILIO_AUTH_TOKEN,
      fromNumber: TWILIO_FROM_NUMBER,
    };

    let result: SendTwilioResponse;
    try {
      result = await sendSmsViaTwilio(
        { to, message, mediaUrls: media_urls },
        twilioConfig,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Erreur inconnue";
      await adminClient.from("messages").insert({
        client_id,
        direction: "outbound",
        body: message ?? "",
        media_urls: media_urls ?? [],
        from_number: TWILIO_FROM_NUMBER,
        to_number: normalizedTo,
        status: "failed",
        error_message: errMsg,
        read: true,
      });
      return new Response(
        JSON.stringify({ error: errMsg }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!result.success) {
      // Log message échec
      await adminClient.from("messages").insert({
        client_id,
        direction: "outbound",
        body: message ?? "",
        media_urls: media_urls ?? [],
        from_number: TWILIO_FROM_NUMBER,
        to_number: normalizedTo,
        status: "failed",
        error_message: result.error ?? `Erreur Twilio`,
        read: true,
      });
      return new Response(
        JSON.stringify({
          error: "Échec envoi Twilio",
          details: result,
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
        from_number: TWILIO_FROM_NUMBER,
        to_number: normalizedTo,
        twilio_sid: result.sid ?? null,
        status: result.status ?? "sent",
        read: true,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Erreur insert message:", insertErr);
    }

    return new Response(
      JSON.stringify({ success: true, message: inserted, twilio: result }),
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
