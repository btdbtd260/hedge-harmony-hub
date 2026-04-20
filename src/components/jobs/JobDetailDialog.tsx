import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, formatDateQC } from "@/lib/utils";
import { useCustomers, useUpdateJob, getClientNameFromList, type DbJob } from "@/hooks/useSupabaseData";
import { JobPhotosManager } from "@/components/jobs/JobPhotosManager";
import { toast } from "sonner";

interface Props {
  job: DbJob | null;
  onOpenChange: (open: boolean) => void;
}

// Parse YYYY-MM-DD as local date (avoid TZ shift)
function parseYmdLocal(s: string | null | undefined): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}
function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function JobDetailDialog({ job, onOpenChange }: Props) {
  const { data: customers = [] } = useCustomers();
  const updateJob = useUpdateJob();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const snap = job?.measurement_snapshot as any;

  const handleStatusChange = async (jobId: string, newStatus: string) => {
    try {
      // If reverting to pending, clear scheduled_date so it doesn't appear in Calendar
      const patch: any = { id: jobId, status: newStatus };
      if (newStatus === "pending") patch.scheduled_date = null;
      await updateJob.mutateAsync(patch);
      toast.success(
        newStatus === "pending"
          ? "Statut → Pending (date planifiée retirée)"
          : `Statut changé → ${newStatus}`,
      );
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDateChange = async (jobId: string, date: Date | undefined) => {
    try {
      const patch: any = { id: jobId, scheduled_date: date ? toYmd(date) : null };
      // Auto-promote pending → scheduled when a date is assigned
      const promoted = date && job?.status === "pending";
      if (promoted) patch.status = "scheduled";
      await updateJob.mutateAsync(patch);
      toast.success(
        date
          ? promoted
            ? "Date enregistrée — statut → Scheduled"
            : "Date planifiée enregistrée"
          : "Date planifiée retirée",
      );
      setDatePickerOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleTimeChange = async (jobId: string, field: "start_time" | "end_time", value: string) => {
    const v = value.trim() === "" ? null : value;
    try {
      await updateJob.mutateAsync({ id: jobId, [field]: v } as any);
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

              {/* Scheduled date — hidden when status === "pending" */}
              {job.status !== "pending" && (
                <div className="flex justify-between items-center text-sm gap-2">
                  <span className="text-muted-foreground">Date planifiée</span>
                  <div className="flex items-center gap-1">
                    <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn("h-8 justify-start text-left font-normal min-w-[160px]", !job.scheduled_date && "text-muted-foreground")}
                        >
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {job.scheduled_date ? formatDateQC(job.scheduled_date) : "Choisir une date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                          mode="single"
                          selected={parseYmdLocal(job.scheduled_date)}
                          onSelect={(d) => handleDateChange(job.id, d)}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    {job.scheduled_date && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleDateChange(job.id, undefined)}
                        title="Retirer la date"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              )}

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
