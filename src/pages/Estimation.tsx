import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { customers as mockCustomers, estimations, parameters } from "@/data/mock";
import { Calculator, Plus, Trash2, Search, UserPlus } from "lucide-react";
import type { CutType, HeightMode, EstimationExtra, Customer } from "@/types";

const EstimationPage = () => {
  const [customers, setCustomers] = useState<Customer[]>(mockCustomers);
  const [clientId, setClientId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");

  const [cutType, setCutType] = useState<CutType>("trim");
  const [facadeLength, setFacadeLength] = useState<string>("");
  const [leftLength, setLeftLength] = useState<string>("");
  const [rightLength, setRightLength] = useState<string>("");
  const [backLength, setBackLength] = useState<string>("");
  const [heightMode, setHeightMode] = useState<HeightMode>("global");
  const [heightGlobal, setHeightGlobal] = useState<string>("");
  const [heightFacade, setHeightFacade] = useState<string>("");
  const [heightLeft, setHeightLeft] = useState<string>("");
  const [heightRight, setHeightRight] = useState<string>("");
  const [heightBack, setHeightBack] = useState<string>("");
  const [width, setWidth] = useState<string>("");
  const [extras, setExtras] = useState<EstimationExtra[]>([]);
  const [bushes, setBushes] = useState<string>("");

  const p = parameters;

  // Parse values with defaults
  const numFacade = Number(facadeLength) || 0;
  const numLeft = Number(leftLength) || 0;
  const numRight = Number(rightLength) || 0;
  const numBack = Number(backLength) || 0;
  const numHeightGlobal = Number(heightGlobal) || 4;
  const numHeightFacade = Number(heightFacade) || 0;
  const numHeightLeft = Number(heightLeft) || 0;
  const numHeightRight = Number(heightRight) || 0;
  const numHeightBack = Number(heightBack) || 0;
  const numWidth = Number(width) || 2;
  const numBushes = Number(bushes) || 0;

  // Price calculation
  const totalLinearFeet = numFacade + numLeft + numRight + numBack;
  const pricePerFoot = cutType === "trim" ? p.pricePerFootTrim : p.pricePerFootLevelling;
  let basePrice = totalLinearFeet * pricePerFoot;

  const effectiveHeight = heightMode === "global" ? numHeightGlobal : Math.max(numHeightFacade, numHeightLeft, numHeightRight, numHeightBack);
  if (effectiveHeight >= p.heightMultiplierThreshold) {
    basePrice *= p.heightMultiplier;
  }
  if (numWidth >= p.widthMultiplierThreshold) {
    basePrice *= p.widthMultiplier;
  }

  const bushesPrice = numBushes * p.bushPrice;
  const extrasPrice = extras.reduce((sum, e) => sum + e.price, 0);
  const totalPrice = basePrice + bushesPrice + extrasPrice;

  const addExtra = () => {
    setExtras([...extras, { id: `ext-${Date.now()}`, description: "", price: 0 }]);
  };
  const removeExtra = (id: string) => {
    setExtras(extras.filter((e) => e.id !== id));
  };
  const updateExtra = (id: string, field: "description" | "price", value: string | number) => {
    setExtras(extras.map((e) => e.id === id ? { ...e, [field]: value } : e));
  };

  // Client picker
  const filteredClients = customers
    .filter((c) => !c.hidden)
    .filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()));

  const selectedClient = customers.find((c) => c.id === clientId);

  const handleSelectClient = (id: string) => {
    setClientId(id);
    setClientSearch("");
    setShowClientDropdown(false);
  };

  const handleCreateClient = () => {
    if (!newClientName.trim()) return;
    const newClient: Customer = {
      id: `c-${Date.now()}`,
      name: newClientName.trim(),
      phone: newClientPhone.trim(),
      email: newClientEmail.trim(),
      address: newClientAddress.trim(),
      status: "pending",
      hidden: false,
      createdAt: new Date().toISOString().split("T")[0],
      activeYear: new Date().getFullYear(),
    };
    setCustomers([...customers, newClient]);
    setClientId(newClient.id);
    setShowNewClientDialog(false);
    setNewClientName("");
    setNewClientPhone("");
    setNewClientEmail("");
    setNewClientAddress("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Estimation</h1>
        <p className="text-muted-foreground">Créer une estimation et générer automatiquement un job et une facture</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle>Nouvelle estimation</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Client Picker */}
              <div className="space-y-2">
                <Label>Client</Label>
                <div className="relative">
                  <div
                    className="flex items-center border rounded-md px-3 py-2 cursor-pointer bg-background"
                    onClick={() => setShowClientDropdown(!showClientDropdown)}
                  >
                    <span className={selectedClient ? "text-foreground" : "text-muted-foreground"}>
                      {selectedClient ? selectedClient.name : "Sélectionner un client"}
                    </span>
                  </div>
                  {showClientDropdown && (
                    <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-64 overflow-auto">
                      {/* Search always first */}
                      <div className="p-2 border-b sticky top-0 bg-popover">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Rechercher un client…"
                            className="pl-8 h-8"
                            value={clientSearch}
                            onChange={(e) => setClientSearch(e.target.value)}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                      {/* New client always second */}
                      <div
                        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent text-primary font-medium border-b"
                        onClick={() => { setShowClientDropdown(false); setShowNewClientDialog(true); }}
                      >
                        <UserPlus className="h-4 w-4" /> Nouveau client
                      </div>
                      {/* Client list */}
                      {filteredClients.length === 0 ? (
                        <p className="text-sm text-muted-foreground p-3">Aucun client trouvé.</p>
                      ) : filteredClients.map((c) => (
                        <div
                          key={c.id}
                          className={`px-3 py-2 cursor-pointer hover:bg-accent text-sm ${c.id === clientId ? "bg-accent font-medium" : ""}`}
                          onClick={() => handleSelectClient(c.id)}
                        >
                          {c.name}
                          <span className="text-xs text-muted-foreground ml-2">{c.address}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Cut type */}
              <div className="space-y-2">
                <Label>Type de coupe</Label>
                <Select value={cutType} onValueChange={(v) => setCutType(v as CutType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trim">Trim</SelectItem>
                    <SelectItem value="levelling">Levelling</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Measurements with ghost placeholders */}
              <div className="space-y-2">
                <Label>Mesures (pieds linéaires)</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs text-muted-foreground">Façade</Label><Input type="number" min={0} placeholder="0" value={facadeLength} onChange={(e) => setFacadeLength(e.target.value)} /></div>
                  <div><Label className="text-xs text-muted-foreground">Gauche</Label><Input type="number" min={0} placeholder="0" value={leftLength} onChange={(e) => setLeftLength(e.target.value)} /></div>
                  <div><Label className="text-xs text-muted-foreground">Droite</Label><Input type="number" min={0} placeholder="0" value={rightLength} onChange={(e) => setRightLength(e.target.value)} /></div>
                  <div><Label className="text-xs text-muted-foreground">Arrière</Label><Input type="number" min={0} placeholder="0" value={backLength} onChange={(e) => setBackLength(e.target.value)} /></div>
                </div>
              </div>

              {/* Height with ghost placeholders */}
              <div className="space-y-2">
                <Label>Hauteur</Label>
                <Select value={heightMode} onValueChange={(v) => setHeightMode(v as HeightMode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Globale</SelectItem>
                    <SelectItem value="per_side">Par côté</SelectItem>
                  </SelectContent>
                </Select>
                {heightMode === "global" ? (
                  <Input type="number" min={0} placeholder="4" value={heightGlobal} onChange={(e) => setHeightGlobal(e.target.value)} />
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs text-muted-foreground">Façade</Label><Input type="number" min={0} placeholder="0" value={heightFacade} onChange={(e) => setHeightFacade(e.target.value)} /></div>
                    <div><Label className="text-xs text-muted-foreground">Gauche</Label><Input type="number" min={0} placeholder="0" value={heightLeft} onChange={(e) => setHeightLeft(e.target.value)} /></div>
                    <div><Label className="text-xs text-muted-foreground">Droite</Label><Input type="number" min={0} placeholder="0" value={heightRight} onChange={(e) => setHeightRight(e.target.value)} /></div>
                    <div><Label className="text-xs text-muted-foreground">Arrière</Label><Input type="number" min={0} placeholder="0" value={heightBack} onChange={(e) => setHeightBack(e.target.value)} /></div>
                  </div>
                )}
              </div>

              {/* Width */}
              <div className="space-y-2">
                <Label>Largeur (pieds)</Label>
                <Input type="number" min={0} placeholder="2" value={width} onChange={(e) => setWidth(e.target.value)} />
              </div>

              {/* Bushes */}
              <div className="space-y-2">
                <Label>Bushes</Label>
                <Input type="number" min={0} placeholder="0" value={bushes} onChange={(e) => setBushes(e.target.value)} />
              </div>

              {/* Extras */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Extras</Label>
                  <Button variant="outline" size="sm" onClick={addExtra}><Plus className="h-3 w-3 mr-1" /> Ajouter</Button>
                </div>
                {extras.map((extra) => (
                  <div key={extra.id} className="flex gap-2 items-center">
                    <Input placeholder="Description" value={extra.description} onChange={(e) => updateExtra(extra.id, "description", e.target.value)} className="flex-1" />
                    <Input type="number" min={0} placeholder="0" value={extra.price || ""} onChange={(e) => updateExtra(extra.id, "price", Number(e.target.value))} className="w-24" />
                    <Button variant="ghost" size="icon" onClick={() => removeExtra(extra.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" /> Résumé</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pieds linéaires</span>
                <span>{totalLinearFeet} pi</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Prix/pied ({cutType})</span>
                <span>${pricePerFoot}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Base</span>
                <span>${basePrice.toFixed(2)}</span>
              </div>
              {numBushes > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Bushes ({numBushes} × ${p.bushPrice})</span>
                  <span>${bushesPrice}</span>
                </div>
              )}
              {extrasPrice > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Extras</span>
                  <span>${extrasPrice}</span>
                </div>
              )}
              {effectiveHeight >= p.heightMultiplierThreshold && (
                <div className="flex justify-between text-sm text-amber-600">
                  <span>Mult. hauteur (×{p.heightMultiplier})</span>
                  <span>Appliqué</span>
                </div>
              )}
              {numWidth >= p.widthMultiplierThreshold && (
                <div className="flex justify-between text-sm text-amber-600">
                  <span>Mult. largeur (×{p.widthMultiplier})</span>
                  <span>Appliqué</span>
                </div>
              )}
              <div className="border-t pt-3 flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>${totalPrice.toFixed(2)}</span>
              </div>
              <Button className="w-full" disabled={!clientId}>
                Créer estimation
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Historique</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {estimations.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune estimation.</p>
              ) : estimations.map((est) => {
                const client = customers.find((c) => c.id === est.clientId);
                return (
                  <div key={est.id} className="p-2 rounded border text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">{client?.name ?? "Inconnu"}</span>
                      <span className="font-semibold">${est.totalPrice}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{est.cutType} · {est.createdAt}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* New Client Dialog */}
      <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau client</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nom *</Label>
              <Input value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="Nom complet" />
            </div>
            <div className="space-y-1">
              <Label>Téléphone</Label>
              <Input value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} placeholder="514-555-0000" />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} placeholder="email@exemple.com" />
            </div>
            <div className="space-y-1">
              <Label>Adresse</Label>
              <Input value={newClientAddress} onChange={(e) => setNewClientAddress(e.target.value)} placeholder="123 Rue Exemple" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewClientDialog(false)}>Annuler</Button>
            <Button onClick={handleCreateClient} disabled={!newClientName.trim()}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EstimationPage;
