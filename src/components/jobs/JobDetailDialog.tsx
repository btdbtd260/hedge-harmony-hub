import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarIcon, X, Trash2, Check, Pencil, Pause, Play, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TimeWheelPicker } from "@/components/ui/time-wheel-picker";
import { cn, formatDateOnly } from "@/lib/utils";
import { useCustomers, useUpdateJob, useJobs, useDeleteJob, useEmployeeJobs, getClientNameFromList, getClientAddressFromList, type DbJob } from "@/hooks/useSupabaseData";
import { JobPhotosManager } from "@/components/jobs/JobPhotosManager";
import { JobEmployeesSection } from "@/components/jobs/JobEmployeesSection";
import {
  estimateJobDuration,
  measurementsFromJob,
  computeRealDuration,
  computeTotalPauseMinutes,
  formatDurationMinutes,
  workedTimeInfo,
  getActivePause,
  getPausesFromJob,
  addMinutesToTime,
  getCurrentDateTimeStr,
  isDateTimeFormat,
  parseDateTime,
  getDurationFactorBreakdown,
  type DurationFactor,
} from "@/lib/jobDurationEstimator";
import type { PauseInterval } from "@/types";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
  return y + "-" + m + "-" + day;
}
function extractTimeOnly(s: string | null | undefined): string {
  if (!s) return '';
  if (isDateTimeFormat(s)) {
    return s.substring(11, 16);
  }
  return s.substring(0, 5);
}

function formatTimeDisplay(s: string | null | undefined, jobScheduledDate?: string | null): string {
  if (!s) return '-';
  if (isDateTimeFormat(s)) {
    const datePart = s.substring(0, 10);
    const timePart = s.substring(11, 16);
    if (jobScheduledDate && datePart === jobScheduledDate) {
      return timePart;
    }
    return datePart + ' ' + timePart;
  }
  return s;
}


