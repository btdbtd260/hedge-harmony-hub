import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Users, FileText, Plus, Clock, DollarSign, Briefcase, Bell } from "lucide-react";
import { customers, jobs, invoices, reminders, getClientName } from "@/data/mock";
import { useNavigate } from "react-router-dom";

const statusColor: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  pending: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
};

const Dashboard = () => {
  const navigate = useNavigate();

  const today = new Date().toISOString().split("T")[0];
  const todayJobs = jobs.filter((j) => j.scheduledDate === today);
  const upcomingJobs = jobs
    .filter((j) => j.status === "scheduled" && j.scheduledDate >= today)
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
    .slice(0, 5);
  const unpaidInvoices = invoices.filter((i) => i.status === "unpaid");
  const totalRevenue = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const activeReminders = reminders.filter((r) => !r.isCompleted).length;

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

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Factures impayées */}
      {unpaidInvoices.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> Factures impayées</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {unpaidInvoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-medium">{getClientName(inv.clientId)}</p>
                  <p className="text-sm text-muted-foreground">Émise le {inv.issuedAt}</p>
                </div>
                <p className="font-semibold">${inv.amount}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Today's Jobs */}
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
                    <p className="font-medium">{getClientName(job.clientId)}</p>
                    <p className="text-sm text-muted-foreground">{job.cutType}</p>
                  </div>
                  <Badge className={statusColor[job.status]}>{job.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming */}
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
                    <p className="font-medium">{getClientName(job.clientId)}</p>
                    <p className="text-sm text-muted-foreground">{job.scheduledDate} · {job.cutType}</p>
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
