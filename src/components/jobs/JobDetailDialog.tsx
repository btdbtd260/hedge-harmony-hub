import { useState, useEffect, useMemo } from "react";
import { CalendarIcon, X, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TimeWheelPicker } from "@/components/ui/time-wheel-picker";
import { cn, formatDateQC } from "@/lib/utils";
import { useCustomers, useUpdateJob, useJobs, getClientNameFromList, type DbJob } from "@/hooks/useSupabaseData";
import { JobPhotosManager } from "@/components/jobs/JobPhotosManager";
import { JobEmployeesSection } from "@/components/jobs/JobEmployeesSection";
import {
  estimateJobDuration,
  measurementsFromJob,
  computeRealDuration,
  addMinutesToTime,
} from "@/lib/jobDurationEstimator";
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
  const { data: allJobs = [] } = useJobs();
  const updateJob = useUpdateJob();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [completionEndTime, setCompletionEndTime] = useState<string>("17:00");
  const [completionTip, setCompletionTip] = useState<string>("0");
  const snap = job?.measurement_snapshot as any;

  // Quick tip editor for already-completed jobs
  const [tipDraft, setTipDraft] = useState<string>("");
  useEffect(() => {
    if (job?.status === "completed") setTipDraft(String(job.tip ?? 0));
  }, [job?.id, job?.status, (job as any)?.tip]);

  // Compute (or read) the estimated duration for the current job
  const estimation = useMemo(() => {
    if (!job) return null;
    return estimateJobDuration(measurementsFromJob(job), allJobs);
  }, [job, allJobs]);

  // When dialog opens for a scheduled job without a stored estimate, save it once
  useEffect(() => {
    if (!job || !estimation || estimation.minutes <= 0) return;
    if (job.status === "pending") return;
    if (job.estimated_duration_minutes && job.estimated_duration_minutes > 0) return;
    updateJob.mutateAsync({ id: job.id, estimated_duration_minutes: estimation.minutes }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id]);

  const storedEstimate = job?.estimated_duration_minutes ?? estimation?.minutes ?? null;
  const projectedEnd =
    job?.status === "scheduled" && job.start_time && storedEstimate
      ? addMinutesToTime(job.start_time, storedEstimate)
      : null;

  const handleStatusChange = async (jobId: string, newStatus: string) => {
    if (!job) return;
    if (newStatus === "completed") {
      // Open modal to ask the real end time + tip before persisting status
      setCompletionEndTime(job.end_time?.slice(0, 5) || addMinutesToTime(job.start_time, storedEstimate ?? 60) || "17:00");
      setCompletionTip(String(job.tip ?? 0));
      setCompletionOpen(true);
      return;
    }
    try {
      const patch: any = { id: jobId, status: newStatus };
      if (newStatus === "pending") {
        patch.scheduled_date = null;
        patch.start_time = null;
        patch.end_time = null;
      }
      await updateJob.mutateAsync(patch);
      toast.success(
        newStatus === "pending"
          ? "Statut → Pending (planification retirée)"
          : `Statut changé → ${newStatus}`,
      );
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleConfirmCompletion = async () => {
    if (!job) return;
    if (!job.start_time) {
      toast.error("Heure de début manquante pour calculer la durée réelle.");
      return;
    }
    const real = computeRealDuration(job.start_time, completionEndTime);
    if (real === null || real <= 0) {
      toast.error("Heure de fin invalide.");
      return;
    }
    const estimated = storedEstimate ?? estimation?.minutes ?? 0;
    const variance = estimated > 0 ? real - estimated : null;
    try {
      const tipNum = Number(completionTip);
      await updateJob.mutateAsync({
        id: job.id,
        status: "completed",
        end_time: completionEndTime,
        total_duration_minutes: real,
        estimated_duration_minutes: estimated || null,
        duration_variance_minutes: variance,
        tip: Number.isFinite(tipNum) && tipNum >= 0 ? tipNum : 0,
      } as any);
      setCompletionOpen(false);
      const variancePart =
        variance === null
          ? ""
          : variance === 0
            ? " (pile sur l'estimation)"
            : variance > 0
              ? ` (+${variance} min vs estimé)`
              : ` (${variance} min vs estimé)`;
      toast.success(`Job complété — ${real} min réelles${variancePart}`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDateChange = async (jobId: string, date: Date | undefined) => {
    try {
      const patch: any = { id: jobId, scheduled_date: date ? toYmd(date) : null };
      const promoted = date && job?.status === "pending";
      if (promoted) patch.status = "scheduled";
      // Refresh estimation when the job becomes scheduled
      if ((promoted || job?.status === "scheduled") && estimation && estimation.minutes > 0) {
        patch.estimated_duration_minutes = estimation.minutes;
      }
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

  const handleStartTimeChange = async (value: string) => {
    if (!job) return;
    try {
      await updateJob.mutateAsync({ id: job.id, start_time: value } as any);
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
              <DialogDescription>Détails du job, horaire et photos.</DialogDescription>
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

              {/* SCHEDULED — show start time only (wheel picker) */}
              {job.status === "scheduled" && (
                <>
                  <div className="flex justify-between items-center text-sm gap-2">
                    <span className="text-muted-foreground">Heure de départ</span>
                    <Popover open={startPickerOpen} onOpenChange={setStartPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 min-w-[110px]">
                          <Clock className="mr-2 h-3.5 w-3.5" />
                          {job.start_time?.slice(0, 5) || "Choisir"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-3" align="end">
                        <TimeWheelPicker
                          value={job.start_time?.slice(0, 5) ?? "08:00"}
                          onChange={handleStartTimeChange}
                        />
                        <div className="flex justify-end pt-2">
                          <Button size="sm" onClick={() => setStartPickerOpen(false)}>OK</Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  {storedEstimate && storedEstimate > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Durée estimée</span>
                      <span title={estimation?.explanation ?? undefined}>
                        ~{storedEstimate} min
                        {projectedEnd && (
                          <span className="text-muted-foreground"> · fin estimée {projectedEnd}</span>
                        )}
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* COMPLETED — show start + end + comparison */}
              {job.status === "completed" && (
                <>
                  {job.start_time && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Heure de départ</span>
                      <span>{job.start_time.slice(0, 5)}</span>
                    </div>
                  )}
                  {job.end_time && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Heure de fin</span>
                      <span>{job.end_time.slice(0, 5)}</span>
                    </div>
                  )}
                  {job.total_duration_minutes && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Durée réelle</span>
                      <span className="font-medium">{job.total_duration_minutes} min</span>
                    </div>
                  )}
                  {job.estimated_duration_minutes && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Durée estimée</span>
                      <span>{job.estimated_duration_minutes} min</span>
                    </div>
                  )}
                  {typeof job.duration_variance_minutes === "number" && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Écart vs estimation</span>
                      <span className={cn(
                        "font-semibold",
                        job.duration_variance_minutes > 0 ? "text-cut-levelling" : "text-cut-trim",
                      )}>
                        {job.duration_variance_minutes > 0 ? "+" : ""}{job.duration_variance_minutes} min
                      </span>
                    </div>
                  )}

                  {/* Tip — editable directly on completed jobs */}
                  <div className="flex justify-between items-center text-sm gap-2">
                    <Label className="text-muted-foreground">Tip reçu</Label>
                    <div className="flex items-center gap-1">
                      <span className="text-sm">$</span>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={tipDraft}
                        onChange={(e) => setTipDraft(e.target.value)}
                        onBlur={async () => {
                          const n = Number(tipDraft);
                          if (Number.isNaN(n) || n < 0) return;
                          if (n === Number(job.tip ?? 0)) return;
                          try {
                            await updateJob.mutateAsync({ id: job.id, tip: n } as any);
                            toast.success("Tip mis à jour");
                          } catch (e: any) { toast.error(e.message); }
                        }}
                        className="h-8 w-24"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Profit estimé</span><span className="font-semibold">${job.estimated_profit}</span></div>
              {job.real_profit !== null && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Profit réel</span><span className="font-semibold">${job.real_profit}</span></div>}

              {/* Employees on this job (add/remove + hours + Absent button) */}
              <JobEmployeesSection job={job} />

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

      {/* ── Completion modal — asks for end time + tip ── */}
      <Dialog open={completionOpen} onOpenChange={setCompletionOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Marquer le job comme complété</DialogTitle>
            <DialogDescription>
              Choisis l'heure de fin réelle et le tip reçu.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {job?.start_time && (
              <p className="text-sm text-muted-foreground">
                Début : <span className="font-medium text-foreground">{job.start_time.slice(0, 5)}</span>
              </p>
            )}
            <div className="flex justify-center">
              <TimeWheelPicker value={completionEndTime} onChange={setCompletionEndTime} />
            </div>
            {job?.start_time && (
              <p className="text-sm text-center text-muted-foreground">
                Durée réelle : <span className="font-semibold text-foreground">
                  {computeRealDuration(job.start_time, completionEndTime) ?? 0} min
                </span>
                {storedEstimate ? <> · estimée {storedEstimate} min</> : null}
              </p>
            )}
            <div className="space-y-1">
              <Label>Tip reçu ($)</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={completionTip}
                onChange={(e) => setCompletionTip(e.target.value)}
                placeholder="0"
              />
              <p className="text-[11px] text-muted-foreground">
                Sera ajouté au total de la job pour la part des admins.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompletionOpen(false)}>Annuler</Button>
            <Button onClick={handleConfirmCompletion}>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
