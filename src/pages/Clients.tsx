import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { customers as mockCustomers, jobs } from "@/data/mock";
import { Search, Eye, EyeOff, Plus, X } from "lucide-react";
import type { Customer } from "@/types";

const statusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  scheduled: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  next_year: "bg-purple-100 text-purple-700",
};

const Clients = () => {
  const [customerList, setCustomerList] = useState<Customer[]>(mockCustomers);
  const [search, setSearch] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Customer | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formAddress, setFormAddress] = useState("");

  const filtered = customerList
    .filter((c) => showHidden || !c.hidden)
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.address.toLowerCase().includes(search.toLowerCase()));

  const currentYear = filtered.filter((c) => c.status !== "next_year");
  const nextYear = filtered.filter((c) => c.status === "next_year");

  const handleAdd = () => {
    if (!formName.trim()) return;
    const newClient: Customer = {
      id: `c-${Date.now()}`,
      name: formName.trim(),
      phone: formPhone.trim(),
      email: formEmail.trim(),
      address: formAddress.trim(),
      status: "pending",
      hidden: false,
      createdAt: new Date().toISOString().split("T")[0],
      activeYear: new Date().getFullYear(),
    };
    setCustomerList((prev) => [...prev, newClient]);
    setShowAddDialog(false);
    setFormName("");
    setFormPhone("");
    setFormEmail("");
    setFormAddress("");
  };

  const clientJobs = selectedClient ? jobs.filter((j) => j.clientId === selectedClient.id) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clients</h1>
          <p className="text-muted-foreground">Gérez votre liste de clients</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}><Plus className="h-4 w-4 mr-1" /> Nouveau client</Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher un client…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowHidden(!showHidden)}>
          {showHidden ? <><EyeOff className="h-4 w-4 mr-1" /> Masquer</> : <><Eye className="h-4 w-4 mr-1" /> Voir masqués</>}
        </Button>
      </div>

      {/* Client List */}
      <Card>
        <CardHeader><CardTitle>Tous les clients ({currentYear.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {currentYear.length === 0 ? <p className="text-sm text-muted-foreground">Aucun client trouvé.</p> : currentYear.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => setSelectedClient(c)}
            >
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-muted-foreground">{c.address}</p>
                <p className="text-xs text-muted-foreground">{c.phone} · {c.email}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {jobs.filter((j) => j.clientId === c.id).length} job(s)
                </p>
              </div>
              <Badge className={statusColor[c.status]}>{c.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Next Year */}
      {nextYear.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Année prochaine ({nextYear.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {nextYear.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setSelectedClient(c)}
              >
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-muted-foreground">{c.address}</p>
                </div>
                <Badge className={statusColor.next_year}>année prochaine</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Client Detail Dialog */}
      <Dialog open={!!selectedClient} onOpenChange={(open) => !open && setSelectedClient(null)}>
        <DialogContent>
          {selectedClient && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedClient.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Téléphone</span>
                  <span>{selectedClient.phone}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Email</span>
                  <span>{selectedClient.email}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Adresse</span>
                  <span>{selectedClient.address}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Statut</span>
                  <Badge className={statusColor[selectedClient.status]}>{selectedClient.status}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Année active</span>
                  <span>{selectedClient.activeYear}</span>
                </div>

                {/* Job history */}
                <div className="border-t pt-3">
                  <p className="text-sm font-medium mb-2">Historique des jobs ({clientJobs.length})</p>
                  {clientJobs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun job.</p>
                  ) : clientJobs.map((j) => (
                    <div key={j.id} className="flex justify-between text-sm p-2 rounded border mb-1">
                      <span>{j.cutType} · {j.scheduledDate}</span>
                      <div className="flex items-center gap-2">
                        <span>${j.estimatedProfit}</span>
                        <Badge className={`text-xs ${statusColor[j.status] || ""}`}>{j.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Client Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau client</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nom *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nom complet" />
            </div>
            <div className="space-y-1">
              <Label>Téléphone</Label>
              <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="514-555-0000" />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="email@exemple.com" />
            </div>
            <div className="space-y-1">
              <Label>Adresse</Label>
              <Input value={formAddress} onChange={(e) => setFormAddress(e.target.value)} placeholder="123 Rue Exemple" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Annuler</Button>
            <Button onClick={handleAdd} disabled={!formName.trim()}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Clients;
