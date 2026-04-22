import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Users, FileText, Plus, Clock, DollarSign, Briefcase, Bell, ClipboardList } from "lucide-react";
import { useCustomers, useJobs, useInvoices, useReminders, useEstimationRequests, getClientNameFromList } from "@/hooks/useSupabaseData";
import { useNavigate } from "react-router-dom";

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
  const totalRevenue = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);

  // Estimations restantes à faire = demandes non traitées (status === "pending", non masquées)
  // useEstimationRequests filtre déjà hidden = false
  const pendingEstimations = estimationRequests.filter((r) => r.status === "pending").length;

  // Only count reminders due within next 7 days
  const activeReminders = reminders.filter((r) => !r.is_completed && r.due_date <= inOneWeekStr).length;

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
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Users className="h-5 w-5 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Clients</p><p className="text-2xl font-bold">{customers.filter(c => !c.hidden).length}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Briefcase className="h-5 w-5 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Jobs actifs</p><p className="text-2xl font-bold">{jobs.filter(j => j.status !== "completed" && j.status !== "hidden").length}</p></div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate("/calendar")}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><ClipboardList className="h-5 w-5 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Estimations à faire</p><p className="text-2xl font-bold">{pendingEstimations}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><DollarSign className="h-5 w-5 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Revenus (payé)</p><p className="text-2xl font-bold">${totalRevenue}</p></div>
          </CardContent>
        </Card>
        <Card>
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
                <div key={job.id} className="flex items-center justify-between p-3 rounded-lg border">
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
        <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Prochains jobs</CardTitle></CardHeader>
        <CardContent>
          {upcomingJobs.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucun job à venir.</p>
          ) : (
            <div className="space-y-3">
              {upcomingJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-3 rounded-lg border">
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
    </div>
  );
};

export default Dashboard;
