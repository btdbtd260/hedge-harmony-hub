import { useState } from "react";
import { Trash2, ShieldOff, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatPhone, formatPhoneLive } from "@/lib/phoneFormat";
import {
  useBlockedNumbers,
  useAddBlockedNumber,
  useRemoveBlockedNumber,
  isProtectedBlockedNumber,
  type DbBlockedNumber,
} from "@/hooks/useBlockedNumbers";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert } from "lucide-react";
import { formatDateQC } from "@/lib/utils";

export function BlockedNumbersTab() {
  const { data: blocked = [], isLoading } = useBlockedNumbers();
  const addBlocked = useAddBlockedNumber();
  const removeBlocked = useRemoveBlockedNumber();

  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [toDelete, setToDelete] = useState<DbBlockedNumber | null>(null);

  const handleAdd = async () => {
    if (!phone.trim()) return;
    try {
      await addBlocked.mutateAsync({ phone, reason });
      setPhone("");
      setReason("");
      toast.success("Numéro bloqué");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur lors de l'ajout";
      toast.error(msg);
    }
  };

  const handleConfirmDelete = async () => {
    if (!toDelete) return;
    try {
      await removeBlocked.mutateAsync(toDelete.id);
      toast.success("Numéro débloqué");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur lors de la suppression";
      toast.error(msg);
    } finally {
      setToDelete(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Formulaire d'ajout */}
      <div className="p-4 border-b bg-card">
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_auto] gap-3 items-end">
          <div className="space-y-1">
            <Label htmlFor="block-phone">Numéro à bloquer</Label>
            <Input
              id="block-phone"
              value={phone}
              onChange={(e) => setPhone(formatPhoneLive(e.target.value))}
              placeholder="514-555-0000"
              inputMode="tel"
              maxLength={12}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="block-reason">Raison (facultatif)</Label>
            <Input
              id="block-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Spam, harcèlement, etc."
              maxLength={200}
            />
          </div>
          <Button
            onClick={handleAdd}
            disabled={addBlocked.isPending || !phone.trim()}
          >
            <Plus className="h-4 w-4 mr-1" />
            Bloquer
          </Button>
        </div>
      </div>

      {/* Liste */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Chargement…</p>
        ) : blocked.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
            <ShieldOff className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">Aucun numéro bloqué</p>
          </div>
        ) : (
          <ul className="divide-y">
            {blocked.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium">{formatPhone(b.phone)}</p>
                  {b.reason && (
                    <p className="text-xs text-muted-foreground truncate">{b.reason}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    Ajouté le {formatDateQC(b.created_at)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setToDelete(b)}
                  aria-label="Débloquer"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Débloquer ce numéro&nbsp;?</AlertDialogTitle>
            <AlertDialogDescription>
              Le numéro {toDelete && formatPhone(toDelete.phone)} pourra à nouveau envoyer
              et recevoir des messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Débloquer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
