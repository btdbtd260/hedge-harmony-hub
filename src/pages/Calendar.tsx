import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useJobs, useCustomers, useEstimationRequests, getClientNameFromList, type DbJob, type DbEstimationRequest } from "@/hooks/useSupabaseData";
import { JobDetailDialog } from "@/components/jobs/JobDetailDialog";
import { EstimationRequestDialog } from "@/components/calendar/EstimationRequestDialog";
import { cn } from "@/lib/utils";

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

// Color classes per cut type — uses semantic tokens from index.css
function cutTypeClasses(cutType: string | null | undefined): string {
  if (cutType === "levelling") {
    return "bg-cut-levelling/15 text-cut-levelling hover:bg-cut-levelling/25 border-l-2 border-cut-levelling";
  }
  if (cutType === "trim") {
    return "bg-cut-trim/15 text-cut-trim hover:bg-cut-trim/25 border-l-2 border-cut-trim";
  }
  return "bg-muted text-muted-foreground hover:bg-muted/80 border-l-2 border-muted-foreground/40";
}
function cutTypeLabel(cutType: string | null | undefined): string {
  if (cutType === "levelling") return "Nivelage";
  if (cutType === "trim") return "Taille";
  return cutType || "Autre";
}

const CalendarPage = () => {
  const { data: jobs = [] } = useJobs();
  const { data: customers = [] } = useCustomers();
  const { data: estimationRequests = [] } = useEstimationRequests();

  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const selectedJob = selectedJobId ? jobs.find((j) => j.id === selectedJobId) ?? null : null;
  const selectedRequest = selectedRequestId ? estimationRequests.find((r) => r.id === selectedRequestId) ?? null : null;

  // Index scheduled jobs by date string — pending jobs are explicitly excluded.
  const scheduledByDate = useMemo(() => {
    const map = new Map<string, DbJob[]>();
    jobs
      .filter((j) => j.status === "scheduled" && j.scheduled_date)
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
      .filter((r) => r.status !== "done" && r.requested_date)
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
      />

      {/* Job detail — reuses shared dialog */}
      <JobDetailDialog job={selectedJob} onOpenChange={(open) => !open && setSelectedJobId(null)} />

      {/* External estimation request detail */}
      <EstimationRequestDialog request={selectedRequest} onOpenChange={(open) => !open && setSelectedRequestId(null)} />
    </div>
  );
};

// ─── Month View ───
function MonthView({
  days,
  currentMonth,
  todayStr,
  scheduledByDate,
  customers,
  onDayClick,
  onJobClick,
}: {
  days: Date[];
  currentMonth: number;
  todayStr: string;
  scheduledByDate: Map<string, DbJob[]>;
  customers: any[];
  onDayClick: (d: Date) => void;
  onJobClick: (id: string) => void;
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
                {dayJobs.slice(0, 2).map((j) => (
                  <div
                    key={j.id}
                    onClick={(e) => { e.stopPropagation(); onJobClick(j.id); }}
                    className={cn("text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer", cutTypeClasses(j.cut_type))}
                    title={`${cutTypeLabel(j.cut_type)} · ${getClientNameFromList(customers, j.client_id)}`}
                  >
                    {j.start_time && <span className="font-medium mr-1">{j.start_time.slice(0, 5)}</span>}
                    {getClientNameFromList(customers, j.client_id)}
                  </div>
                ))}
                {dayJobs.length > 2 && (
                  <div className="text-[10px] text-muted-foreground px-1.5">+{dayJobs.length - 2} autres</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Week View ───
function WeekView({
  days,
  todayStr,
  scheduledByDate,
  customers,
  onDayClick,
  onJobClick,
}: {
  days: Date[];
  todayStr: string;
  scheduledByDate: Map<string, DbJob[]>;
  customers: any[];
  onDayClick: (d: Date) => void;
  onJobClick: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((d) => {
        const k = ymd(d);
        const dayJobs = scheduledByDate.get(k) ?? [];
        const isToday = k === todayStr;
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
              {dayJobs.length === 0 ? (
                <p className="text-[10px] text-muted-foreground text-center pt-2">—</p>
              ) : (
                dayJobs.map((j) => (
                  <button
                    key={j.id}
                    onClick={() => onJobClick(j.id)}
                    className={cn("w-full text-left text-[11px] px-1.5 py-1 rounded", cutTypeClasses(j.cut_type))}
                    title={cutTypeLabel(j.cut_type)}
                  >
                    {j.start_time && <div className="font-medium">{j.start_time.slice(0, 5)}</div>}
                    <div className="truncate">{getClientNameFromList(customers, j.client_id)}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Day Hourly View (00-23) ───
function DayHourlyDialog({
  day,
  onOpenChange,
  scheduledByDate,
  customers,
  onJobClick,
}: {
  day: Date | null;
  onOpenChange: (open: boolean) => void;
  scheduledByDate: Map<string, DbJob[]>;
  customers: any[];
  onJobClick: (id: string) => void;
}) {
  const dayJobs = day ? scheduledByDate.get(ymd(day)) ?? [] : [];
  const unscheduledJobs = dayJobs.filter((j) => parseTimeToMinutes(j.start_time) === null);
  const scheduledJobs = dayJobs.filter((j) => parseTimeToMinutes(j.start_time) !== null);

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
                Horaire complet de la journée ({dayJobs.length} job{dayJobs.length > 1 ? "s" : ""} planifié{dayJobs.length > 1 ? "s" : ""})
              </DialogDescription>
            </DialogHeader>

            {unscheduledJobs.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase">Sans heure</p>
                {unscheduledJobs.map((j) => (
                  <button
                    key={j.id}
                    onClick={() => onJobClick(j.id)}
                    className={cn("w-full text-left p-2 rounded text-sm transition-colors", cutTypeClasses(j.cut_type))}
                  >
                    <div className="font-medium">{getClientNameFromList(customers, j.client_id)}</div>
                    <div className="text-xs opacity-80">{cutTypeLabel(j.cut_type)}</div>
                  </button>
                ))}
              </div>
            )}

            <div className="border rounded-lg divide-y max-h-[60vh] overflow-y-auto">
              {Array.from({ length: 24 }, (_, hour) => {
                const hourJobs = scheduledJobs.filter((j) => {
                  const m = parseTimeToMinutes(j.start_time)!;
                  return Math.floor(m / 60) === hour;
                });
                return (
                  <div key={hour} className="flex min-h-[48px]">
                    <div className="w-16 shrink-0 text-xs text-muted-foreground p-2 border-r bg-muted/30 text-right">
                      {String(hour).padStart(2, "0")}:00
                    </div>
                    <div className="flex-1 p-1.5 space-y-1">
                      {hourJobs.map((j) => {
                        const end = projectedEndTime(j);
                        return (
                          <button
                            key={j.id}
                            onClick={() => onJobClick(j.id)}
                            className={cn("w-full text-left px-2 py-1.5 rounded text-sm", cutTypeClasses(j.cut_type))}
                          >
                            <div className="font-medium">
                              {j.start_time?.slice(0, 5)}
                              {end && ` – ${end}`}
                              {!j.end_time && end && <span className="text-[10px] opacity-70 ml-1">(estimé)</span>}
                              {" · "}
                              {getClientNameFromList(customers, j.client_id)}
                            </div>
                            <div className="text-xs opacity-80">{cutTypeLabel(j.cut_type)}</div>
                          </button>
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
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm bg-cut-trim" />
        <span>Taille</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm bg-cut-levelling" />
        <span>Nivelage</span>
      </div>
    </div>
  );
}

export default CalendarPage;
