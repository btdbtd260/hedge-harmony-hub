import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { reminders, getClientName } from "@/data/mock";
import { Bell, CheckCircle, Clock, Wrench } from "lucide-react";

const Reminders = () => {
  const clientReminders = reminders.filter((r) => r.type === "client");
  const maintenanceReminders = reminders.filter((r) => r.type === "maintenance");
  const active = reminders.filter((r) => !r.isCompleted);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rappels</h1>
          <p className="text-muted-foreground">Suivez vos rappels clients et maintenance</p>
        </div>
        {active.length > 0 && (
          <Badge variant="destructive" className="text-sm px-3 py-1">
            <Bell className="h-4 w-4 mr-1" /> {active.length} actif(s)
          </Badge>
        )}
      </div>

      {/* Client Reminders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Rappels clients</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {clientReminders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun rappel client.</p>
          ) : clientReminders.map((r) => (
            <div key={r.id} className={`flex items-center justify-between p-3 rounded-lg border ${r.isCompleted ? "opacity-50" : ""}`}>
              <div>
                <p className="font-medium">{r.description}</p>
                <p className="text-xs text-muted-foreground">
                  {r.referenceId ? getClientName(r.referenceId) : ""} · Échéance: {r.dueDate}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {r.isCompleted ? (
                  <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle className="h-3 w-3 mr-1" /> Fait</Badge>
                ) : (
                  <Button size="sm" variant="outline">Marquer fait</Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Maintenance Reminders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" /> Maintenance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {maintenanceReminders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun rappel de maintenance.</p>
          ) : maintenanceReminders.map((r) => (
            <div key={r.id} className={`flex items-center justify-between p-3 rounded-lg border ${r.isCompleted ? "opacity-50" : ""}`}>
              <div>
                <p className="font-medium">{r.description}</p>
                <p className="text-xs text-muted-foreground">Échéance: {r.dueDate}</p>
              </div>
              <div className="flex items-center gap-2">
                {r.isCompleted ? (
                  <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle className="h-3 w-3 mr-1" /> Fait</Badge>
                ) : (
                  <Button size="sm" variant="outline">Marquer fait</Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default Reminders;
