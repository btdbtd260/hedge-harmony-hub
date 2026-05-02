import { supabase } from "@/integrations/supabase/client";

export type CustomerEmailTemplate = "estimation-to-client" | "invoice-to-client";

export async function sendCustomerEmail(opts: {
  templateName: CustomerEmailTemplate;
  recipientEmail: string;
  idempotencyKey: string;
  templateData?: Record<string, any>;
}) {
  const { error, data } = await supabase.functions.invoke("send-transactional-email", {
    body: {
      templateName: opts.templateName,
      recipientEmail: opts.recipientEmail,
      idempotencyKey: opts.idempotencyKey,
      templateData: opts.templateData ?? {},
    },
  });
  if (error) throw error;
  return data;
}
