import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State = "loading" | "valid" | "already" | "invalid" | "success" | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Désabonnement - Taille de haie ACF";
    if (!token) { setState("invalid"); return; }
    fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`, {
      headers: { apikey: SUPABASE_ANON_KEY },
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (data?.valid) setState("valid");
        else if (data?.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      })
      .catch(() => setState("invalid"));
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
    setSubmitting(false);
    if (error) { setState("error"); return; }
    if ((data as any)?.success) setState("success");
    else if ((data as any)?.reason === "already_unsubscribed") setState("already");
    else setState("error");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader><CardTitle>Désabonnement</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {state === "loading" && <p className="text-sm text-muted-foreground">Vérification…</p>}
          {state === "valid" && (
            <>
              <p className="text-sm">Cliquez ci-dessous pour confirmer votre désabonnement des courriels de Taille de haie ACF.</p>
              <Button onClick={confirm} disabled={submitting} className="w-full">
                {submitting ? "Traitement…" : "Confirmer le désabonnement"}
              </Button>
            </>
          )}
          {state === "already" && <p className="text-sm">Vous êtes déjà désabonné.</p>}
          {state === "success" && <p className="text-sm">Vous avez été désabonné avec succès.</p>}
          {state === "invalid" && <p className="text-sm text-destructive">Lien invalide ou expiré.</p>}
          {state === "error" && <p className="text-sm text-destructive">Une erreur est survenue. Veuillez réessayer.</p>}
        </CardContent>
      </Card>
    </main>
  );
}
