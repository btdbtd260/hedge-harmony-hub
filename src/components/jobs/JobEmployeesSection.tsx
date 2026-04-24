import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, UserMinus } from "lucide-react";
import { toast } from "sonner";
import {
  useEmployees,
  useEmployeeJobs,
  useAddEmployeeToJob,
  useRemoveEmployeeFromJob,
  useUpdateEmployeeJob,
  type DbJob,
} from "@/hooks/useSupabaseData";

interface Props {
  job: DbJob;
}

/**
 * Manage employees present on a job.
 * - Green "Add" button to add an employee.
 * - Per-row hours input (only for normal employees — admins are paid by share).
 * - "Absent" toggle (sets is_present=false → DB trigger forces 0h/0$).
 * - Remove button.
 *
 * The DB trigger `recalc_job_pays` auto-recalculates everyone's pay
 * whenever rows or job.tip change.
 */
export function JobEmployeesSection({ job }: Props) {
  const { data: employees = [] } = useEmployees();
  const { data: employeeJobs = [] } = useEmployeeJobs();
  const addEJ = useAddEmployeeToJob();
  const removeEJ = useRemoveEmployeeFromJob();
  const updateEJ = useUpdateEmployeeJob();

  const [selectedToAdd, setSelectedToAdd] = useState<string>("");

  // Rows already on this job
  const rows = employeeJobs.filter((ej) => ej.job_id === job.id);
  const usedIds = new Set(rows.map((r) => r.employee_id));

  // Available employees to add (active, not already on this job)
  const available = employees.filter((e) => e.active && !usedIds.has(e.id));

  const handleAdd = async () => {
    if (!selectedToAdd) return;
    try {
      await addEJ.mutateAsync({ employee_id: selectedToAdd, job_id: job.id });
      setSelectedToAdd("");
      toast.success("Employé ajouté");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeEJ.mutateAsync(id);
      toast.success("Employé retiré");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleHours = async (id: string, value: string) => {
    const n = Number(value);
    if (Number.isNaN(n) || n < 0) return;
    try {
      await updateEJ.mutateAsync({ id, hours_worked: n });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleAbsent = async (id: string, currentlyPresent: boolean) => {
    try {
      await updateEJ.mutateAsync({ id, is_present: !currentlyPresent });
      toast.success(currentlyPresent ? "Marqué absent" : "Marqué présent");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="border-t pt-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Employés présents</p>
      </div>

      {/* Add row */}
      <div className="flex gap-2">
        <Select value={selectedToAdd} onValueChange={setSelectedToAdd}>
          <SelectTrigger className="h-9 flex-1">
            <SelectValue placeholder={available.length ? "Choisir un employé…" : "Tous déjà ajoutés"} />
          </SelectTrigger>
          <SelectContent>
            {available.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name} {e.is_admin ? "(admin)" : `· ${e.hourly_rate}$/h`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!selectedToAdd || addEJ.isPending}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Plus className="h-4 w-4 mr-1" />
          Ajouter
        </Button>
      </div>

      {/* Rows */}
      <div className="space-y-2">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground italic">Aucun employé sur cette job.</p>
        )}
        {rows.map((ej) => {
          const emp = employees.find((e) => e.id === ej.employee_id);
          if (!emp) return null;
          const present = ej.is_present !== false;
          return (
            <div
              key={ej.id}
              className={`flex flex-wrap items-center gap-2 p-2 rounded-md border ${
                present ? "" : "bg-muted/50 opacity-70"
              }`}
            >
              <div className="flex-1 min-w-[140px]">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{emp.name}</span>
                  {emp.is_admin && (
                    <Badge variant="secondary" className="text-[10px]">
                      Admin
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {emp.is_admin ? "Part du restant" : `${emp.hourly_rate}$/h`}
                </p>
              </div>

              {/* Hours input — only meaningful for normals; admins ignored by trigger */}
              {!emp.is_admin && present && (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    step={0.25}
                    className="h-8 w-20"
                    value={ej.hours_worked}
                    onChange={(e) => handleHours(ej.id, e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground">h</span>
                </div>
              )}

              <div className="text-sm font-semibold w-16 text-right">
                ${Number(ej.calculated_pay ?? 0).toFixed(2)}
              </div>

              <Button
                size="sm"
                variant={present ? "outline" : "default"}
                onClick={() => handleAbsent(ej.id, present)}
                title="Marquer absent (0h / 0$)"
              >
                <UserMinus className="h-3.5 w-3.5 mr-1" />
                {present ? "Absent" : "Présent"}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => handleRemove(ej.id)}
                title="Retirer de la job"
              >
                <X className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
