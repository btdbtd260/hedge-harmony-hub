import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Mail, Calendar as CalIcon, Clock, ExternalLink, ArrowRight } from "lucide-react";
import {
  useUpdateEstimationRequest,
  useMarkEstimationRequestSeen,
  useCustomers,
  useInsertCustomer,
  type DbEstimationRequest,
} from "@/hooks/useSupabaseData";
import { toast } from "sonner";
import { formatPhone } from "@/lib/phoneFormat";

const norm = (s?: string | null) => (s || "").trim().toLowerCase();

interface Props {
  request: DbEstimationRequest | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Lightweight viewer for an external estimation request.
 * Read-only fields + actions (mark done, hide).
 * Marks the request as "seen" automatically when opened so the sidebar
 * notification badge clears without requiring an explicit action.
 */
export function EstimationRequestDialog({ request, onOpenChange }: Props) {
  const navigate = useNavigate();
  const updateRequest = useUpdateEstimationRequest();
  const markSeen = useMarkEstimationRequestSeen();
  const insertCustomer = useInsertCustomer();
  const { data: customers = [] } = useCustomers();
  const [converting, setConverting] = useState(false);

  // Auto-mark as seen when the dialog opens for an unseen request.
  useEffect(() => {
    if (request && !request.seen_at) {
      markSeen.mutate(request.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.id]);

  if (!request) return null;

  const markDone = async () => {
    await updateRequest.mutateAsync({ id: request.id, updates: { status: "done" } });
    toast.success("Demande marquée comme traitée");
    onOpenChange(false);
  };

  const hide = async () => {
    await updateRequest.mutateAsync({ id: request.id, updates: { hidden: true } });
    toast.success("Demande masquée");
    onOpenChange(false);
  };

  /**
   * Convertit la demande externe en client (créé ou réutilisé) puis ouvre
   * l'onglet Estimation avec ce client présélectionné.
   * Dédup: téléphone > email > (nom + adresse), tous insensibles à la casse.
   * Ne crée AUCUN job — celui-ci sera généré par le workflow normal après
   * la création de l'estimation.
   */
  const convertToClient = async () => {
    if (converting) return;
    setConverting(true);
    try {
      const phone = norm(request.client_phone);
      const email = norm(request.client_email);
      const name = norm(request.client_name);
      const address = norm(request.client_address);

      let match = customers.find((c) => phone && norm(c.phone) === phone);
      if (!match) match = customers.find((c) => email && norm(c.email) === email);
      if (!match) match = customers.find((c) => name && norm(c.name) === name && address && norm(c.address) === address);

      let clientId: string;
      if (match) {
        clientId = match.id;
        toast.success(`Client existant réutilisé : ${match.name}`);
      } else {
        if (!request.client_name?.trim()) {
          toast.error("Nom du client manquant — impossible de créer le client");
          setConverting(false);
          return;
        }
        const created = await insertCustomer.mutateAsync({
          name: request.client_name.trim(),
          phone: request.client_phone || "",
          email: request.client_email || "",
          address: request.client_address || "",
        });
        clientId = created.id;
        toast.success(`Client créé : ${created.name}`);
      }

      // Marque la demande comme traitée + masquée pour qu'elle disparaisse du calendrier.
      await updateRequest.mutateAsync({
        id: request.id,
        updates: { status: "converted", hidden: true },
      });

      onOpenChange(false);
      navigate(`/estimation?clientId=${clientId}`);
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la conversion");
    } finally {
      setConverting(false);
    }
  };

  return (
    <Dialog open={!!request} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-sm bg-estimation-request" />
            <DialogTitle>Estimation à faire</DialogTitle>
          </div>
          <DialogDescription>Demande d'estimation reçue depuis le site web</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <div className="font-semibold text-base">{request.client_name || "Client sans nom"}</div>
            {request.source && (
              <Badge variant="outline" className="mt-1 text-[10px]">
                <ExternalLink className="h-3 w-3 mr-1" />{request.source}
              </Badge>
            )}
          </div>

          <div className="space-y-1.5 border-t pt-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalIcon className="h-4 w-4" />
              <span>{request.requested_date}</span>
              {request.requested_time && (
                <>
                  <Clock className="h-4 w-4 ml-2" />
                  <span>{request.requested_time}</span>
                </>
              )}
            </div>
            {request.client_phone && (
              <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{formatPhone(request.client_phone)}</div>
            )}
            {request.client_email && (
              <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{request.client_email}</div>
            )}
            {request.client_address && (
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{request.client_address}</div>
            )}
          </div>

          {request.notes && (
            <div className="border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Détails</p>
              <p className="whitespace-pre-wrap">{request.notes}</p>
            </div>
          )}

          {Array.isArray(request.photos) && request.photos.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                Photos ({request.photos.length})
              </p>
              <div className="grid grid-cols-2 gap-2">
                {request.photos.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
                    <img
                      src={url}
                      alt={`Photo ${i + 1}`}
                      className="w-full h-32 object-cover rounded border border-border hover:opacity-80 transition"
                      loading="lazy"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 pt-3">
          <Button size="sm" onClick={convertToClient} disabled={converting} className="w-full">
            <ArrowRight className="h-4 w-4" />
            {converting ? "Conversion…" : "Convertir en client + estimation"}
          </Button>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={hide}>Masquer</Button>
            <Button variant="outline" size="sm" onClick={markDone}>Marquer traitée</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
