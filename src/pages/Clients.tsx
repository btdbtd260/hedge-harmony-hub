import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { customers as mockCustomers, jobs, getClientName } from "@/data/mock";
import { Search, Eye, EyeOff } from "lucide-react";

const statusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  scheduled: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  next_year: "bg-purple-100 text-purple-700",
};

const Clients = () => {
  const [search, setSearch] = useState("");
  const [showHidden, setShowHidden] = useState(false);

  const filtered = mockCustomers
    .filter((c) => showHidden || !c.hidden)
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.address.toLowerCase().includes(search.toLowerCase()));

  const currentYear = filtered.filter((c) => c.status !== "next_year");
  const nextYear = filtered.filter((c) => c.status === "next_year");

  // Possible jobs
  const scheduledClients = currentYear.filter((c) => c.status === "scheduled");
  const pendingClients = currentYear.filter((c) => c.status === "pending");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Clients</h1>
        <p className="text-muted-foreground">Gérez votre liste de clients</p>
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
            <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-muted-foreground">{c.address}</p>
                <p className="text-xs text-muted-foreground">{c.phone} · {c.email}</p>
                {/* Job history count */}
                <p className="text-xs text-muted-foreground mt-1">
                  {jobs.filter((j) => j.clientId === c.id).length} job(s)
                </p>
              </div>
              <Badge className={statusColor[c.status]}>{c.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Possible Jobs */}
      {(scheduledClients.length > 0 || pendingClients.length > 0) && (
        <Card>
          <CardHeader><CardTitle>Jobs possibles</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {scheduledClients.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Planifiés</p>
                {scheduledClients.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-2 rounded border mb-1">
                    <span className="text-sm font-medium">{c.name}</span>
                    <Badge className={statusColor.scheduled}>scheduled</Badge>
                  </div>
                ))}
              </div>
            )}
            {pendingClients.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">En attente</p>
                {pendingClients.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-2 rounded border mb-1">
                    <span className="text-sm font-medium">{c.name}</span>
                    <Badge className={statusColor.pending}>pending</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Next Year */}
      {nextYear.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Année prochaine ({nextYear.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {nextYear.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border">
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
    </div>
  );
};

export default Clients;
