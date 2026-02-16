import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { jobs as mockJobs } from "@/data/mock";
import { Search, Calendar } from "lucide-react";
import type { Job } from "@/types";

const statusColor: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
};

const Jobs = () => {
  const [search, setSearch] = useState("");
  const [hideCompleted, setHideCompleted] = useState(false);

  const filtered = mockJobs
    .filter((j) => !hideCompleted || j.status !== "completed")
    .filter((j) => j.customerName.toLowerCase().includes(search.toLowerCase()) || j.address.toLowerCase().includes(search.toLowerCase()));

  const upcoming = filtered
    .filter((j) => j.status === "scheduled")
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Jobs</h1>
          <p className="text-muted-foreground">Manage and track all trimming jobs</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search jobs…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button variant={hideCompleted ? "default" : "outline"} size="sm" onClick={() => setHideCompleted(!hideCompleted)}>
          {hideCompleted ? "Show All" : "Hide Completed"}
        </Button>
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Upcoming Jobs</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {upcoming.map((job) => <JobRow key={job.id} job={job} />)}
          </CardContent>
        </Card>
      )}

      {/* All Jobs */}
      <Card>
        <CardHeader><CardTitle>All Jobs ({filtered.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm">No jobs found.</p>
          ) : (
            filtered.map((job) => <JobRow key={job.id} job={job} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
};

function JobRow({ job }: { job: Job }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border">
      <div className="space-y-1">
        <p className="font-medium">{job.customerName}</p>
        <p className="text-sm text-muted-foreground">{job.address}</p>
        <div className="flex gap-2 text-xs text-muted-foreground">
          <span>{job.scheduledDate}</span>
          <span>·</span>
          <span>{job.serviceType}</span>
          <span>·</span>
          <span>{job.crewName}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge className={statusColor[job.status]}>{job.status.replace("_", " ")}</Badge>
      </div>
    </div>
  );
}

export default Jobs;
