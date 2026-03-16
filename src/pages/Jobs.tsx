import { useState } from "react";
import { formatDateQC } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useJobs, useCustomers, useUpdateJob, getClientNameFromList, type DbJob } from "@/hooks/useSupabaseData";
import { Search, Calendar, XCircle } from "lucide-react";
import { toast } from "sonner";

const statusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  scheduled: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  hidden: "bg-gray-100 text-gray-500",
};

const Jobs = () => {
  const { data: jobs = [] } = useJobs();
  const { data: customers = [] } = useCustomers();
  const updateJob = useUpdateJob();
  const [search, setSearch] = useState("");
  const [hideCompleted, setHideCompleted] = useState(false);
  const [selectedJob, setSelectedJob] = useState<DbJob | null>(null);

  const filtered = jobs
    .filter((j) => j.status !== "hidden")
    .filter((j) => !hideCompleted || j.status !== "completed")
    .filter((j) => getClientNameFromList(customers, j.client_id).toLowerCase().includes(search.toLowerCase()));

  const today = new Date().toISOString().split("T")[0];
  const upcoming = filtered
    .filter((j) => j.status === "scheduled" && j.scheduled_date && j.scheduled_date >= today)
    .sort((a, b) => (a.scheduled_date ?? "").localeCompare(b.scheduled_date ?? ""));

  const pendingJobs = filtered.filter((j) => j.status === "pending");
  const allJobs = filtered;

  const snap = selectedJob?.measurement_snapshot as any;

  const handleRemovePending = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    try {
      await updateJob.mutateAsync({ id: jobId, status: "hidden" });
      toast.success("Job retiré");
    } catch (err: any) { toast.error(err.message); }
  };

  const handleStatusChange = async (jobId: string, newStatus: string) => {
    try {
      await updateJob.mutateAsync({ id: jobId, status: newStatus });
      toast.success(`Statut changé → ${newStatus}`);
      if (selectedJob?.id === jobId) {
        setSelectedJob((prev) => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err: any) { toast.error(err.message); }
  };

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
            <CardHeader><CardTitle>Tous les jobs ({allJobs.length})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {allJobs.length === 0 ? <p className="text-muted-foreground text-sm">Aucun job trouvé.</p> : allJobs.map((job) => (
                <JobRow key={job.id} job={job} clientName={getClientNameFromList(customers, job.client_id)} onClick={() => setSelectedJob(job)} onStatusChange={handleStatusChange} />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Prochains jobs</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {upcoming.length === 0 ? <p className="text-muted-foreground text-sm">Aucun job à venir.</p> : upcoming.map((job) => (
                <JobRow key={job.id} job={job} clientName={getClientNameFromList(customers, job.client_id)} onClick={() => setSelectedJob(job)} onStatusChange={handleStatusChange} />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Jobs en attente ({pendingJobs.length})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {pendingJobs.length === 0 ? <p className="text-muted-foreground text-sm">Aucun job pending.</p> : pendingJobs.map((job) => (
                <JobRow key={job.id} job={job} clientName={getClientNameFromList(customers, job.client_id)} onClick={() => setSelectedJob(job)} onRemovePending={handleRemovePending} onStatusChange={handleStatusChange} />
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <DialogContent>
          {selectedJob && (
            <>
              <DialogHeader><DialogTitle>Job — {getClientNameFromList(customers, selectedJob.client_id)}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Statut</span>
                  <Select value={selectedJob.status} onValueChange={(val) => handleStatusChange(selectedJob.id, val)}>
                    <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Type de coupe</span><span>{selectedJob.cut_type}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Date planifiée</span><span>{formatDateQC(selectedJob.scheduled_date)}</span></div>
                {selectedJob.start_time && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Début</span><span>{selectedJob.start_time}</span></div>}
                {selectedJob.end_time && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Fin</span><span>{selectedJob.end_time}</span></div>}
                {selectedJob.total_duration_minutes && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Durée</span><span>{selectedJob.total_duration_minutes} min</span></div>}
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Profit estimé</span><span className="font-semibold">${selectedJob.estimated_profit}</span></div>
                {selectedJob.real_profit !== null && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Profit réel</span><span className="font-semibold">${selectedJob.real_profit}</span></div>}
                {snap && (
                  <div className="border-t pt-3">
                    <p className="text-sm font-medium mb-2">Mesures</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">Façade: {snap.facadeLength ?? snap.facade_length ?? 0} pi</span>
                      <span className="text-muted-foreground">Gauche: {snap.leftLength ?? snap.left_length ?? 0} pi</span>
                      <span className="text-muted-foreground">Droite: {snap.rightLength ?? snap.right_length ?? 0} pi</span>
                      <span className="text-muted-foreground">Arrière: {snap.backLength ?? snap.back_length ?? 0} pi</span>
                      <span className="text-muted-foreground">Largeur: {snap.width ?? 0} pi</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

function JobRow({ job, clientName, onClick, onRemovePending, onStatusChange }: { job: DbJob; clientName: string; onClick: () => void; onRemovePending?: (e: React.MouseEvent, id: string) => void; onStatusChange?: (id: string, status: string) => void }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors" onClick={onClick}>
      <div className="space-y-1">
        <p className="font-medium">{clientName}</p>
        <div className="flex gap-2 text-xs text-muted-foreground">
          <span>{job.scheduled_date}</span><span>·</span><span>{job.cut_type}</span>
          {job.total_duration_minutes && <><span>·</span><span>{job.total_duration_minutes} min</span></>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">${job.estimated_profit}</span>
        <div onClick={(e) => e.stopPropagation()}>
          <Select value={job.status} onValueChange={(val) => onStatusChange?.(job.id, val)}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {job.status === "pending" && onRemovePending && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => onRemovePending(e, job.id)} title="Retirer ce job"><XCircle className="h-4 w-4 text-destructive" /></Button>
        )}
      </div>
    </div>
  );
}

export default Jobs;
