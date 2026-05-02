import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Briefcase, DollarSign } from "lucide-react";
import {
  useEmployeeJobs,

  useJobs,
  useCustomers,
  getClientNameFromList,
  type DbEmployee,
  type DbJob,
} from "@/hooks/useSupabaseData";
import { formatDateQC } from "@/lib/utils";
import { JobDetailDialog } from "@/components/jobs/JobDetailDialog";

interface Props {
  employee: DbEmployee | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Employee profile : history of jobs (clickable) + Finance tab.
 * Finance shows total earned since start of the current summer (June 1st).
 */
export function EmployeeProfileDialog({ employee, onOpenChange }: Props) {
  const { data: employeeJobs = [] } = useEmployeeJobs();
  const { data: jobs = [] } = useJobs();
  const { data: customers = [] } = useCustomers();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // All jobs this employee was on, newest first
  const myEJ = useMemo(
    () => (employee ? employeeJobs.filter((ej) => ej.employee_id === employee.id) : []),
    [employee, employeeJobs],
  );

  const myJobs: { ej: typeof myEJ[number]; job: DbJob | undefined }[] = useMemo(() => {
    return myEJ
      .map((ej) => ({ ej, job: jobs.find((j) => j.id === ej.job_id) }))
      .sort((a, b) => {
        const da = a.job?.scheduled_date ?? a.job?.created_at ?? "";
        const db = b.job?.scheduled_date ?? b.job?.created_at ?? "";
        return db.localeCompare(da);
      });
  }, [myEJ, jobs]);

  // Finance: since June 1st of current year (start of summer)
  const summerStart = useMemo(() => {
    const y = new Date().getFullYear();
    return new Date(y, 5, 1); // June 1st (month is 0-indexed)
  }, []);

  const summerJobs = useMemo(() => {
    return myJobs.filter(({ job }) => {
      if (!job) return false;
      const dateStr = job.scheduled_date ?? job.created_at;
      if (!dateStr) return false;
      return new Date(dateStr) >= summerStart;
    });
  }, [myJobs, summerStart]);

  // Confirmed earnings only count completed jobs
  const isCompleted = (job: DbJob | undefined) => job?.status === "completed";
  const totalSummer = summerJobs.reduce(
    (s, { ej, job }) => s + (isCompleted(job) ? Number(ej.calculated_pay ?? 0) : 0),
    0,
  );
  const totalAllTime = myJobs.reduce(
    (s, { ej, job }) => s + (isCompleted(job) ? Number(ej.calculated_pay ?? 0) : 0),
    0,
  );
  const totalHours = myJobs.reduce(
    (s, { ej, job }) => s + (isCompleted(job) ? Number(ej.hours_worked ?? 0) : 0),
    0,
  );

  const selectedJob = selectedJobId ? jobs.find((j) => j.id === selectedJobId) ?? null : null;

  return (
    <>
      <Dialog open={!!employee} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {employee && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {employee.name}
                  {employee.is_admin && <Badge>Admin</Badge>}
                  {!employee.active && <Badge variant="secondary">Inactif</Badge>}
                </DialogTitle>
                <DialogDescription>
                  {employee.is_admin
                    ? "Reçoit une part du montant restant après paie des employés normaux."
                    : `Payé ${employee.hourly_rate}$/h.`}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="history">
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="history">
                    <Briefcase className="h-4 w-4 mr-1" /> Historique
                  </TabsTrigger>
                  <TabsTrigger value="finance">
                    <DollarSign className="h-4 w-4 mr-1" /> Finance
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="history" className="space-y-2 mt-3">
                  {myJobs.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Aucune job.</p>
                  ) : (
                    myJobs.map(({ ej, job }) => {
                      if (!job) return null;
                      const present = ej.is_present !== false;
                      const completed = job.status === "completed";
                      return (
                        <button
                          key={ej.id}
                          onClick={() => setSelectedJobId(job.id)}
                          className={`w-full text-left p-3 rounded-lg border hover:bg-accent/50 transition-colors flex items-center justify-between ${
                            present ? "" : "opacity-60"
                          }`}
                        >
                          <div>
                            <p className="font-medium text-sm flex items-center gap-2">
                              {getClientNameFromList(customers, job.client_id)}
                              {!completed && (
                                <Badge variant="outline" className="text-[10px]">
                                  En attente
                                </Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateQC(job.scheduled_date)} · {job.cut_type}
                              {!present && " · Absent"}
                            </p>
                          </div>
                          <div className="text-right">
                            {completed ? (
                              <p className="text-sm font-semibold">
                                ${Number(ej.calculated_pay ?? 0).toFixed(2)}
                              </p>
                            ) : (
                              <p className="text-xs italic text-muted-foreground">
                                Paie à confirmer
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {Number(ej.hours_worked ?? 0)}h
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </TabsContent>

                <TabsContent value="finance" className="space-y-3 mt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-emerald-600" />
                          <p className="text-xs text-muted-foreground">Été en cours</p>
                        </div>
                        <p className="text-xl font-bold mt-1">${totalSummer.toFixed(2)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          depuis le 1er juin {summerStart.getFullYear()}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">Total à vie</p>
                        <p className="text-xl font-bold mt-1">${totalAllTime.toFixed(2)}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">Heures totales</p>
                        <p className="text-xl font-bold mt-1">{totalHours}h</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-2 mt-2">
                    <p className="text-sm font-medium">Détail été en cours</p>
                    {summerJobs.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">
                        Aucune job depuis le début de l'été.
                      </p>
                    ) : (
                      summerJobs.map(({ ej, job }) => {
                        if (!job) return null;
                        return (
                          <div
                            key={ej.id}
                            className="flex items-center justify-between p-2 rounded border text-sm"
                          >
                            <div>
                              <p className="font-medium">
                                {getClientNameFromList(customers, job.client_id)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDateQC(job.scheduled_date)} · {Number(ej.hours_worked ?? 0)}h
                              </p>
                            </div>
                            <p className="font-semibold text-emerald-600">
                              +${Number(ej.calculated_pay ?? 0).toFixed(2)}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Nested job detail */}
      <JobDetailDialog job={selectedJob} onOpenChange={(open) => !open && setSelectedJobId(null)} />
    </>
  );
}
