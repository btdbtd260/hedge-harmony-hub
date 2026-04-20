import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Mail, Calendar as CalIcon, Clock, ExternalLink } from "lucide-react";
import { useUpdateEstimationRequest, type DbEstimationRequest } from "@/hooks/useSupabaseData";
import { toast } from "sonner";

interface Props {
  request: DbEstimationRequest | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Lightweight viewer for an external estimation request.
 * Read-only fields + actions (mark done, hide).
 * The full conversion-to-job flow can be wired later when external data lands.
 */
export function EstimationRequestDialog({ request, onOpenChange }: Props) {
  const updateRequest = useUpdateEstimationRequest();

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

        <div className="space-y-3 text-sm">
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
              <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{request.client_phone}</div>
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
              <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Notes</p>
              <p className="whitespace-pre-wrap">{request.notes}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-3">
          <Button variant="ghost" size="sm" onClick={hide}>Masquer</Button>
          <Button size="sm" onClick={markDone}>Marquer traitée</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
