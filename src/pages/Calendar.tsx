import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
import { ChevronLeft, ChevronRight, CalendarDays, Check } from "lucide-react";
import {
  useJobs,
  useCustomers,
  useEstimationRequests,
  useUpdateJob,
  useUpdateEstimationRequest,
  getClientNameFromList,
  type DbJob,
  type DbEstimationRequest,
} from "@/hooks/useSupabaseData";
import { JobDetailDialog } from "@/components/jobs/JobDetailDialog";
import { EstimationRequestDialog } from "@/components/calendar/EstimationRequestDialog";
import { addMinutesToTime, computeRealDuration } from "@/lib/jobDurationEstimator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ViewMode = "month" | "week";

const MONTH_NAMES = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const DAY_NAMES = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

// Helpers — work in local time to avoid TZ shifts
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay()); // Sunday start
  r.setHours(0, 0, 0, 0);
  return r;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function startOfMonthGrid(d: Date): Date {
  // First day of month, then back to Sunday
  return startOfWeek(new Date(d.getFullYear(), d.getMonth(), 1));
}
function parseTimeToMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  // Accept "HH:mm" or full ISO
  const m = t.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}
function minutesToHHmm(total: number): string {
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const mm = String(wrapped % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}
/**
 * End time displayed in the calendar for a scheduled job.
 * If end_time is set (rare for scheduled), use it. Otherwise project from
 * start_time + estimated_duration_minutes. Returns null if not computable.
 */
function projectedEndTime(j: DbJob): string | null {
  if (j.end_time) return j.end_time.slice(0, 5);
  const start = parseTimeToMinutes(j.start_time);
  if (start === null) return null;
  const est = j.estimated_duration_minutes;
  if (!est || est <= 0) return null;
  return minutesToHHmm(start + est);
}

// Color classes per cut type — uses semantic tokens from index.css.
// Note: cut_type is always one of the 3 real types (trim/levelling/restoration).
// A custom price-per-foot does NOT change the color — it stays tied to the chosen cut type.
function cutTypeClasses(cutType: string | null | undefined): string {
  if (cutType === "levelling") {
    return "bg-cut-levelling/15 text-cut-levelling hover:bg-cut-levelling/25 border-l-2 border-cut-levelling";
  }
  if (cutType === "restoration") {
    return "bg-cut-restoration/15 text-cut-restoration hover:bg-cut-restoration/25 border-l-2 border-cut-restoration";
  }
  if (cutType === "trim") {
    return "bg-cut-trim/15 text-cut-trim hover:bg-cut-trim/25 border-l-2 border-cut-trim";
  }
  return "bg-muted text-muted-foreground hover:bg-muted/80 border-l-2 border-muted-foreground/40";
}
// Pick the right color block for a job — completed jobs use gray.
function jobClasses(j: DbJob): string {
  if (j.status === "completed") return COMPLETED_CLASSES;
  return cutTypeClasses(j.cut_type);
}
// Pick the right color block for an estimation request — done = gray, otherwise blue.
function requestClasses(r: DbEstimationRequest): string {
  if (r.status === "done") return COMPLETED_CLASSES;
  return REQUEST_CLASSES;
}
function cutTypeLabel(cutType: string | null | undefined): string {
  if (cutType === "levelling") return "Nivelage";
  if (cutType === "restoration") return "Restauration";
  if (cutType === "trim") return "Taillage";
  return cutType || "Autre";
}

// Reusable estimation request style (blue) — shared across views.
const REQUEST_CLASSES =
  "bg-estimation-request/15 text-estimation-request hover:bg-estimation-request/25 border-l-2 border-estimation-request";

// Gray styling for completed events (jobs with status=completed, requests with status=done)
const COMPLETED_CLASSES =
  "bg-muted text-muted-foreground hover:bg-muted/80 border-l-2 border-muted-foreground/40 opacity-70";

const CalendarPage = () => {
  const { data: jobs = [] } = useJobs();
  const { data: customers = [] } = useCustomers();
  const { data: estimationRequests = [] } = useEstimationRequests();
  const updateJob = useUpdateJob();
  const updateRequest = useUpdateEstimationRequest();

  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  // Confirmation state for "Compléter" button — single source of truth across views
  const [pendingComplete, setPendingComplete] = useState<
    | { kind: "job"; id: string; label: string }
    | { kind: "request"; id: string; label: string }
    | null
  >(null);
  const selectedJob = selectedJobId ? jobs.find((j) => j.id === selectedJobId) ?? null : null;
  const selectedRequest = selectedRequestId ? estimationRequests.find((r) => r.id === selectedRequestId) ?? null : null;

  // Index scheduled + completed jobs by date — completed remain visible in gray.
  const scheduledByDate = useMemo(() => {
    const map = new Map<string, DbJob[]>();
    jobs
      .filter(
        (j) => (j.status === "scheduled" || j.status === "completed") && j.scheduled_date,
      )
      .forEach((j) => {
        const k = j.scheduled_date as string;
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(j);
      });
    // Sort each day by start_time
    map.forEach((arr) =>
      arr.sort((a, b) => (parseTimeToMinutes(a.start_time) ?? 1e9) - (parseTimeToMinutes(b.start_time) ?? 1e9)),
    );
    return map;
  }, [jobs]);

  // Index external estimation requests by date — kept separate from jobs.
  const requestsByDate = useMemo(() => {
    const map = new Map<string, DbEstimationRequest[]>();
    estimationRequests
      .filter((r) => r.requested_date)
      .forEach((r) => {
        const k = r.requested_date;
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(r);
      });
    map.forEach((arr) =>
      arr.sort((a, b) => (parseTimeToMinutes(a.requested_time) ?? 1e9) - (parseTimeToMinutes(b.requested_time) ?? 1e9)),
    );
    return map;
  }, [estimationRequests]);

  const todayStr = ymd(new Date());

  // ── Navigation ──
  const goPrev = () => {
    if (view === "month") setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
    else setCursor(addDays(cursor, -7));
  };
  const goNext = () => {
    if (view === "month") setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
    else setCursor(addDays(cursor, 7));
  };
  const goToday = () => setCursor(new Date());

  // ── Title ──
  const title = useMemo(() => {
    if (view === "month") return `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`;
    const start = startOfWeek(cursor);
    const end = addDays(start, 6);
    return `${start.getDate()} ${MONTH_NAMES[start.getMonth()].slice(0, 3)} – ${end.getDate()} ${MONTH_NAMES[end.getMonth()].slice(0, 3)} ${end.getFullYear()}`;
  }, [cursor, view]);

  // ── Month grid (6 weeks * 7 days) ──
  const monthDays = useMemo(() => {
    const start = startOfMonthGrid(cursor);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [cursor]);

  // ── Week days ──
  const weekDays = useMemo(() => {
    const start = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursor]);

  // Unseen requests for the alert banner (new external submissions never opened)
  const unseenRequests = useMemo(
    () => estimationRequests.filter((r) => !r.seen_at && r.status !== "done" && !r.hidden),
    [estimationRequests],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="h-6 w-6" /> Calendrier
          </h1>
          <p className="text-muted-foreground">Vue agenda des jobs planifiés</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="month">Mois</TabsTrigger>
              <TabsTrigger value="week">Semaine</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {unseenRequests.length > 0 && (
        <div className="rounded-lg border-l-4 border-estimation-request bg-estimation-request/10 p-4 flex items-start gap-3">
          <span className="relative flex h-3 w-3 mt-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-estimation-request opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-estimation-request" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-estimation-request">
              {unseenRequests.length} nouvelle{unseenRequests.length > 1 ? "s" : ""} demande
              {unseenRequests.length > 1 ? "s" : ""} d'estimation
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Reçue{unseenRequests.length > 1 ? "s" : ""} depuis le site externe — cliquez pour voir le détail.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {unseenRequests.slice(0, 5).map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setCursor(new Date(r.requested_date + "T00:00:00"));
                    setSelectedRequestId(r.id);
                  }}
                  className="text-xs bg-background border border-estimation-request/40 hover:border-estimation-request rounded-md px-2 py-1 transition-colors"
                >
                  <span className="font-medium">{r.client_name || "Sans nom"}</span>
                  <span className="text-muted-foreground ml-2">{r.requested_date}</span>
                </button>
              ))}
              {unseenRequests.length > 5 && (
                <span className="text-xs text-muted-foreground self-center">
                  +{unseenRequests.length - 5} autres
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-lg">{title}</CardTitle>
            <div className="flex items-center gap-3 flex-wrap">
              <CutTypeLegend />
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={goPrev}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" onClick={goToday}>Aujourd'hui</Button>
                <Button variant="outline" size="sm" onClick={goNext}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {view === "month" ? (
            <MonthView
              days={monthDays}
              currentMonth={cursor.getMonth()}
              todayStr={todayStr}
              scheduledByDate={scheduledByDate}
              requestsByDate={requestsByDate}
              customers={customers}
              onDayClick={(d) => setSelectedDay(d)}
              onJobClick={(id) => setSelectedJobId(id)}
              onRequestClick={(id) => setSelectedRequestId(id)}
              onJobComplete={(j) =>
                setPendingComplete({
                  kind: "job",
                  id: j.id,
                  label: getClientNameFromList(customers, j.client_id),
                })
              }
              onRequestComplete={(r) =>
                setPendingComplete({
                  kind: "request",
                  id: r.id,
                  label: r.client_name || "Estimation à faire",
                })
              }
            />
          ) : (
            <WeekView
              days={weekDays}
              todayStr={todayStr}
              scheduledByDate={scheduledByDate}
              requestsByDate={requestsByDate}
              customers={customers}
              onDayClick={(d) => setSelectedDay(d)}
              onJobClick={(id) => setSelectedJobId(id)}
              onRequestClick={(id) => setSelectedRequestId(id)}
              onJobComplete={(j) =>
                setPendingComplete({
                  kind: "job",
                  id: j.id,
                  label: getClientNameFromList(customers, j.client_id),
                })
              }
              onRequestComplete={(r) =>
                setPendingComplete({
                  kind: "request",
                  id: r.id,
                  label: r.client_name || "Estimation à faire",
                })
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Day detail (hourly 00-23) */}
      <DayHourlyDialog
        day={selectedDay}
        onOpenChange={(open) => !open && setSelectedDay(null)}
        scheduledByDate={scheduledByDate}
        requestsByDate={requestsByDate}
        customers={customers}
        onJobClick={(id) => setSelectedJobId(id)}
        onRequestClick={(id) => setSelectedRequestId(id)}
        onJobComplete={(j) =>
          setPendingComplete({
            kind: "job",
            id: j.id,
            label: getClientNameFromList(customers, j.client_id),
          })
        }
        onRequestComplete={(r) =>
          setPendingComplete({
            kind: "request",
            id: r.id,
            label: r.client_name || "Estimation à faire",
          })
        }
      />

      {/* Job detail — reuses shared dialog */}
      <JobDetailDialog job={selectedJob} onOpenChange={(open) => !open && setSelectedJobId(null)} />

      {/* External estimation request detail */}
      <EstimationRequestDialog request={selectedRequest} onOpenChange={(open) => !open && setSelectedRequestId(null)} />

      {/* Confirmation before completing an event from the calendar */}
      <AlertDialog open={!!pendingComplete} onOpenChange={(open) => !open && setPendingComplete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Compléter cet événement ?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingComplete?.kind === "job"
                ? `Le job de ${pendingComplete.label} sera marqué comme complété et passera en gris dans le calendrier.`
                : pendingComplete?.kind === "request"
                  ? `L'estimation à faire pour ${pendingComplete.label} sera marquée comme traitée et passera en gris dans le calendrier.`
                  : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-success text-success-foreground hover:bg-success/90"
              onClick={async () => {
                if (!pendingComplete) return;
                try {
                  if (pendingComplete.kind === "job") {
                    const j = jobs.find((x) => x.id === pendingComplete.id);
                    if (!j) return;
                    // Best-effort end_time + total_duration_minutes when start_time exists.
                    const patch: any = { id: j.id, status: "completed" };
                    if (j.start_time) {
                      const estimate = j.estimated_duration_minutes ?? 60;
                      const end =
                        j.end_time?.slice(0, 5) ||
                        addMinutesToTime(j.start_time, estimate) ||
                        null;
                      if (end) {
                        patch.end_time = end;
                        const real = computeRealDuration(j.start_time, end);
                        if (real && real > 0) {
                          patch.total_duration_minutes = real;
                          if (j.estimated_duration_minutes) {
                            patch.duration_variance_minutes = real - j.estimated_duration_minutes;
                          }
                        }
                      }
                    }
                    await updateJob.mutateAsync(patch);
                    toast.success("Job complété");
                  } else {
                    await updateRequest.mutateAsync({
                      id: pendingComplete.id,
                      updates: { status: "done" },
                    });
                    toast.success("Estimation marquée comme traitée");
                  }
                } catch (err: any) {
                  toast.error(err?.message ?? "Erreur lors de la complétion");
                } finally {
                  setPendingComplete(null);
                }
              }}
            >
              Compléter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};



// ─── Month View ───
function MonthView({
  days,
  currentMonth,
  todayStr,
  scheduledByDate,
  requestsByDate,
  customers,
  onDayClick,
  onJobClick,
  onRequestClick,
  onJobComplete,
  onRequestComplete,
}: {
  days: Date[];
  currentMonth: number;
  todayStr: string;
  scheduledByDate: Map<string, DbJob[]>;
  requestsByDate: Map<string, DbEstimationRequest[]>;
  customers: any[];
  onDayClick: (d: Date) => void;
  onJobClick: (id: string) => void;
  onRequestClick: (id: string) => void;
  onJobComplete: (j: DbJob) => void;
  onRequestComplete: (r: DbEstimationRequest) => void;
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="grid grid-cols-7 bg-muted/50 border-b">
        {DAY_NAMES.map((n) => (
          <div key={n} className="text-xs font-medium text-muted-foreground text-center py-2">{n}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const k = ymd(d);
          const dayJobs = scheduledByDate.get(k) ?? [];
          const dayRequests = requestsByDate.get(k) ?? [];
          const totalEntries = dayJobs.length + dayRequests.length;
          const isToday = k === todayStr;
          const isOtherMonth = d.getMonth() !== currentMonth;
          return (
            <button
              key={i}
              onClick={() => onDayClick(d)}
              className={cn(
                "min-h-[88px] border-r border-b p-1.5 text-left flex flex-col gap-1 hover:bg-accent/40 transition-colors",
                isOtherMonth && "bg-muted/20",
                (i + 1) % 7 === 0 && "border-r-0",
              )}
            >
              <div className={cn("text-xs font-medium flex items-center justify-center w-6 h-6 rounded-full", isToday && "bg-primary text-primary-foreground", isOtherMonth && !isToday && "text-muted-foreground")}>
                {d.getDate()}
              </div>
              <div className="space-y-0.5 overflow-hidden">
                {/* External estimation requests first (visually distinct, blue) */}
                {dayRequests.slice(0, 2).map((r) => (
                  <div
                    key={r.id}
                    onClick={(e) => { e.stopPropagation(); onRequestClick(r.id); }}
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer",
                      requestClasses(r),
                    )}
                    title={`Estimation à faire · ${r.client_name || "Sans nom"}`}
                  >
                    {r.requested_time && <span className="font-medium mr-1">{r.requested_time.slice(0, 5)}</span>}
                    {r.client_name || "Estimation à faire"}
                  </div>
                ))}
                {dayJobs.slice(0, Math.max(0, 2 - dayRequests.length)).map((j) => (
                  <div
                    key={j.id}
                    onClick={(e) => { e.stopPropagation(); onJobClick(j.id); }}
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer",
                      jobClasses(j),
                    )}
                    title={`${cutTypeLabel(j.cut_type)} · ${getClientNameFromList(customers, j.client_id)}`}
                  >
                    {j.start_time && <span className="font-medium mr-1">{j.start_time.slice(0, 5)}</span>}
                    {getClientNameFromList(customers, j.client_id)}
                  </div>
                ))}
                {totalEntries > 2 && (
                  <div className="text-[10px] text-muted-foreground px-1.5">+{totalEntries - 2} autres</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Small green icon-only "Compléter" button used in compact month cells.
function CompleteIconButton({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Compléter"
      aria-label="Compléter"
      className="shrink-0 inline-flex items-center justify-center h-4 w-4 rounded-sm bg-success text-success-foreground opacity-0 group-hover/event:opacity-100 hover:bg-success/90 transition-opacity"
    >
      <Check className="h-3 w-3" />
    </button>
  );
}

// ─── Week View ───
function WeekView({
  days,
  todayStr,
  scheduledByDate,
  requestsByDate,
  customers,
  onDayClick,
  onJobClick,
  onRequestClick,
  onJobComplete,
  onRequestComplete,
}: {
  days: Date[];
  todayStr: string;
  scheduledByDate: Map<string, DbJob[]>;
  requestsByDate: Map<string, DbEstimationRequest[]>;
  customers: any[];
  onDayClick: (d: Date) => void;
  onJobClick: (id: string) => void;
  onRequestClick: (id: string) => void;
  onJobComplete: (j: DbJob) => void;
  onRequestComplete: (r: DbEstimationRequest) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((d) => {
        const k = ymd(d);
        const dayJobs = scheduledByDate.get(k) ?? [];
        const dayRequests = requestsByDate.get(k) ?? [];
        const isToday = k === todayStr;
        const isEmpty = dayJobs.length === 0 && dayRequests.length === 0;
        return (
          <div key={k} className="border rounded-lg overflow-hidden flex flex-col min-h-[200px]">
            <button
              onClick={() => onDayClick(d)}
              className={cn(
                "px-2 py-2 text-center border-b hover:bg-accent/40 transition-colors",
                isToday ? "bg-primary text-primary-foreground" : "bg-muted/30",
              )}
            >
              <div className="text-[10px] uppercase opacity-80">{DAY_NAMES[d.getDay()]}</div>
              <div className="text-base font-semibold">{d.getDate()}</div>
            </button>
            <div className="flex-1 p-1.5 space-y-1 overflow-y-auto">
              {isEmpty ? (
                <p className="text-[10px] text-muted-foreground text-center pt-2">—</p>
              ) : (
                <>
                  {dayRequests.map((r) => (
                    <div
                      key={r.id}
                      onClick={() => onRequestClick(r.id)}
                      className={cn(
                        "w-full text-left text-[11px] px-1.5 py-1 rounded cursor-pointer",
                        requestClasses(r),
                      )}
                      title="Estimation à faire"
                    >
                      {r.requested_time && <div className="font-medium">{r.requested_time.slice(0, 5)}</div>}
                      <div className="truncate">{r.client_name || "Estimation à faire"}</div>
                    </div>
                  ))}
                  {dayJobs.map((j) => (
                    <div
                      key={j.id}
                      onClick={() => onJobClick(j.id)}
                      className={cn(
                        "w-full text-left text-[11px] px-1.5 py-1 rounded cursor-pointer",
                        jobClasses(j),
                      )}
                      title={cutTypeLabel(j.cut_type)}
                    >
                      {j.start_time && <div className="font-medium">{j.start_time.slice(0, 5)}</div>}
                      <div className="truncate">{getClientNameFromList(customers, j.client_id)}</div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Full green "Compléter" button used in week / day-hourly views.
function CompleteButton({
  onClick,
  className,
}: {
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Compléter"
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
        "bg-success text-success-foreground hover:bg-success/90 transition-colors",
        className,
      )}
    >
      <Check className="h-3 w-3" />
      Compléter
    </button>
  );
}


// ─── Day Hourly View (00-23) ───
function DayHourlyDialog({
  day,
  onOpenChange,
  scheduledByDate,
  requestsByDate,
  customers,
  onJobClick,
  onRequestClick,
  onJobComplete,
  onRequestComplete,
}: {
  day: Date | null;
  onOpenChange: (open: boolean) => void;
  scheduledByDate: Map<string, DbJob[]>;
  requestsByDate: Map<string, DbEstimationRequest[]>;
  customers: any[];
  onJobClick: (id: string) => void;
  onRequestClick: (id: string) => void;
  onJobComplete: (j: DbJob) => void;
  onRequestComplete: (r: DbEstimationRequest) => void;
}) {
  const dayJobs = day ? scheduledByDate.get(ymd(day)) ?? [] : [];
  const dayRequests = day ? requestsByDate.get(ymd(day)) ?? [] : [];
  const unscheduledJobs = dayJobs.filter((j) => parseTimeToMinutes(j.start_time) === null);
  const scheduledJobs = dayJobs.filter((j) => parseTimeToMinutes(j.start_time) !== null);
  const unscheduledRequests = dayRequests.filter((r) => parseTimeToMinutes(r.requested_time) === null);
  const scheduledRequests = dayRequests.filter((r) => parseTimeToMinutes(r.requested_time) !== null);

  return (
    <Dialog open={!!day} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {day && (
          <>
            <DialogHeader>
              <DialogTitle>
                {DAY_NAMES[day.getDay()]} {day.getDate()} {MONTH_NAMES[day.getMonth()]} {day.getFullYear()}
              </DialogTitle>
              <DialogDescription>
                {dayJobs.length} job{dayJobs.length > 1 ? "s" : ""} planifié{dayJobs.length > 1 ? "s" : ""}
                {dayRequests.length > 0 && ` · ${dayRequests.length} estimation${dayRequests.length > 1 ? "s" : ""} à faire`}
              </DialogDescription>
            </DialogHeader>

            {(unscheduledJobs.length > 0 || unscheduledRequests.length > 0) && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase">Sans heure</p>
                {unscheduledRequests.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => onRequestClick(r.id)}
                    className={cn(
                      "w-full text-left p-2 rounded text-sm transition-colors cursor-pointer flex items-center justify-between gap-2",
                      requestClasses(r),
                    )}
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.client_name || "Estimation à faire"}</div>
                      <div className="text-xs opacity-80">Estimation à faire</div>
                    </div>
                    {r.status !== "done" && (
                      <CompleteButton
                        onClick={(e) => {
                          e.stopPropagation();
                          onRequestComplete(r);
                        }}
                      />
                    )}
                  </div>
                ))}
                {unscheduledJobs.map((j) => (
                  <div
                    key={j.id}
                    onClick={() => onJobClick(j.id)}
                    className={cn(
                      "w-full text-left p-2 rounded text-sm transition-colors cursor-pointer flex items-center justify-between gap-2",
                      jobClasses(j),
                    )}
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{getClientNameFromList(customers, j.client_id)}</div>
                      <div className="text-xs opacity-80">{cutTypeLabel(j.cut_type)}</div>
                    </div>
                    {j.status !== "completed" && (
                      <CompleteButton
                        onClick={(e) => {
                          e.stopPropagation();
                          onJobComplete(j);
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="border rounded-lg divide-y max-h-[60vh] overflow-y-auto">
              {Array.from({ length: 24 }, (_, hour) => {
                const hourJobs = scheduledJobs.filter((j) => {
                  const m = parseTimeToMinutes(j.start_time)!;
                  return Math.floor(m / 60) === hour;
                });
                const hourRequests = scheduledRequests.filter((r) => {
                  const m = parseTimeToMinutes(r.requested_time)!;
                  return Math.floor(m / 60) === hour;
                });
                return (
                  <div key={hour} className="flex min-h-[48px]">
                    <div className="w-16 shrink-0 text-xs text-muted-foreground p-2 border-r bg-muted/30 text-right">
                      {String(hour).padStart(2, "0")}:00
                    </div>
                    <div className="flex-1 p-1.5 space-y-1">
                      {hourRequests.map((r) => (
                        <div
                          key={r.id}
                          onClick={() => onRequestClick(r.id)}
                          className={cn(
                            "w-full text-left px-2 py-1.5 rounded text-sm cursor-pointer flex items-center justify-between gap-2",
                            requestClasses(r),
                          )}
                        >
                          <div className="min-w-0">
                            <div className="font-medium truncate">
                              {r.requested_time?.slice(0, 5)} · {r.client_name || "Estimation à faire"}
                            </div>
                            <div className="text-xs opacity-80">Estimation à faire</div>
                          </div>
                          {r.status !== "done" && (
                            <CompleteButton
                              onClick={(e) => {
                                e.stopPropagation();
                                onRequestComplete(r);
                              }}
                            />
                          )}
                        </div>
                      ))}
                      {hourJobs.map((j) => {
                        const end = projectedEndTime(j);
                        return (
                          <div
                            key={j.id}
                            onClick={() => onJobClick(j.id)}
                            className={cn(
                              "w-full text-left px-2 py-1.5 rounded text-sm cursor-pointer flex items-center justify-between gap-2",
                              jobClasses(j),
                            )}
                          >
                            <div className="min-w-0">
                              <div className="font-medium truncate">
                                {j.start_time?.slice(0, 5)}
                                {end && ` – ${end}`}
                                {!j.end_time && end && <span className="text-[10px] opacity-70 ml-1">(estimé)</span>}
                                {" · "}
                                {getClientNameFromList(customers, j.client_id)}
                              </div>
                              <div className="text-xs opacity-80">{cutTypeLabel(j.cut_type)}</div>
                            </div>
                            {j.status !== "completed" && (
                              <CompleteButton
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onJobComplete(j);
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}


// ─── Legend ───
function CutTypeLegend() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm bg-cut-trim" />
        <span>Taillage</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm bg-cut-levelling" />
        <span>Nivelage</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm bg-cut-restoration" />
        <span>Restauration</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm bg-estimation-request" />
        <span>Estimation à faire</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm bg-muted-foreground/40" />
        <span>Complété</span>
      </div>
    </div>
  );
}

export default CalendarPage;