export function JobDetailDialog({ job, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { data: customers = [] } = useCustomers();
  const { data: allJobs = [] } = useJobs();
  const { data: employeeJobs = [] } = useEmployeeJobs();
  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [completionEndDate, setCompletionEndDate] = useState<string>("");
  const [completionEndTime, setCompletionEndTime] = useState<string>("");
  const [completionTip, setCompletionTip] = useState<string>("0");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [createInvoice, setCreateInvoice] = useState(false);
  const snap = job?.measurement_snapshot as any;

  // Quick tip editor for already-completed jobs
  const [tipDraft, setTipDraft] = useState<string>("");
  useEffect(() => {
    if (job?.status === "completed") setTipDraft(String(job.tip ?? 0));
  }, [job?.id, job?.status, (job as any)?.tip]);

  // Local draft for start_time editing (sync from job, write on blur)
  const [startTimeDraft, setStartTimeDraft] = useState<string>("");
  useEffect(() => {
    setStartTimeDraft(extractTimeOnly(job?.start_time));
  }, [job?.id]);

  // ── Pause/resume state ──
  const [pausesDraft, setPausesDraft] = useState<PauseInterval[]>([]);
  useEffect(() => {
    setPausesDraft(getPausesFromJob(job));
  }, [job?.id]);
  const activePause = getActivePause(pausesDraft);
  const [savingPauses, setSavingPauses] = useState(false);

  const savePauses = async (updated: PauseInterval[]) => {
    if (!job) return;
    setSavingPauses(true);
    try {
      const total = computeTotalPauseMinutes(updated, undefined, job.scheduled_date);
      const existingSnap = (job.measurement_snapshot ?? {}) as any;
      await updateJob.mutateAsync({
        id: job.id,
        measurement_snapshot: { ...existingSnap, pauses: updated, totalPauseMinutes: total },
      } as any);
      setPausesDraft(updated);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingPauses(false);
    }
  };

  const handlePause = async () => {
    const dt = getCurrentDateTimeStr();
    const updated = [...pausesDraft, { start: dt }];
    await savePauses(updated);
    toast.success("Pause démarrée à " + dt);
  };

  const handleResume = async () => {
    const active = getActivePause(pausesDraft);
    if (!active) return;
    const dt = getCurrentDateTimeStr();
    const updated = pausesDraft.map((p) => p === active ? { ...p, end: dt } : p);
    await savePauses(updated);
    toast.success("Reprise à " + dt);
  };

  // Compute (or read) the estimated duration for the current job
  const estimation = useMemo(() => {
    if (!job) return null;
    // Count present employees for this job (from employee_jobs)
    const presentEmployees = employeeJobs.filter(
      (ej) => ej.job_id === job.id && ej.is_present !== false,
    ).length;
    return estimateJobDuration(
      {
        ...measurementsFromJob(job),
        employeeCount: presentEmployees > 0 ? presentEmployees : undefined,
      },
      allJobs,
    );
  }, [job, allJobs, employeeJobs]);

  // Active duration factors for explanation display
  const durationFactors = useMemo(() => {
    if (!job) return [];
    const presentEmployees = employeeJobs.filter(
      (ej) => ej.job_id === job.id && ej.is_present !== false,
    ).length;
    return getDurationFactorBreakdown({
      ...measurementsFromJob(job),
      employeeCount: presentEmployees > 0 ? presentEmployees : undefined,
    });
  }, [job, employeeJobs]);

  // When dialog opens for a scheduled job without a stored estimate, save it once
  useEffect(() => {
    if (!job || !estimation || estimation.minutes <= 0) return;
    if (job.status === "pending") return;
    if (job.estimated_duration_minutes && job.estimated_duration_minutes > 0) return;
    updateJob.mutateAsync({ id: job.id, estimated_duration_minutes: estimation.minutes }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id]);

  // Use recalculated estimate (includes active factors) with fallback to persisted value
  const storedEstimate = estimation?.minutes ?? job?.estimated_duration_minutes ?? null;
  const projectedEnd =
    job?.status === "scheduled" && job.start_time && storedEstimate
      ? addMinutesToTime(job.start_time, storedEstimate)
      : null;

  const handleStatusChange = async (jobId: string, newStatus: string) => {
    if (!job) return;
    if (newStatus === "completed") {
      // Open modal to ask the real end time + tip before persisting status
      const now = new Date();
      setCompletionEndDate(toYmd(now));
      setCompletionEndTime(String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0"));
      setCompletionTip(String(job.tip ?? 0));
      setCreateInvoice(false);
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

    // Build full datetime strings for cross-day accuracy
    const startDate = job.scheduled_date ?? completionEndDate;
    const startDT = startDate + "T" + job.start_time;
    const endDT = completionEndDate + "T" + completionEndTime;

    const pausesForCompletion = getPausesFromJob(job);
    let finalPauses = pausesForCompletion;
    const active = getActivePause(pausesForCompletion);
    if (active) {
      finalPauses = pausesForCompletion.map((p) =>
        p === active ? { ...p, end: endDT } : p,
      );
    }
    const real = computeRealDuration(startDT, endDT, finalPauses);
    if (real === null || real <= 0) {
      toast.error("Heure de fin invalide.");
      return;
    }
    const estimated = storedEstimate ?? estimation?.minutes ?? 0;
    const variance = estimated > 0 ? real - estimated : null;
    try {
      const tipNum = Number(completionTip);

      if (!createInvoice) {
        await supabase.from("invoices").delete().eq("job_id", job.id).eq("status", "draft");
      } else {
        const amount = job.real_profit ?? job.estimated_profit ?? 0;
        const { data: existingDraft } = await supabase
          .from("invoices")
          .select("id")
          .eq("job_id", job.id)
          .eq("status", "draft")
          .maybeSingle();
        if (existingDraft) {
          await supabase.from("invoices").update({ amount }).eq("id", existingDraft.id);
        }
      }

      const existingSnap = (job.measurement_snapshot ?? {}) as any;
      const pauseTotal = computeTotalPauseMinutes(finalPauses, endDT);
      await updateJob.mutateAsync({
        id: job.id,
        status: "completed",
        end_time: completionEndTime,
        total_duration_minutes: real,
        estimated_duration_minutes: estimated || null,
        duration_variance_minutes: variance,
        tip: Number.isFinite(tipNum) && tipNum >= 0 ? tipNum : 0,
        measurement_snapshot: { ...existingSnap, pauses: finalPauses, totalPauseMinutes: pauseTotal, end_date: completionEndDate },
      } as any);

      if (createInvoice) {
        const amount = job.real_profit ?? job.estimated_profit ?? 0;
        const { data: invoiceAfter } = await supabase
          .from("invoices")
          .select("id")
          .eq("job_id", job.id)
          .maybeSingle();
        if (!invoiceAfter) {
          await supabase.from("invoices").insert({
            job_id: job.id,
            client_id: job.client_id,
            amount,
            status: "unpaid",
          });
        }
      }

      setCompletionOpen(false);
      const variancePart =
        variance === null
          ? ""
          : variance === 0
            ? " (pile sur l'estimation)"
            : variance > 0
              ? ` (+${formatDurationMinutes(variance)} vs estimé)`
              : ` (${formatDurationMinutes(variance)} vs estimé)`;
      toast.success(`Job complété — ${formatDurationMinutes(real)} réelles${variancePart}`);
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

  const handleStartTimeChange = (value: string) => {
    setStartTimeDraft(value);
  };

  const handleStartTimeBlur = async () => {
    if (!job) return;
    const val = startTimeDraft || null;
    try {
      await updateJob.mutateAsync({ id: job.id, start_time: val } as any);
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
              {getClientAddressFromList(customers, job.client_id) && (
                <p className="text-xs text-muted-foreground">{getClientAddressFromList(customers, job.client_id)}</p>
              )}
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
                          {job.scheduled_date ? formatDateOnly(job.scheduled_date) : "Choisir une date"}
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

              {/* SCHEDULED — show start time only (native input) */}
              {job.status === "scheduled" && (
                <>
                  <div className="flex justify-between items-center text-sm gap-2">
                    <span className="text-muted-foreground">Heure de départ</span>
                    <Input
                      type="time"
                      value={startTimeDraft}
                      onChange={(e) => handleStartTimeChange(e.target.value)}
                      onBlur={handleStartTimeBlur}
                      className="h-8 w-36"
                    />
                  </div>
                  {storedEstimate && storedEstimate > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Durée estimée</span>
                      <span title={estimation?.explanation ?? undefined}>
                        ~{formatDurationMinutes(storedEstimate)}
                        {projectedEnd && (
                          <span className="text-muted-foreground"> · fin estimée {projectedEnd}</span>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Pause controls */}
                  {job.start_time && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Pause</span>
                      <div className="flex items-center gap-2">
                        {activePause ? (
                          <>
                            <span className="text-amber-600 text-xs">
                              En pause depuis {activePause.start}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 text-green-600 border-green-300 hover:bg-green-50"
                              disabled={savingPauses}
                              onClick={handleResume}
                            >
                              <Play className="h-3 w-3" />
                              Reprendre
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 text-amber-600 border-amber-300 hover:bg-amber-50"
                            disabled={savingPauses}
                            onClick={handlePause}
                          >
                            <Pause className="h-3 w-3" />
                            Pause
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  {pausesDraft.length > 0 && (
                    <div className="text-xs text-muted-foreground text-right">
                      Pauses totales : {formatDurationMinutes(computeTotalPauseMinutes(pausesDraft))}
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
                  {(() => {
                    const info = workedTimeInfo(job.start_time, job.end_time, pausesDraft.length > 0 ? pausesDraft : undefined);
                    return (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Temps total écoulé</span>
                          <span>{info.elapsed !== null ? formatDurationMinutes(info.elapsed) : "—"}</span>
                        </div>
                        {info.pauseTotal > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Temps de pause</span>
                            <span className="text-amber-600">{formatDurationMinutes(info.pauseTotal)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm font-medium">
                          <span className="text-muted-foreground">Temps travaillé</span>
                          <span>{info.worked !== null ? formatDurationMinutes(info.worked) : "—"}</span>
                        </div>
                      </>
                    );
                  })()}
                  {storedEstimate && storedEstimate > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Durée estimée</span>
                      <span>{formatDurationMinutes(storedEstimate)}</span>
                    </div>
                  )}
                  {storedEstimate &&
                    storedEstimate > 0 &&
                    typeof job.total_duration_minutes === "number" && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Écart vs estimation</span>
                      <span className={cn(
                        "font-semibold",
                        (job.total_duration_minutes - storedEstimate) > 0 ? "text-cut-levelling" : "text-cut-trim",
                      )}>
                        {(job.total_duration_minutes - storedEstimate) > 0 ? "+" : ""}{formatDurationMinutes(Math.abs(job.total_duration_minutes - storedEstimate))}
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

              {/* ── Duration factors (discrete explanation) ── */}
              {durationFactors.length > 0 && (
                <DurationFactorsList factors={durationFactors} />
              )}

              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Profit estimé</span><span className="font-semibold">${job.estimated_profit}</span></div>
              {job.real_profit !== null && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Profit réel</span><span className="font-semibold">${job.real_profit}</span></div>}

              {/* Employees on this job (add/remove + hours + Absent button) */}
              <JobEmployeesSection job={job} />

              {snap && (() => {
                const avantGauche = snap.leftLength ?? snap.left_length ?? 0;
                const avantFacade = snap.facadeLength ?? snap.facade_length ?? 0;
                const avantDroite = snap.rightLength ?? snap.right_length ?? 0;
                const arriereGauche = snap.backLeftLength ?? snap.back_left_length ?? 0;
                const arriereFond = snap.backLength ?? snap.back_length ?? 0;
                const arriereDroite = snap.backRightLength ?? snap.back_right_length ?? 0;
                const hasAvant = avantGauche > 0 || avantFacade > 0 || avantDroite > 0;
                const hasArriere = arriereGauche > 0 || arriereFond > 0 || arriereDroite > 0;
                const bushItems: Array<{ description: string; count: number; price: number }> =
                  snap.bushItems ?? [];
                const hasBushes = bushItems.length > 0;
                return (
                  <div className="border-t pt-3">
                    <p className="text-sm font-medium mb-2">Mesures</p>
                    {hasAvant && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Avant</p>
                        <div className="grid grid-cols-3 gap-1 text-sm">
                          {avantGauche > 0 && <span>Gauche: {avantGauche} pi</span>}
                          {avantFacade > 0 && <span>Façade: {avantFacade} pi</span>}
                          {avantDroite > 0 && <span>Droite: {avantDroite} pi</span>}
                        </div>
                      </div>
                    )}
                    {hasArriere && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Arrière</p>
                        <div className="grid grid-cols-3 gap-1 text-sm">
                          {arriereGauche > 0 && <span>Gauche: {arriereGauche} pi</span>}
                          {arriereFond > 0 && <span>Fond: {arriereFond} pi</span>}
                          {arriereDroite > 0 && <span>Droite: {arriereDroite} pi</span>}
                        </div>
                      </div>
                    )}
                    {hasBushes && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Arbustes</p>
                        {bushItems.map((bush, idx) => {
                          const totalPrice = bush.count * bush.price;
                          return (
                            <div key={idx} className="text-sm">
                              {bush.description} (x{bush.count}) — ${totalPrice.toFixed(2)}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
              {/* Extras — visible extras from measurement snapshot */}
              {snap && (() => {
                const extras: Array<{ description: string; price: number }> =
                  snap.extras ?? [];
                const visibleExtras = extras.filter(
                  (e) => e.description?.trim() !== "" || e.price !== 0,
                );
                if (visibleExtras.length === 0) return null;
                return (
                  <div className="border-t pt-3">
                    <p className="text-sm font-medium mb-2">Extras</p>
                    {visibleExtras.map((extra, idx) => (
                      <div key={idx} className="text-sm">
                        {extra.description}{" "}
                        <span className="font-medium">${extra.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <JobPhotosManager job={job} />

              {/* ── Admin pause editor ── */}
              {job.status !== "pending" && pausesDraft.length > 0 && (
                <AdminPauseEditor
                  pauses={pausesDraft}
                  onChange={async (updated) => { await savePauses(updated); }}
                  saving={savingPauses}
                />
              )}

              {/* ── Action buttons (Compléter + Modifier + Supprimer) ── */}
              <div className="border-t pt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {job.status !== "completed" ? (
                    <Button
                      size="sm"
                      className="bg-success text-success-foreground hover:bg-success/90"
                      onClick={() => handleStatusChange(job.id, "completed")}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Marquer comme complété
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Job complété</span>
                  )}
                  {job.status !== "completed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/jobs/${job.id}/edit-details`)}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Modifier détail job
                    </Button>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Supprimer ce job
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>

      {/* ── Delete confirmation ── */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Supprimer ce job ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est <strong>définitive</strong>. Le job
              {job ? ` de ${getClientNameFromList(customers, job.client_id)}` : ""}, son{" "}
              <strong>estimation liée</strong>, <strong>toutes ses factures (incluant payées)</strong>{" "}
              et les heures employés seront supprimés.
              <br />
              <span className="text-foreground">L'impact dans Finance sera retiré.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!job) return;
                try {
                  await deleteJob.mutateAsync(job.id);
                  toast.success("Job supprimé");
                  // Sequence cleanup so stacked Radix overlays (AlertDialog +
                  // parent Dialog) don't leave <body> with pointer-events:none.
                  // 1) Close the confirm AlertDialog
                  setConfirmDelete(false);
                  // 2) Close the parent Dialog on the next tick
                  setTimeout(() => {
                    onOpenChange(false);
                    document.body.style.pointerEvents = "";
                    document.body.style.removeProperty("pointer-events");
                  }, 50);
                  // 3) Final safety net — clear again after Radix's exit
                  // animations have settled (covers slow devices).
                  setTimeout(() => {
                    document.body.style.pointerEvents = "";
                    document.body.style.removeProperty("pointer-events");
                  }, 300);
                } catch (e: any) {
                  toast.error(e.message ?? "Échec de la suppression");
                }
              }}
            >
              {deleteJob.isPending ? "Suppression…" : "Supprimer définitivement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Date de fin</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-left font-normal h-9"
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {completionEndDate ? formatDateOnly(completionEndDate) : "Choisir"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={parseYmdLocal(completionEndDate)}
                      onSelect={(d) => d && setCompletionEndDate(toYmd(d))}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Heure de fin</Label>
                <TimeWheelPicker value={completionEndTime} onChange={setCompletionEndTime} />
              </div>
            </div>
            {job?.start_time && (() => {
              const startDate = job.scheduled_date ?? completionEndDate;
              const startDT = startDate + "T" + job.start_time;
              const endDT = completionEndDate + "T" + completionEndTime;
              const pausesNow = getPausesFromJob(job);
              const active = getActivePause(pausesNow);
              const finalP = active
                ? pausesNow.map((p) => p === active ? { ...p, end: endDT } : p)
                : pausesNow;
              const est = computeRealDuration(startDT, endDT) ?? 0;
              const pauseTotal = computeTotalPauseMinutes(finalP, endDT);
              const worked = Math.max(0, est - pauseTotal);
              return (
                <div className="text-sm text-center text-muted-foreground space-y-1">
                  <p>
                    Début : <span className="font-medium text-foreground">{job.scheduled_date ?? "—"} {job.start_time.slice(0, 5)}</span>
                  </p>
                  <p>
                    Durée totale : <span className="font-semibold text-foreground">{formatDurationMinutes(est)}</span>
                    {storedEstimate ? <> · estimée {formatDurationMinutes(storedEstimate)}</> : null}
                  </p>
                  {pauseTotal > 0 && (
                    <p>
                      Pauses : <span className="font-semibold text-amber-600">{formatDurationMinutes(pauseTotal)}</span>
                    </p>
                  )}
                  <p>
                    Temps travaillé : <span className="font-semibold text-foreground">{formatDurationMinutes(worked)}</span>
                  </p>
                </div>
              );
            })()}
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

            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Créer une facture ?</Label>
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant={!createInvoice ? "default" : "outline"} onClick={() => setCreateInvoice(false)}>Non</Button>
                  <Button type="button" size="sm" variant={createInvoice ? "default" : "outline"} onClick={() => setCreateInvoice(true)}>Oui</Button>
                </div>
              </div>
              {createInvoice && (
                <p className="text-xs text-muted-foreground">
                  Montant: ${(job?.real_profit ?? job?.estimated_profit ?? 0).toFixed(2)} (sans le tip)
                </p>
              )}
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

// ── Admin pause editor (collapsible) ──
function AdminPauseEditor({
  pauses,
  onChange,
  saving,
}: {
  pauses: PauseInterval[];
  onChange: (updated: PauseInterval[]) => Promise<void>;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false);

  const updatePause = async (index: number, field: "start" | "end", value: string) => {
    const updated = pauses.map((p, i) => (i === index ? { ...p, [field]: value || undefined } : p));
    await onChange(updated);
  };

  const deletePause = async (index: number) => {
    const updated = pauses.filter((_, i) => i !== index);
    await onChange(updated);
  };

  const formatPauseValue = (val: string | undefined, part: "date" | "time"): string => {
    if (!val) return "";
    if (isDateTimeFormat(val)) {
      if (part === "date") return val.substring(0, 10);
      return val.substring(11);
    }
    return part === "time" ? val : "";
  };

  const updatePauseDT = async (index: number, field: "start" | "end", part: "date" | "time", value: string) => {
    const p = pauses[index];
    const currentVal = p[field] ?? "";
    if (isDateTimeFormat(currentVal)) {
      const datePart = part === "date" ? value : currentVal.substring(0, 10);
      const timePart = part === "time" ? value : currentVal.substring(11);
      const newVal = datePart + "T" + timePart;
      const updated = pauses.map((pau, i) => (i === index ? { ...pau, [field]: newVal } : pau));
      await onChange(updated);
    } else {
      const newVal = part === "time" ? value : value + "T" + (currentVal || "00:00");
      const updated = pauses.map((pau, i) => (i === index ? { ...pau, [field]: newVal } : pau));
      await onChange(updated);
    }
  };

  const addPause = async () => {
    const dt = getCurrentDateTimeStr();
    const updated = [...pauses, { start: dt }];
    await onChange(updated);
  };

  return (
    <div className="border-t pt-3">
      <button
        type="button"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <span className="text-xs">{open ? "▾" : "▸"}</span>
        Modifier les pauses ({pauses.length})
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {pauses.map((p, i) => {
            const startIsDT = isDateTimeFormat(p.start);
            return (
              <div key={i} className="flex flex-wrap items-center gap-1 text-sm">
                <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                {startIsDT && (
                  <input
                    type="date"
                    value={formatPauseValue(p.start, "date")}
                    onChange={(e) => updatePauseDT(i, "start", "date", e.target.value)}
                    className="h-7 w-36 rounded border px-1 text-xs"
                    disabled={saving}
                  />
                )}
                <input
                  type="time"
                  value={formatPauseValue(p.start, "time")}
                  onChange={(e) => updatePauseDT(i, "start", "time", e.target.value)}
                  className="h-7 w-28 rounded border px-1 text-xs"
                  disabled={saving}
                />
                <span className="text-xs text-muted-foreground">→</span>
                {p.end && isDateTimeFormat(p.end) && (
                  <input
                    type="date"
                    value={formatPauseValue(p.end, "date")}
                    onChange={(e) => updatePauseDT(i, "end", "date", e.target.value)}
                    className="h-7 w-36 rounded border px-1 text-xs"
                    disabled={saving}
                  />
                )}
                <input
                  type="time"
                  value={formatPauseValue(p.end, "time")}
                  onChange={(e) => updatePauseDT(i, "end", "time", e.target.value)}
                  className="h-7 w-28 rounded border px-1 text-xs"
                  disabled={saving}
                  placeholder={p.end ? "" : "En cours"}
                />
                <button
                  type="button"
                  className="text-destructive hover:text-destructive/80 ml-1"
                  onClick={() => deletePause(i)}
                  disabled={saving}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            disabled={saving}
            onClick={addPause}
          >
            <Plus className="h-3 w-3" />
            Ajouter une pause
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Duration Factors list (explains why the estimate changed) ──
function DurationFactorsList({ factors }: { factors: DurationFactor[] }) {
  if (factors.length === 0) return null;
  return (
    <div className="border-t pt-3 space-y-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Facteurs de durée</p>
      {factors.map((f, i) => (
        <div key={i} className="flex items-start gap-2 text-sm">
          <span className="text-muted-foreground mt-0.5">•</span>
          <div className="flex-1">
            <span className="text-muted-foreground">{f.label}: </span>
            <span>{f.detail}</span>
            {f.impactLabel && (
              <span className="ml-1 text-xs font-medium text-amber-600">{f.impactLabel}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
