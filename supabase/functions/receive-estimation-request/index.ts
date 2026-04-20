// Public endpoint to receive estimation requests from an external website form.
// - Authenticated by a dedicated submission key (header: x-submission-key)
// - Accepts application/json OR multipart/form-data (with optional photos)
// - Validates strictly with Zod
// - Detects duplicates (strong + probable)
// - Creates ONLY a row in estimation_requests (no client/job/estimation/invoice)
// - Marks source = "external_website_form"
//
// NOTE: Backend rate limiting is intentionally NOT implemented (platform gap).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-submission-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ─── Validation ───
const FormSchema = z.object({
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(5).max(40),
  email: z.string().trim().email().max(255),
  address: z.string().trim().min(1).max(255),
  city: z.string().trim().min(1).max(120),
  service_type: z.string().trim().min(1).max(120),
  job_description: z.string().trim().min(1).max(4000),
  hedge_height: z.string().trim().max(80).optional().default(""),
  hedge_length: z.string().trim().max(80).optional().default(""),
  desired_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "desired_date must be YYYY-MM-DD"),
  external_ref: z.string().trim().max(120).optional(),
});
type FormPayload = z.infer<typeof FormSchema>;

// Levenshtein distance for "name almost identical" check
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const similar = (a: string, b: string, threshold = 0.85) => {
  const A = norm(a), B = norm(b);
  if (!A || !B) return false;
  const longest = Math.max(A.length, B.length);
  if (longest === 0) return true;
  const ratio = 1 - levenshtein(A, B) / longest;
  return ratio >= threshold;
};

const buildNotes = (p: FormPayload) =>
  [
    `Prénom: ${p.first_name}`,
    `Nom: ${p.last_name}`,
    `Téléphone: ${p.phone}`,
    `Courriel: ${p.email}`,
    `Adresse: ${p.address}`,
    `Ville: ${p.city}`,
    `Type de service: ${p.service_type}`,
    p.hedge_height ? `Hauteur approx.: ${p.hedge_height}` : null,
    p.hedge_length ? `Longueur approx.: ${p.hedge_length}` : null,
    `Date souhaitée: ${p.desired_date}`,
    "",
    "Description:",
    p.job_description,
  ]
    .filter((l) => l !== null)
    .join("\n");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  // 1) Auth via dedicated submission key
  const expectedKey = Deno.env.get("EXTERNAL_FORM_SUBMISSION_KEY");
  if (!expectedKey) {
    console.error("EXTERNAL_FORM_SUBMISSION_KEY not configured");
    return json(500, { error: "Server misconfigured" });
  }
  const providedKey = req.headers.get("x-submission-key") ?? "";
  if (providedKey !== expectedKey) {
    console.warn("Invalid submission key from", req.headers.get("x-forwarded-for") ?? "unknown");
    return json(401, { error: "Invalid submission key" });
  }

  // 2) Parse body (JSON or multipart)
  const contentType = (req.headers.get("content-type") ?? "").toLowerCase();
  let payload: Record<string, unknown> = {};
  const photoFiles: File[] = [];

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      for (const [key, value] of form.entries()) {
        if (value instanceof File) {
          if (key === "photos" || key === "photos[]") photoFiles.push(value);
        } else {
          payload[key] = value;
        }
      }
    } else if (contentType.includes("application/json")) {
      payload = await req.json();
    } else {
      return json(400, { error: "Unsupported Content-Type. Use application/json or multipart/form-data." });
    }
  } catch (err) {
    console.error("Body parse error:", err);
    return json(400, { error: "Invalid request body" });
  }

  // 3) Validate fields
  const parsed = FormSchema.safeParse(payload);
  if (!parsed.success) {
    return json(400, { error: "Validation failed", details: parsed.error.flatten().fieldErrors });
  }
  const data = parsed.data;

  // 4) Photo validation (optional)
  const MAX_PHOTOS = 10;
  const MAX_PHOTO_SIZE = 8 * 1024 * 1024; // 8 MB
  const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
  if (photoFiles.length > MAX_PHOTOS) {
    return json(400, { error: `Too many photos (max ${MAX_PHOTOS})` });
  }
  for (const f of photoFiles) {
    if (f.size > MAX_PHOTO_SIZE) return json(400, { error: `Photo too large: ${f.name}` });
    if (f.type && !ALLOWED_MIME.has(f.type.toLowerCase())) {
      return json(400, { error: `Unsupported photo type: ${f.type}` });
    }
  }

  // 5) Supabase admin client (service role for insert + storage)
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // 6) Duplicate detection — fetch recent candidates for the same date
  const fullName = `${data.first_name} ${data.last_name}`.trim();
  const { data: candidates, error: dupErr } = await supabase
    .from("estimation_requests")
    .select("id, client_name, client_email, client_phone, requested_date, notes, created_at")
    .eq("requested_date", data.desired_date)
    .eq("hidden", false)
    .neq("status", "done")
    .limit(50);

  if (dupErr) {
    console.error("Duplicate lookup failed:", dupErr);
    return json(500, { error: "Server error during duplicate check" });
  }

  for (const c of candidates ?? []) {
    const samePhone = c.client_phone && norm(c.client_phone) === norm(data.phone);
    const sameEmail = c.client_email && norm(c.client_email) === norm(data.email);
    const nameClose = c.client_name && similar(c.client_name, fullName, 0.85);

    // Strong duplicate: same date AND (same phone OR same email OR name very close)
    if (samePhone || sameEmail || nameClose) {
      console.log("Strong duplicate detected:", { existing: c.id, name: fullName });
      return json(409, {
        error: "Duplicate detected",
        duplicate_of: c.id,
        reason: samePhone ? "same_phone" : sameEmail ? "same_email" : "similar_name",
      });
    }

    // Probable duplicate: very similar description on same date
    if (c.notes && similar(c.notes, buildNotes(data), 0.92)) {
      console.log("Probable duplicate detected:", { existing: c.id });
      return json(409, {
        error: "Duplicate detected",
        duplicate_of: c.id,
        reason: "similar_description",
      });
    }
  }

  // 7) Upload photos (after dedup, before insert)
  const photoUrls: string[] = [];
  if (photoFiles.length) {
    for (const file of photoFiles) {
      try {
        const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().slice(0, 8);
        const key = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("estimation-request-photos")
          .upload(key, file, { contentType: file.type || "image/jpeg", upsert: false });
        if (upErr) {
          console.error("Photo upload failed:", upErr);
          continue;
        }
        const { data: pub } = supabase.storage.from("estimation-request-photos").getPublicUrl(key);
        if (pub?.publicUrl) photoUrls.push(pub.publicUrl);
      } catch (e) {
        console.error("Photo upload exception:", e);
      }
    }
  }

  // 8) Insert request — calendar-only, no other side effects
  const { data: inserted, error: insErr } = await supabase
    .from("estimation_requests")
    .insert({
      client_name: fullName,
      client_phone: data.phone,
      client_email: data.email,
      client_address: `${data.address}, ${data.city}`,
      requested_date: data.desired_date,
      notes: buildNotes(data),
      photos: photoUrls,
      source: "external_website_form",
      external_ref: data.external_ref ?? null,
      status: "pending",
      raw_payload: { ...data, photo_count: photoFiles.length } as unknown as Record<string, unknown>,
    })
    .select("id")
    .single();

  if (insErr) {
    console.error("Insert failed:", insErr);
    return json(500, { error: "Server error during creation" });
  }

  return json(201, {
    success: true,
    id: inserted.id,
    photos: photoUrls.length,
  });
});
