import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { jobs as mockJobs, getClientName } from "@/data/mock";
import { Search, Calendar } from "lucide-react";
import type { Job } from "@/types";

const statusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  scheduled: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  hidden: "bg-gray-100 text-gray-500",
};

const Jobs = () => {
  const [search, setSearch] = useState("");
  const [hideCompleted, setHideCompleted] = useState(false);

  const filtered = mockJobs
    .filter((j) => !hideCompleted || (j.status !== "completed" && j.status !== "hidden"))
    .filter((j) => {
      const clientName = getClientName(j.clientId).toLowerCase();
      return clientName.includes(search.toLowerCase());
    });

  const today = new Date().toISOString().split("T")[0];
  const upcoming = filtered
    .filter((j) => j.status === "scheduled" && j.scheduledDate >= today)
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Jobs</h1>
        <p className="text-muted-foreground">Gérez et suivez tous les jobs</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button variant={hideCompleted ? "default" : "outline"} size="sm" onClick={() => setHideCompleted(!hideCompleted)}>
          {hideCompleted ? "Tout afficher" : "Masquer complétés"}
        </Button>
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Prochains jobs</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {upcoming.map((job) => <JobRow key={job.id} job={job} />)}
          </CardContent>
        </Card>
      )}

      {/* All */}
      <Card>
        <CardHeader><CardTitle>Tous les jobs ({filtered.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucun job trouvé.</p>
          ) : filtered.map((job) => <JobRow key={job.id} job={job} />)}
        </CardContent>
      </Card>
    </div>
  );
};

function JobRow({ job }: { job: Job }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border">
      <div className="space-y-1">
        <p className="font-medium">{getClientName(job.clientId)}</p>
        <div className="flex gap-2 text-xs text-muted-foreground">
          <span>{job.scheduledDate}</span>
          <span>·</span>
          <span>{job.cutType}</span>
          {job.totalDurationMinutes && (
            <>
              <span>·</span>
              <span>{job.totalDurationMinutes} min</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">${job.estimatedProfit}</span>
        <Badge className={statusColor[job.status]}>{job.status}</Badge>
      </div>
    </div>
  );
}

export default Jobs;
