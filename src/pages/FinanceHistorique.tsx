import { useState } from "react";
import { useInvoices, useCustomers, useJobs } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { getClientNameFromList } from "@/hooks/useSupabaseData";
import { formatDateQC } from "@/lib/utils";

type FilterMode = "daily" | "weekly" | "yearly";

const FinanceHistorique = () => {
  const { data: invoices = [] } = useInvoices();
  const { data: customers = [] } = useCustomers();
  const { data: jobs = [] } = useJobs();
  const [filter, setFilter] = useState<FilterMode>("yearly");
  const [selectedInvoiceJob, setSelectedInvoiceJob] = useState<string | null>(null);

  const now = new Date();

  const getWeekRange = () => {
    const end = new Date(now);
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { start, end };
  };

  const filterByDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (filter === "daily") return d.toISOString().split("T")[0] === now.toISOString().split("T")[0];
    if (filter === "weekly") {
      const { start, end } = getWeekRange();
      return d >= new Date(start.toISOString().split("T")[0]) && d <= end;
    }
    return d.getFullYear() === now.getFullYear();
  };

  const filteredInvoices = invoices.filter((i) => i.status === "paid" && filterByDate(i.paid_at || i.issued_at));
  const profitTotal = filteredInvoices.reduce((s, inv) => s + inv.amount, 0);

  const selectedJob = selectedInvoiceJob ? jobs.find((j) => j.id === selectedInvoiceJob) : null;
  const selectedInvoice = selectedInvoiceJob ? invoices.find((i) => i.job_id === selectedInvoiceJob) : null;

  const filterLabel: Record<FilterMode, string> = { daily: "Quotidien", weekly: "Hebdo", yearly: "Annuel" };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterMode)}
          className="flex h-10 w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="daily">Quotidien</option>
          <option value="weekly">Hebdo</option>
          <option value="yearly">Annuel</option>
        </select>
        <span className="text-sm text-muted-foreground">Période : {filterLabel[filter]}</span>
      </div>
      <div className="space-y-3">
        <div className="text-lg font-bold text-emerald-600">
          Total : ${profitTotal.toFixed(2)}
        </div>
        {filteredInvoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune facture payée pour cette période.</p>
        ) : filteredInvoices.map((inv) => {
          const job = jobs.find((j) => j.id === inv.job_id);
          return (
            <div
              key={inv.id}
              className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => setSelectedInvoiceJob(inv.job_id)}
            >
              <div>
                <p className="font-medium">{getClientNameFromList(customers, inv.client_id)}</p>
                <p className="text-xs text-muted-foreground">{formatDateQC(inv.paid_at || inv.issued_at)}{job ? ` · ${job.cut_type}` : ""}</p>
              </div>
              <p className="font-semibold text-emerald-600">+${inv.amount.toFixed(2)}</p>
            </div>
          );
        })}
      </div>

      <Dialog open={!!selectedInvoiceJob} onOpenChange={(open) => !open && setSelectedInvoiceJob(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Détail de la job</DialogTitle></DialogHeader>
          {selectedJob && selectedInvoice ? (
            <div className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Client</span><span>{getClientNameFromList(customers, selectedInvoice.client_id)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Date</span><span>{formatDateQC(selectedJob.scheduled_date || selectedJob.created_at)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Type de coupe</span><span>{selectedJob.cut_type}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Statut</span><span>{selectedJob.status}</span></div>
              <div className="flex justify-between text-sm font-semibold"><span className="text-muted-foreground">Profit</span><span className="text-emerald-600">+${selectedInvoice.amount.toFixed(2)}</span></div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Job introuvable.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedInvoiceJob(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinanceHistorique;
