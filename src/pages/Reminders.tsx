import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { reminders as mockReminders, getClientName, customers } from "@/data/mock";
import { Bell, CheckCircle, Clock, Wrench, Plus } from "lucide-react";
import type { Reminder, ReminderType } from "@/types";

const Reminders = () => {
  const [reminderList, setReminderList] = useState<Reminder[]>(mockReminders);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newType, setNewType] = useState<ReminderType>("client");
  const [newDescription, setNewDescription] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newReferenceId, setNewReferenceId] = useState("");

  const markDone = (id: string) => {
    setReminderList((prev) => prev.map((r) => r.id === id ? { ...r, isCompleted: true } : r));
  };

  const activeReminders = reminderList.filter((r) => !r.isCompleted);
  const clientReminders = activeReminders.filter((r) => r.type === "client");
  const maintenanceReminders = activeReminders.filter((r) => r.type === "maintenance");

  const setQuickDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setNewDueDate(d.toISOString().split("T")[0]);
  };

  const setNextMonthStart = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 1);
    setNewDueDate(d.toISOString().split("T")[0]);
  };

  const handleAdd = () => {
    if (!newDescription.trim() || !newDueDate) return;
    const newReminder: Reminder = {
      id: `r-${Date.now()}`,
      type: newType,
      referenceId: newType === "client" ? newReferenceId || undefined : undefined,
      dueDate: newDueDate,
      description: newDescription.trim(),
      isCompleted: false,
      notificationSent: false,
    };
    setReminderList((prev) => [...prev, newReminder]);
    setShowAddDialog(false);
    setNewDescription("");
    setNewDueDate("");
    setNewReferenceId("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rappels</h1>
          <p className="text-muted-foreground">Suivez vos rappels clients et maintenance</p>
        </div>
        <div className="flex items-center gap-2">
          {activeReminders.length > 0 && (
            <Badge variant="destructive" className="text-sm px-3 py-1">
              <Bell className="h-4 w-4 mr-1" /> {activeReminders.length} actif(s)
            </Badge>
          )}
          <Button onClick={() => setShowAddDialog(true)}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
        </div>
      </div>

      {/* Client Reminders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Rappels clients</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {clientReminders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun rappel client actif.</p>
          ) : clientReminders.map((r) => (
            <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium">{r.description}</p>
                <p className="text-xs text-muted-foreground">
                  {r.referenceId ? getClientName(r.referenceId) : ""} · Échéance: {r.dueDate}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => markDone(r.id)}>
                <CheckCircle className="h-3 w-3 mr-1" /> Fait
              </Button>
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
            <p className="text-sm text-muted-foreground">Aucun rappel de maintenance actif.</p>
          ) : maintenanceReminders.map((r) => (
            <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium">{r.description}</p>
                <p className="text-xs text-muted-foreground">Échéance: {r.dueDate}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => markDone(r.id)}>
                <CheckCircle className="h-3 w-3 mr-1" /> Fait
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Add Reminder Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau rappel</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={newType} onValueChange={(v) => setNewType(v as ReminderType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newType === "client" && (
              <div className="space-y-1">
                <Label>Client (optionnel)</Label>
                <Select value={newReferenceId} onValueChange={setNewReferenceId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                  <SelectContent>
                    {customers.filter((c) => !c.hidden).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>Description *</Label>
              <Input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Description du rappel" />
            </div>
            <div className="space-y-1">
              <Label>Date d'échéance *</Label>
              <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
              <div className="flex gap-2 mt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setQuickDate(7)}>7 jours</Button>
                <Button type="button" variant="outline" size="sm" onClick={setNextMonthStart}>Début mois prochain</Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Annuler</Button>
            <Button onClick={handleAdd} disabled={!newDescription.trim() || !newDueDate}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Reminders;
