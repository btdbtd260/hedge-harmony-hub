import { supabase } from "@/integrations/supabase/client";
import { generateEstimationPdf, type EstimationPdfData } from "@/lib/generateEstimationPdf";

const BUCKET = "estimation-pdfs";
// 30 days in seconds. Long enough that recipients can re-open the link, short
// enough that stale links eventually expire.
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 30;

/**
 * Generates the estimation PDF, uploads it to the private `estimation-pdfs`
 * bucket, and returns a short-lived signed download URL plus the chosen
 * filename. Recipients use the signed URL via a button in the email.
 */
export async function generateAndUploadEstimationPdf(
  data: EstimationPdfData,
): Promise<{ signedUrl: string; fileName: string; storagePath: string }> {
  const doc = await generateEstimationPdf(data);
  const blob = doc.output("blob");

  const safeNumber = (data.estimationNumber || "estimation").replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `estimation-${safeNumber}.pdf`;
  // Namespace by estimation number + timestamp to avoid collisions across resends.
  const storagePath = `${safeNumber}/${Date.now()}-${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, blob, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (uploadError) {
    throw new Error(`Échec de l'upload du PDF : ${uploadError.message}`);
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS, {
      download: fileName,
    });
  if (signError || !signed?.signedUrl) {
    throw new Error(`Échec de la génération du lien : ${signError?.message ?? "erreur inconnue"}`);
  }

  return { signedUrl: signed.signedUrl, fileName, storagePath };
}
