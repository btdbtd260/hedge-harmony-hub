import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Users, FileText, Plus, Clock, DollarSign, Briefcase, Bell, ClipboardList } from "lucide-react";
import { useCustomers, useJobs, useInvoices, useReminders, useEstimationRequests, useExpenses, useEmployees, useEmployeeJobs, getClientNameFromList } from "@/hooks/useSupabaseData";
import { useNavigate } from "react-router-dom";
import { JobDetailDialog } from "@/components/jobs/JobDetailDialog";

const statusColor: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  pending: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
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
  // Prochains jobs: tous les jobs planifiés entre aujourd'hui et +7 jours
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

  // Estimations restantes à faire = demandes non traitées (status === "pending", non masquées)
  // useEstimationRequests filtre déjà hidden = false
  const pendingEstimations = estimationRequests.filter((r) => r.status === "pending").length;

  // Only count reminders due within next 7 days
  const activeReminders = reminders.filter((r) => !r.is_completed && r.due_date <= inOneWeekStr).length;

  // Set of client IDs that have at least one job scheduled or completed ("active" clients)
  const realClientIds = useMemo(() => {
    const ids = new Set<string>();
    jobs.forEach((j) => {
      if (j.status === "scheduled" || j.status === "completed") ids.add(j.client_id);
    });
    return ids;
  }, [jobs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tableau de bord</h1>
          <p className="text-muted-foreground">Vue d'ensemble de vos opérations</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => navigate("/clients")}><Plus className="h-4 w-4 mr-1" /> Client</Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/estimation")}><FileText className="h-4 w-4 mr-1" /> Estimation</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <Card className="cursor-pointer hover:bg-accent/50 hover:shadow-md transition-all" onClick={() => navigate("/clients")}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Users className="h-5 w-5 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Clients</p><p className="text-2xl font-bold">{customers.filter(c => !c.hidden && realClientIds.has(c.id)).length}</p></div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent/50 hover:shadow-md transition-all" onClick={() => navigate("/jobs")}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Briefcase className="h-5 w-5 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Jobs actifs</p><p className="text-2xl font-bold">{jobs.filter(j => j.status !== "completed" && j.status !== "hidden").length}</p></div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent/50 hover:shadow-md transition-all" onClick={() => navigate("/calendar")}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><ClipboardList className="h-5 w-5 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Estimations à faire</p><p className="text-2xl font-bold">{pendingEstimations}</p></div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent/50 hover:shadow-md transition-all" onClick={() => navigate("/finance")}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><DollarSign className="h-5 w-5 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Revenu</p><p className="text-2xl font-bold">${netProfit}</p></div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent/50 hover:shadow-md transition-all" onClick={() => navigate("/reminders")}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Bell className="h-5 w-5 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Rappels</p><p className="text-2xl font-bold">{activeReminders}</p></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Jobs aujourd'hui</CardTitle></CardHeader>
        <CardContent>
          {todayJobs.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucun job planifié pour aujourd'hui.</p>
          ) : (
            <div className="space-y-3">
              {todayJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setSelectedJobId(job.id)}>
                  <div>
                    <p className="font-medium">{getClientNameFromList(customers, job.client_id)}</p>
                    <p className="text-sm text-muted-foreground">{job.cut_type}</p>
                  </div>
                  <Badge className={statusColor[job.status]}>{job.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Prochains jobs (7 prochains jours)</CardTitle></CardHeader>
        <CardContent>
          {upcomingJobs.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucun job prévu dans les 7 prochains jours.</p>
          ) : (
            <div className="space-y-3">
              {upcomingJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setSelectedJobId(job.id)}>
                  <div>
                    <p className="font-medium">{getClientNameFromList(customers, job.client_id)}</p>
                    <p className="text-sm text-muted-foreground">{job.scheduled_date} · {job.cut_type}</p>
                  </div>
                  <Badge variant="outline">{job.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <JobDetailDialog job={selectedJob} onOpenChange={(open) => !open && setSelectedJobId(null)} />
    </div>
  );
};

export default Dashboard;
