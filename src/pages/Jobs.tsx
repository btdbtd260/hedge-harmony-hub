import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { jobs as mockJobs, getClientName, customers } from "@/data/mock";
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
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const filtered = mockJobs
    .filter((j) => !hideCompleted || (j.status !== "completed" && j.status !== "hidden"))
    .filter((j) => getClientName(j.clientId).toLowerCase().includes(search.toLowerCase()));

  const today = new Date().toISOString().split("T")[0];
  const upcoming = filtered
    .filter((j) => j.status === "scheduled" && j.scheduledDate >= today)
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));

  const pendingJobs = filtered.filter((j) => j.status === "pending");
  const allNonPending = filtered.filter((j) => j.status !== "pending");

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

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Tous les jobs</TabsTrigger>
          <TabsTrigger value="upcoming">Prochains</TabsTrigger>
          <TabsTrigger value="pending">Jobs pending ({pendingJobs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Tous les jobs ({allNonPending.length})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {allNonPending.length === 0 ? (
                <p className="text-muted-foreground text-sm">Aucun job trouvé.</p>
              ) : allNonPending.map((job) => (
                <JobRow key={job.id} job={job} onClick={() => setSelectedJob(job)} />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Prochains jobs</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {upcoming.length === 0 ? (
                <p className="text-muted-foreground text-sm">Aucun job à venir.</p>
              ) : upcoming.map((job) => (
                <JobRow key={job.id} job={job} onClick={() => setSelectedJob(job)} />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Jobs en attente ({pendingJobs.length})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {pendingJobs.length === 0 ? (
                <p className="text-muted-foreground text-sm">Aucun job pending.</p>
              ) : pendingJobs.map((job) => (
                <JobRow key={job.id} job={job} onClick={() => setSelectedJob(job)} />
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Job Detail Dialog */}
      <Dialog open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <DialogContent>
          {selectedJob && (
            <>
              <DialogHeader>
                <DialogTitle>Job — {getClientName(selectedJob.clientId)}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Statut</span>
                  <Badge className={statusColor[selectedJob.status]}>{selectedJob.status}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Type de coupe</span>
                  <span>{selectedJob.cutType}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Date planifiée</span>
                  <span>{selectedJob.scheduledDate}</span>
                </div>
                {selectedJob.startTime && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Début</span>
                    <span>{selectedJob.startTime}</span>
                  </div>
                )}
                {selectedJob.endTime && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Fin</span>
                    <span>{selectedJob.endTime}</span>
                  </div>
                )}
                {selectedJob.totalDurationMinutes && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Durée</span>
                    <span>{selectedJob.totalDurationMinutes} min</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Profit estimé</span>
                  <span className="font-semibold">${selectedJob.estimatedProfit}</span>
                </div>
                {selectedJob.realProfit !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Profit réel</span>
                    <span className="font-semibold">${selectedJob.realProfit}</span>
                  </div>
                )}

                {/* Measurement snapshot */}
                <div className="border-t pt-3">
                  <p className="text-sm font-medium mb-2">Mesures</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Façade: {selectedJob.measurementSnapshot.facadeLength} pi</span>
                    <span className="text-muted-foreground">Gauche: {selectedJob.measurementSnapshot.leftLength} pi</span>
                    <span className="text-muted-foreground">Droite: {selectedJob.measurementSnapshot.rightLength} pi</span>
                    <span className="text-muted-foreground">Arrière: {selectedJob.measurementSnapshot.backLength} pi</span>
                    <span className="text-muted-foreground">Hauteur: {selectedJob.measurementSnapshot.heightMode === "global" ? `${selectedJob.measurementSnapshot.heightGlobal} pi` : "par côté"}</span>
                    <span className="text-muted-foreground">Largeur: {selectedJob.measurementSnapshot.width} pi</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

function JobRow({ job, onClick }: { job: Job; onClick: () => void }) {
  return (
    <div
      className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={onClick}
    >
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
