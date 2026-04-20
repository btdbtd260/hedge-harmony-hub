import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateQC } from "@/lib/utils";
import { useCustomers, useUpdateJob, getClientNameFromList, type DbJob } from "@/hooks/useSupabaseData";
import { JobPhotosManager } from "@/components/jobs/JobPhotosManager";
import { toast } from "sonner";

interface Props {
  job: DbJob | null;
  onOpenChange: (open: boolean) => void;
}

export function JobDetailDialog({ job, onOpenChange }: Props) {
  const { data: customers = [] } = useCustomers();
  const updateJob = useUpdateJob();
  const snap = job?.measurement_snapshot as any;

  const handleStatusChange = async (jobId: string, newStatus: string) => {
    try {
      await updateJob.mutateAsync({ id: jobId, status: newStatus });
      toast.success(`Statut changé → ${newStatus}`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <Dialog open={!!job} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {job && (
          <>
            <DialogHeader>
              <DialogTitle>Job — {getClientNameFromList(customers, job.client_id)}</DialogTitle>
              <DialogDescription>Détails du job et photos avant/après.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Statut</span>
                <Select value={job.status} onValueChange={(val) => handleStatusChange(job.id, val)}>
                  <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Type de coupe</span><span>{job.cut_type}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Date planifiée</span><span>{formatDateQC(job.scheduled_date)}</span></div>
              {job.start_time && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Début</span><span>{job.start_time}</span></div>}
              {job.end_time && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Fin</span><span>{job.end_time}</span></div>}
              {job.total_duration_minutes && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Durée</span><span>{job.total_duration_minutes} min</span></div>}
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Profit estimé</span><span className="font-semibold">${job.estimated_profit}</span></div>
              {job.real_profit !== null && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Profit réel</span><span className="font-semibold">${job.real_profit}</span></div>}
              {snap && (
                <div className="border-t pt-3">
                  <p className="text-sm font-medium mb-2">Mesures</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Façade: {snap.facadeLength ?? snap.facade_length ?? 0} pi</span>
                    <span className="text-muted-foreground">Gauche: {snap.leftLength ?? snap.left_length ?? 0} pi</span>
                    <span className="text-muted-foreground">Droite: {snap.rightLength ?? snap.right_length ?? 0} pi</span>
                    <span className="text-muted-foreground">Arrière: {snap.backLength ?? snap.back_length ?? 0} pi</span>
                    <span className="text-muted-foreground">Largeur: {snap.width ?? 0} pi</span>
                  </div>
                </div>
              )}
              <JobPhotosManager job={job} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
