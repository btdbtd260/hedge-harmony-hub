import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { employees, employeeJobs, jobs, getClientName } from "@/data/mock";

const Employees = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Employés</h1>
        <p className="text-muted-foreground">Gestion de l'équipe et calcul des paies</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {employees.map((emp) => {
          const empJobs = employeeJobs.filter((ej) => ej.employeeId === emp.id);
          const totalHours = empJobs.reduce((s, ej) => s + ej.hoursWorked, 0);
          const totalPay = empJobs.reduce((s, ej) => s + ej.calculatedPay, 0);

          return (
            <Card key={emp.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{emp.name}</CardTitle>
                  <Badge variant={emp.active ? "default" : "secondary"}>
                    {emp.active ? "Actif" : "Inactif"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-4 text-sm">
                  <span className="text-muted-foreground">Taux horaire:</span>
                  <span className="font-medium">${emp.hourlyRate}/h</span>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-muted-foreground">Heures travaillées:</span>
                  <span className="font-medium">{totalHours}h</span>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-muted-foreground">Paie totale:</span>
                  <span className="font-medium font-semibold">${totalPay}</span>
                </div>

                {empJobs.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Jobs effectués</p>
                    {empJobs.map((ej) => {
                      const job = jobs.find((j) => j.id === ej.jobId);
                      return (
                        <div key={ej.id} className="text-sm p-2 rounded border mb-1 flex justify-between">
                          <span>{job ? getClientName(job.clientId) : "Job inconnu"}</span>
                          <span className="text-muted-foreground">{ej.hoursWorked}h · ${ej.calculatedPay}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {empJobs.length === 0 && emp.active && (
                  <p className="text-sm text-muted-foreground italic">Aucun job assigné</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Employees;
