import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useEmployees, useEmployeeJobs, useJobs, useCustomers, useInsertEmployee, useUpdateEmployee, getClientNameFromList } from "@/hooks/useSupabaseData";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

const Employees = () => {
  const { data: employees = [] } = useEmployees();
  const { data: employeeJobs = [] } = useEmployeeJobs();
  const { data: jobs = [] } = useJobs();
  const { data: customers = [] } = useCustomers();
  const insertEmployee = useInsertEmployee();
  const updateEmployee = useUpdateEmployee();

  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formRate, setFormRate] = useState("");
  const [formActive, setFormActive] = useState(true);

  const openAdd = () => { setEditingId(null); setFormName(""); setFormRate(""); setFormActive(true); setShowDialog(true); };
  const openEdit = (emp: { id: string; name: string; hourly_rate: number; active: boolean }) => {
    setEditingId(emp.id); setFormName(emp.name); setFormRate(String(emp.hourly_rate)); setFormActive(emp.active); setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formRate) return;
    try {
      if (editingId) {
        await updateEmployee.mutateAsync({ id: editingId, name: formName.trim(), hourly_rate: Number(formRate), active: formActive });
      } else {
        await insertEmployee.mutateAsync({ name: formName.trim(), hourly_rate: Number(formRate), active: formActive });
      }
      setShowDialog(false);
      toast.success(editingId ? "Employé modifié" : "Employé créé");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employés</h1>
          <p className="text-muted-foreground">Gestion de l'équipe et calcul des paies</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {employees.map((emp) => {
          const empJobs = employeeJobs.filter((ej) => ej.employee_id === emp.id);
          const totalHours = empJobs.reduce((s, ej) => s + ej.hours_worked, 0);
          const totalPay = empJobs.reduce((s, ej) => s + ej.calculated_pay, 0);

          return (
            <Card key={emp.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{emp.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={emp.active ? "default" : "secondary"}>{emp.active ? "Actif" : "Inactif"}</Badge>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}><Pencil className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-4 text-sm"><span className="text-muted-foreground">Taux horaire:</span><span className="font-medium">${emp.hourly_rate}/h</span></div>
                <div className="flex gap-4 text-sm"><span className="text-muted-foreground">Heures travaillées:</span><span className="font-medium">{totalHours}h</span></div>
                <div className="flex gap-4 text-sm"><span className="text-muted-foreground">Paie totale:</span><span className="font-semibold">${totalPay}</span></div>
                {empJobs.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Jobs effectués</p>
                    {empJobs.map((ej) => {
                      const job = jobs.find((j) => j.id === ej.job_id);
                      return (
                        <div key={ej.id} className="text-sm p-2 rounded border mb-1 flex justify-between">
                          <span>{job ? getClientNameFromList(customers, job.client_id) : "Job inconnu"}</span>
                          <span className="text-muted-foreground">{ej.hours_worked}h · ${ej.calculated_pay}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {empJobs.length === 0 && emp.active && <p className="text-sm text-muted-foreground italic">Aucun job assigné</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Modifier employé" : "Nouvel employé"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Nom *</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nom complet" /></div>
            <div className="space-y-1"><Label>Taux horaire ($) *</Label><Input type="number" min={0} value={formRate} onChange={(e) => setFormRate(e.target.value)} placeholder="20" /></div>
            <div className="flex items-center gap-2"><input type="checkbox" checked={formActive} onChange={(e) => setFormActive(e.target.checked)} id="emp-active" /><Label htmlFor="emp-active">Actif</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={!formName.trim() || !formRate}>{editingId ? "Sauvegarder" : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Employees;
