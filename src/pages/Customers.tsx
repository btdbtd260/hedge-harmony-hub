import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { customers as mockCustomers } from "@/data/mock";
import { Search, Eye, EyeOff } from "lucide-react";

const statusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  scheduled: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  next_year: "bg-purple-100 text-purple-700",
};

const Customers = () => {
  const [search, setSearch] = useState("");
  const [showHidden, setShowHidden] = useState(false);

  const filtered = mockCustomers
    .filter((c) => showHidden || !c.hidden)
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.address.toLowerCase().includes(search.toLowerCase()));

  const currentYear = filtered.filter((c) => c.status !== "next_year");
  const nextYear = filtered.filter((c) => c.status === "next_year");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Customers</h1>
        <p className="text-muted-foreground">Manage your client list</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search customers…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowHidden(!showHidden)}>
          {showHidden ? <><EyeOff className="h-4 w-4 mr-1" /> Hide Hidden</> : <><Eye className="h-4 w-4 mr-1" /> Show Hidden</>}
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Current Clients ({currentYear.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {currentYear.length === 0 ? <p className="text-sm text-muted-foreground">No clients found.</p> : currentYear.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-muted-foreground">{c.address}</p>
                <p className="text-xs text-muted-foreground">{c.phone} · {c.email}</p>
              </div>
              <Badge className={statusColor[c.status]}>{c.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {nextYear.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Next Year ({nextYear.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {nextYear.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-muted-foreground">{c.address}</p>
                </div>
                <Badge className={statusColor[c.status]}>next year</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Customers;
