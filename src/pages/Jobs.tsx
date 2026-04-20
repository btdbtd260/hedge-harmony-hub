import { useState } from "react";
import { formatDateQC } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useJobs, useCustomers, useUpdateJob, useInsertInvoice, getClientNameFromList, type DbJob } from "@/hooks/useSupabaseData";
import { Search, Calendar, XCircle, FileDown } from "lucide-react";
import { toast } from "sonner";
import { JobPhotosManager } from "@/components/jobs/JobPhotosManager";

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
  const insertInvoice = useInsertInvoice();
  const [search, setSearch] = useState("");
  const [hideCompleted, setHideCompleted] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const selectedJob = selectedJobId ? jobs.find((j) => j.id === selectedJobId) ?? null : null;
  const [jobToRemove, setJobToRemove] = useState<{ id: string; name: string } | null>(null);

  // Create invoice dialog
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [invoiceJobId, setInvoiceJobId] = useState<string>("");
  const [invoiceDesc, setInvoiceDesc] = useState("");

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

  // ── Completed jobs with year filter ──
  // Uses scheduled_date (most logical date for a completed job); falls back to created_at.
  const getJobYear = (j: DbJob): number => {
    const dateStr = j.scheduled_date ?? j.created_at;
    return dateStr ? new Date(dateStr).getFullYear() : new Date().getFullYear();
  };
  const completedJobs = jobs.filter((j) => j.status === "completed");
  const availableYears = Array.from(new Set(completedJobs.map(getJobYear))).sort((a, b) => b - a);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
  const completedFiltered = completedJobs
    .filter((j) => selectedYear === "all" || getJobYear(j) === Number(selectedYear))
    .filter((j) => getClientNameFromList(customers, j.client_id).toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (b.scheduled_date ?? b.created_at ?? "").localeCompare(a.scheduled_date ?? a.created_at ?? ""));

  const snap = selectedJob?.measurement_snapshot as any;

  const handleRemoveClick = (e: React.MouseEvent, jobId: string, clientName: string) => {
    e.stopPropagation();
    setJobToRemove({ id: jobId, name: clientName });
  };

  const handleConfirmRemove = async () => {
    if (!jobToRemove) return;
    try {
      await updateJob.mutateAsync({ id: jobToRemove.id, status: "hidden" });
      toast.success("Job retiré");
      if (selectedJob?.id === jobToRemove.id) setSelectedJobId(null);
    } catch (err: any) { toast.error(err.message); }
    setJobToRemove(null);
  };

  const handleStatusChange = async (jobId: string, newStatus: string) => {
    try {
      await updateJob.mutateAsync({ id: jobId, status: newStatus });
      toast.success(`Statut changé → ${newStatus}`);
    } catch (err: any) { toast.error(err.message); }
  };

  // ── Create invoice from job ──
  const selectedJobForInvoice = jobs.find((j) => j.id === invoiceJobId);

  const handleCreateInvoice = async () => {
    if (!selectedJobForInvoice) return;
    try {
      const amount = selectedJobForInvoice.real_profit ?? selectedJobForInvoice.estimated_profit ?? 0;
      await insertInvoice.mutateAsync({
        job_id: selectedJobForInvoice.id,
        client_id: selectedJobForInvoice.client_id,
        amount,
        status: "unpaid",
      });
      toast.success("Facture créée avec succès");
      setShowCreateInvoice(false);
      setInvoiceJobId("");
      setInvoiceDesc("");
    } catch (err: any) { toast.error(err.message); }
  };

  const completedJobsForInvoice = jobs.filter((j) => j.status === "completed" || j.status === "scheduled");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Jobs</h1>
          <p className="text-muted-foreground">Gérez et suivez tous les jobs</p>
        </div>
        <Button onClick={() => setShowCreateInvoice(true)}>
          <FileDown className="h-4 w-4 mr-1" />Créer une facture
        </Button>
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
          <TabsTrigger value="completed">Complétés ({completedJobs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Tous les jobs ({allJobs.length})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {allJobs.length === 0 ? <p className="text-muted-foreground text-sm">Aucun job trouvé.</p> : allJobs.map((job) => (
                <JobRow key={job.id} job={job} clientName={getClientNameFromList(customers, job.client_id)} onClick={() => setSelectedJobId(job.id)} onStatusChange={handleStatusChange} onRemove={handleRemoveClick} />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Prochains jobs</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {upcoming.length === 0 ? <p className="text-muted-foreground text-sm">Aucun job à venir.</p> : upcoming.map((job) => (
                <JobRow key={job.id} job={job} clientName={getClientNameFromList(customers, job.client_id)} onClick={() => setSelectedJobId(job.id)} onStatusChange={handleStatusChange} onRemove={handleRemoveClick} />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Jobs en attente ({pendingJobs.length})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {pendingJobs.length === 0 ? <p className="text-muted-foreground text-sm">Aucun job pending.</p> : pendingJobs.map((job) => (
                <JobRow key={job.id} job={job} clientName={getClientNameFromList(customers, job.client_id)} onClick={() => setSelectedJobId(job.id)} onStatusChange={handleStatusChange} onRemove={handleRemoveClick} />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <CardTitle>Jobs complétés ({completedFiltered.length})</CardTitle>
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Année</Label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes</SelectItem>
                      {availableYears.map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                      {!availableYears.includes(currentYear) && (
                        <SelectItem value={String(currentYear)}>{currentYear}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {completedFiltered.length === 0 ? (
                <p className="text-muted-foreground text-sm">Aucun job complété pour cette période.</p>
              ) : completedFiltered.map((job) => (
                <JobRow key={job.id} job={job} clientName={getClientNameFromList(customers, job.client_id)} onClick={() => setSelectedJobId(job.id)} onStatusChange={handleStatusChange} onRemove={handleRemoveClick} />
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Job detail dialog ── */}
      <Dialog open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJobId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                <JobPhotosManager job={selectedJob} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Remove confirmation ── */}
      <AlertDialog open={!!jobToRemove} onOpenChange={(open) => !open && setJobToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer ce job ?</AlertDialogTitle>
            <AlertDialogDescription>Le job de «{jobToRemove?.name}» sera masqué.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Retirer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Create invoice from job dialog ── */}
      <Dialog open={showCreateInvoice} onOpenChange={setShowCreateInvoice}>
        <DialogContent>
          <DialogHeader><DialogTitle>Créer une facture</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Sélectionner un job</Label>
              <Select value={invoiceJobId} onValueChange={setInvoiceJobId}>
                <SelectTrigger><SelectValue placeholder="Choisir un job…" /></SelectTrigger>
                <SelectContent>
                  {completedJobsForInvoice.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {getClientNameFromList(customers, j.client_id)} · {j.cut_type} · {formatDateQC(j.scheduled_date)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedJobForInvoice && (
              <div className="p-3 rounded-lg bg-muted space-y-1 text-sm">
                <p><span className="text-muted-foreground">Client:</span> {getClientNameFromList(customers, selectedJobForInvoice.client_id)}</p>
                <p><span className="text-muted-foreground">Montant:</span> ${selectedJobForInvoice.real_profit ?? selectedJobForInvoice.estimated_profit ?? 0}</p>
                <p><span className="text-muted-foreground">Type:</span> {selectedJobForInvoice.cut_type}</p>
              </div>
            )}

            <div className="space-y-1">
              <Label>Description (optionnel)</Label>
              <Textarea value={invoiceDesc} onChange={(e) => setInvoiceDesc(e.target.value)} placeholder="Ex: Service completion on hedge work" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateInvoice(false)}>Annuler</Button>
            <Button onClick={handleCreateInvoice} disabled={!invoiceJobId}>Créer la facture</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function JobRow({ job, clientName, onClick, onRemove, onStatusChange }: { job: DbJob; clientName: string; onClick: () => void; onRemove?: (e: React.MouseEvent, id: string, name: string) => void; onStatusChange?: (id: string, status: string) => void }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors" onClick={onClick}>
      <div className="space-y-1">
        <p className="font-medium">{clientName}</p>
        <div className="flex gap-2 text-xs text-muted-foreground">
          <span>{formatDateQC(job.scheduled_date)}</span><span>·</span><span>{job.cut_type}</span>
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
        {onRemove && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => onRemove(e, job.id, clientName)} title="Retirer ce job"><XCircle className="h-4 w-4 text-destructive" /></Button>
        )}
      </div>
    </div>
  );
}

export default Jobs;
