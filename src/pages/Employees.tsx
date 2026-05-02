import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  useEmployees,
  useInsertEmployee,
  useUpdateEmployee,
  type DbEmployee,
} from "@/hooks/useSupabaseData";
import { useCompletedEmployeeJobs } from "@/hooks/useCompletedEmployeeJobs";
import { Plus, Pencil, UserX, Shield } from "lucide-react";
import { toast } from "sonner";
import { EmployeeProfileDialog } from "@/components/employees/EmployeeProfileDialog";

const Employees = () => {
  const { data: employees = [] } = useEmployees();
  const { data: employeeJobs = [] } = useCompletedEmployeeJobs();
  const insertEmployee = useInsertEmployee();
  const updateEmployee = useUpdateEmployee();

  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formRate, setFormRate] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  // Profile dialog
  const [profileEmployee, setProfileEmployee] = useState<DbEmployee | null>(null);

  const openAdd = () => { setEditingId(null); setFormName(""); setFormRate(""); setFormActive(true); setShowDialog(true); };
  const openEdit = (emp: DbEmployee) => {
    setEditingId(emp.id); setFormName(emp.name); setFormRate(String(emp.hourly_rate)); setFormActive(emp.active); setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formRate) return;
    try {
      if (editingId) {
        await updateEmployee.mutateAsync({ id: editingId, name: formName.trim(), hourly_rate: Number(formRate), active: formActive });
      } else {
        // New employees are NEVER admin (admin status is locked at DB level)
        await insertEmployee.mutateAsync({ name: formName.trim(), hourly_rate: Number(formRate), active: formActive });
      }
      setShowDialog(false);
      toast.success(editingId ? "Employé modifié" : "Employé créé");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleRemove = async (emp: DbEmployee) => {
    if (emp.is_admin) {
      toast.error("Un employé admin ne peut pas être désactivé");
      return;
    }
    try {
      await updateEmployee.mutateAsync({ id: emp.id, active: false });
      toast.success("Employé retiré");
    } catch (e: any) { toast.error(e.message); }
  };

  const displayedEmployees = showInactive ? employees : employees.filter((e) => e.active);
  // Admins first
  const sorted = [...displayedEmployees].sort((a, b) => Number(b.is_admin) - Number(a.is_admin));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employés</h1>
          <p className="text-muted-foreground">Gestion de l'équipe et calcul des paies</p>
        </div>
        <div className="flex gap-2">
          <Button variant={showInactive ? "default" : "outline"} size="sm" onClick={() => setShowInactive(!showInactive)}>
            {showInactive ? "Masquer inactifs" : "Voir inactifs"}
          </Button>
          <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sorted.map((emp) => {
          const empJobs = employeeJobs.filter((ej) => ej.employee_id === emp.id);
          const totalHours = empJobs.reduce((s, ej) => s + Number(ej.hours_worked ?? 0), 0);
          const totalPay = empJobs.reduce((s, ej) => s + Number(ej.calculated_pay ?? 0), 0);

          return (
            <Card
              key={emp.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setProfileEmployee(emp)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {emp.name}
                    {emp.is_admin && (
                      <Badge variant="default" className="text-[10px]">
                        <Shield className="h-3 w-3 mr-1" />
                        Admin
                      </Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Badge variant={emp.active ? "default" : "secondary"}>{emp.active ? "Actif" : "Inactif"}</Badge>
                    {!emp.is_admin && (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}><Pencil className="h-4 w-4" /></Button>
                    )}
                    {emp.active && !emp.is_admin && (
                      <Button variant="ghost" size="icon" onClick={() => handleRemove(emp)} title="Retirer l'employé">
                        <UserX className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex gap-4 text-sm">
                  <span className="text-muted-foreground">Taux horaire:</span>
                  <span className="font-medium">
                    {emp.is_admin ? "—" : `$${emp.hourly_rate}/h`}
                  </span>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-muted-foreground">Heures confirmées:</span>
                  <span className="font-medium">{totalHours}h</span>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-muted-foreground">
                    {emp.is_admin ? "Revenu total:" : "Paie totale:"}
                  </span>
                  <span className="font-semibold">${totalPay.toFixed(2)}</span>
                </div>
                <p className="text-xs text-muted-foreground italic pt-1">
                  Cliquer pour voir l'historique et la finance.
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Profile dialog */}
      <EmployeeProfileDialog
        employee={profileEmployee}
        onOpenChange={(open) => !open && setProfileEmployee(null)}
      />

      {/* Add / Edit dialog */}
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
