import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDays, Users, FileText, Plus, Clock, Briefcase, Bell, ClipboardList, DollarSign } from "lucide-react";
import { useCustomers, useJobs, useInvoices, useReminders, useEstimationRequests, useExpenses, useEmployees, useEmployeeJobs, getClientNameFromList } from "@/hooks/useSupabaseData";
import { useNavigate } from "react-router-dom";
import { JobDetailDialog } from "@/components/jobs/JobDetailDialog";
import { StatCard } from "@/components/ui/stat-card";
import { PageHeader } from "@/components/ui/page-header";

const statusVariant: Record<string, "info" | "warning" | "success"> = {
  scheduled: "info",
  pending: "warning",
  completed: "success",
};

const statusLabel: Record<string, string> = {
  scheduled: "Planifié",
  pending: "En attente",
  completed: "Complété",
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { data: customers = [] } = useCustomers();
  const { data: jobs = [] } = useJobs();
  const { data: invoices = [] } = useInvoices();
  const { data: reminders = [] } = useReminders();
  const { data: estimationRequests = [] } = useEstimationRequests();
  const { data: expenses = [] } = useExpenses();
  const { data: employees = [] } = useEmployees();
  const { data: employeeJobs = [] } = useEmployeeJobs();

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const selectedJob = selectedJobId ? jobs.find((j) => j.id === selectedJobId) ?? null : null;

  const today = new Date().toISOString().split("T")[0];
  const inOneWeek = new Date();
  inOneWeek.setDate(inOneWeek.getDate() + 7);
  const inOneWeekStr = inOneWeek.toISOString().split("T")[0];

  const todayJobs = jobs.filter((j) => j.scheduled_date === today);
  const scheduledJobCount = jobs.filter((j) => j.status === "scheduled").length;
  const completedJobCount = jobs.filter((j) => j.status === "completed").length;

  const upcomingJobs = jobs
    .filter(
      (j) =>
        j.status === "scheduled" &&
        j.scheduled_date &&
        j.scheduled_date >= today &&
        j.scheduled_date <= inOneWeekStr,
    )
    .sort((a, b) => (a.scheduled_date ?? "").localeCompare(b.scheduled_date ?? ""));
  const adminIds = useMemo(() => new Set(employees.filter((e) => e.is_admin).map((e) => e.id)), [employees]);

  const employeePayEntries = useMemo(
    () =>
      employeeJobs
        .map((ej) => {
          const job = jobs.find((j) => j.id === ej.job_id);
          if (!job || job.status !== "completed") return null;
          return {
            amount: Number(ej.calculated_pay ?? 0),
            isAdmin: adminIds.has(ej.employee_id),
          };
        })
        .filter((x): x is { amount: number; isAdmin: boolean } => x !== null && x.amount !== 0),
    [employeeJobs, jobs, adminIds],
  );

  const totalProfit = useMemo(
    () => employeePayEntries.filter((x) => x.isAdmin).reduce((s, x) => s + x.amount, 0),
    [employeePayEntries],
  );

  const normalLaborCost = useMemo(
    () => employeePayEntries.filter((x) => !x.isAdmin).reduce((s, x) => s + x.amount, 0),
    [employeePayEntries],
  );

  const totalExpenses = useMemo(
    () => expenses.reduce((s, e) => s + e.amount, 0) + normalLaborCost,
    [expenses, normalLaborCost],
  );

  const netProfit = useMemo(() => Math.round(totalProfit - totalExpenses), [totalProfit, totalExpenses]);

  const pendingEstimations = estimationRequests.filter((r) => r.status === "pending").length;

  const activeReminders = reminders.filter((r) => !r.is_completed && r.due_date <= inOneWeekStr).length;

  const realClientIds = useMemo(() => {
    const ids = new Set<string>();
    jobs.forEach((j) => {
      if (j.status === "scheduled" || j.status === "completed") ids.add(j.client_id);
    });
    return ids;
  }, [jobs]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="Tableau de bord"
        description="Vue d'ensemble de vos opérations"
        actions={
          <>
            <Button size="sm" onClick={() => navigate("/clients")}>
              <Plus className="h-4 w-4 mr-1.5" /> Client
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/estimation")}>
              <FileText className="h-4 w-4 mr-1.5" /> Estimation
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div onClick={() => navigate("/clients")} className="cursor-pointer">
          <StatCard
            title="Clients actifs"
            value={customers.filter((c) => !c.hidden && realClientIds.has(c.id)).length}
            icon={Users}
            accent="green"
          />
        </div>
        <div onClick={() => navigate("/jobs")} className="cursor-pointer">
          <StatCard
            title="Complétés"
            value={completedJobCount}
            icon={Briefcase}
            accent="blue"
          />
        </div>
        <div onClick={() => navigate("/calendar")} className="cursor-pointer">
          <StatCard
            title="Planifiés"
            value={scheduledJobCount}
            icon={CalendarDays}
            accent="amber"
          />
        </div>
        <div onClick={() => navigate("/calendar")} className="cursor-pointer">
          <StatCard
            title="Estim. à faire"
            value={pendingEstimations}
            icon={ClipboardList}
            accent="purple"
          />
        </div>
        <div onClick={() => navigate("/finance")} className="cursor-pointer">
          <StatCard
            title="Revenu net"
            value={`$${netProfit.toLocaleString()}`}
            icon={DollarSign}
            accent={netProfit >= 0 ? "green" : "red"}
          />
        </div>
        <div onClick={() => navigate("/reminders")} className="cursor-pointer">
          <StatCard
            title="Rappels"
            value={activeReminders}
            icon={Bell}
            accent="red"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Jobs d'aujourd'hui
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todayJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Aucun job planifié pour aujourd'hui.</p>
          ) : (
            <div className="space-y-2">
              {todayJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/40 hover:shadow-sm transition-all cursor-pointer"
                  onClick={() => setSelectedJobId(job.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-primary/60" />
                    <div>
                      <p className="text-sm font-medium">{getClientNameFromList(customers, job.client_id)}</p>
                      <p className="text-xs text-muted-foreground">{job.cut_type}</p>
                    </div>
                  </div>
                  <Badge variant={statusVariant[job.status] ?? "secondary"}>
                    {statusLabel[job.status] ?? job.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Prochains jobs (7 jours)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Aucun job prévu dans les 7 prochains jours.</p>
          ) : (
            <div className="space-y-2">
              {upcomingJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/40 hover:shadow-sm transition-all cursor-pointer"
                  onClick={() => setSelectedJobId(job.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-amber-400" />
                    <div>
                      <p className="text-sm font-medium">{getClientNameFromList(customers, job.client_id)}</p>
                      <p className="text-xs text-muted-foreground">
                        {job.scheduled_date} · {job.cut_type}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">{statusLabel[job.status] ?? job.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <JobDetailDialog
        job={selectedJob}
        onOpenChange={(open) => !open && setSelectedJobId(null)}
      />
    </div>
  );
};

export default Dashboard;
