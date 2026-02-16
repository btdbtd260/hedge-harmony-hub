import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Users, FileText, Plus, Clock, DollarSign, Briefcase } from "lucide-react";
import { customers, jobs, quotes, invoices } from "@/data/mock";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const navigate = useNavigate();

  const todayJobs = jobs.filter((j) => j.scheduledDate === "2026-02-16");
  const upcomingJobs = jobs.filter((j) => j.status === "scheduled").slice(0, 4);
  const pendingQuotes = quotes.filter((q) => q.status === "draft" || q.status === "sent");
  const totalRevenue = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);

  const statusColor: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-700",
    in_progress: "bg-amber-100 text-amber-700",
    completed: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your operations</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => navigate("/customers")}><Plus className="h-4 w-4 mr-1" /> Customer</Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/quotes")}><FileText className="h-4 w-4 mr-1" /> Quote</Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/jobs")}><Calendar className="h-4 w-4 mr-1" /> Job</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Users className="h-5 w-5 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Customers</p><p className="text-2xl font-bold">{customers.filter(c => !c.hidden).length}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Briefcase className="h-5 w-5 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Active Jobs</p><p className="text-2xl font-bold">{jobs.filter(j => j.status !== "completed").length}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><FileText className="h-5 w-5 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Pending Quotes</p><p className="text-2xl font-bold">{pendingQuotes.length}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><DollarSign className="h-5 w-5 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Revenue (Paid)</p><p className="text-2xl font-bold">${totalRevenue}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Jobs */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Today's Jobs</CardTitle></CardHeader>
        <CardContent>
          {todayJobs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No jobs scheduled for today.</p>
          ) : (
            <div className="space-y-3">
              {todayJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{job.customerName}</p>
                    <p className="text-sm text-muted-foreground">{job.address}</p>
                  </div>
                  <Badge className={statusColor[job.status]}>{job.status.replace("_", " ")}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Upcoming Jobs</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {upcomingJobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-medium">{job.customerName}</p>
                  <p className="text-sm text-muted-foreground">{job.scheduledDate} · {job.serviceType}</p>
                </div>
                <Badge variant="outline">{job.crewName}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
