import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCustomers, useEstimations, useParameters, useInsertCustomer, useInsertEstimation, useInsertJob, useInsertInvoice } from "@/hooks/useSupabaseData";
import { Calculator, Plus, Trash2, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { CutType, HeightMode, EstimationExtra } from "@/types";

interface BushItem {
  id: string;
  description: string;
  count: number;
  price: number;
}

const EstimationPage = () => {
  const { data: customers = [] } = useCustomers();
  const { data: estimations = [] } = useEstimations();
  const { data: params } = useParameters();
  const insertCustomer = useInsertCustomer();
  const insertEstimation = useInsertEstimation();
  const insertJob = useInsertJob();
  const insertInvoice = useInsertInvoice();

  const [clientId, setClientId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");

  const [cutType, setCutType] = useState<CutType>("trim");
  const [facadeLength, setFacadeLength] = useState("");
  const [leftLength, setLeftLength] = useState("");
  const [rightLength, setRightLength] = useState("");
  const [backLength, setBackLength] = useState("");
  const [heightMode, setHeightMode] = useState<HeightMode>("global");
  const [heightGlobal, setHeightGlobal] = useState("");
  const [heightFacade, setHeightFacade] = useState("");
  const [heightLeft, setHeightLeft] = useState("");
  const [heightRight, setHeightRight] = useState("");
  const [heightBack, setHeightBack] = useState("");
  const [width, setWidth] = useState("");
  const [extras, setExtras] = useState<EstimationExtra[]>([]);
  const [bushItems, setBushItems] = useState<BushItem[]>([]);

  const p = params ?? { price_per_foot_trim: 4.5, price_per_foot_levelling: 6, bush_price: 40, height_multiplier_threshold: 5, height_multiplier: 1.5, width_multiplier_threshold: 3, width_multiplier: 1.3 };

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

  const totalLinearFeet = numFacade + numLeft + numRight + numBack;
  const pricePerFoot = cutType === "trim" ? p.price_per_foot_trim : p.price_per_foot_levelling;
  let basePrice = totalLinearFeet * pricePerFoot;

  const effectiveHeight = heightMode === "global" ? numHeightGlobal : Math.max(numHeightFacade, numHeightLeft, numHeightRight, numHeightBack);
  if (effectiveHeight >= p.height_multiplier_threshold) basePrice *= p.height_multiplier;
  if (numWidth >= p.width_multiplier_threshold) basePrice *= p.width_multiplier;

  const bushesTotal = bushItems.reduce((sum, b) => sum + b.count * b.price, 0);
  const totalBushesCount = bushItems.reduce((sum, b) => sum + b.count, 0);
  const extrasPrice = extras.reduce((sum, e) => sum + e.price, 0);
  const totalPrice = basePrice + bushesTotal + extrasPrice;

  const addExtra = () => setExtras([...extras, { id: `ext-${Date.now()}`, description: "", price: 0 }]);
  const removeExtra = (id: string) => setExtras(extras.filter((e) => e.id !== id));
  const updateExtra = (id: string, field: "description" | "price", value: string | number) => setExtras(extras.map((e) => e.id === id ? { ...e, [field]: value } : e));

  const addBush = () => setBushItems([...bushItems, { id: `bush-${Date.now()}`, description: "", count: 1, price: p.bush_price }]);
  const removeBush = (id: string) => setBushItems(bushItems.filter((b) => b.id !== id));
  const updateBush = (id: string, field: keyof BushItem, value: string | number) => setBushItems(bushItems.map((b) => b.id === id ? { ...b, [field]: value } : b));

  const filteredClients = customers.filter((c) => !c.hidden).filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()));
  const selectedClient = customers.find((c) => c.id === clientId);

  const handleSelectClient = (id: string) => { setClientId(id); setClientSearch(""); setShowClientDropdown(false); };

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;
    try {
      const data = await insertCustomer.mutateAsync({ name: newClientName.trim(), phone: newClientPhone.trim(), email: newClientEmail.trim(), address: newClientAddress.trim() });
      setClientId(data.id);
      setShowNewClientDialog(false); setNewClientName(""); setNewClientPhone(""); setNewClientEmail(""); setNewClientAddress("");
      toast.success("Client créé");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleCreateEstimation = async () => {
    if (!clientId) return;
    try {
      const estimation = await insertEstimation.mutateAsync({
        client_id: clientId,
        cut_type: cutType,
        facade_length: numFacade,
        left_length: numLeft,
        right_length: numRight,
        back_length: numBack,
        height_mode: heightMode,
        height_global: numHeightGlobal,
        height_facade: numHeightFacade,
        height_left: numHeightLeft,
        height_right: numHeightRight,
        height_back: numHeightBack,
        width: numWidth,
        extras: JSON.parse(JSON.stringify([...extras, ...bushItems.map((b) => ({ id: b.id, description: `Bush: ${b.description || "Bush"}`, price: b.count * b.price }))])),
        bushes_count: totalBushesCount,
        total_price: totalPrice,
      });

      const job = await insertJob.mutateAsync({
        client_id: clientId,
        estimation_id: estimation.id,
        cut_type: cutType,
        status: "pending",
        estimated_profit: totalPrice,
        measurement_snapshot: {
          facade_length: numFacade, left_length: numLeft, right_length: numRight, back_length: numBack,
          height_mode: heightMode, height_global: numHeightGlobal, height_facade: numHeightFacade,
          height_left: numHeightLeft, height_right: numHeightRight, height_back: numHeightBack, width: numWidth,
        },
      });

      await insertInvoice.mutateAsync({ client_id: clientId, job_id: job.id, amount: totalPrice, status: "unpaid" });

      toast.success("Estimation créée → Job + Facture générés automatiquement");
      setClientId(""); setFacadeLength(""); setLeftLength(""); setRightLength(""); setBackLength("");
      setHeightGlobal(""); setHeightFacade(""); setHeightLeft(""); setHeightRight(""); setHeightBack("");
      setWidth(""); setBushItems([]); setExtras([]);
    } catch (e: any) { toast.error(e.message); }
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
                  <div className="flex items-center border rounded-md px-3 py-2 cursor-pointer bg-background" onClick={() => setShowClientDropdown(!showClientDropdown)}>
                    <span className={selectedClient ? "text-foreground" : "text-muted-foreground"}>{selectedClient ? selectedClient.name : "Sélectionner un client"}</span>
                  </div>
                  {showClientDropdown && (
                    <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-64 overflow-auto">
                      <div className="p-2 border-b sticky top-0 bg-popover">
                        <div className="relative"><Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Rechercher un client…" className="pl-8 h-8" value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} autoFocus onClick={(e) => e.stopPropagation()} /></div>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent text-primary font-medium border-b" onClick={() => { setShowClientDropdown(false); setShowNewClientDialog(true); }}>
                        <UserPlus className="h-4 w-4" /> Nouveau client
                      </div>
                      {filteredClients.length === 0 ? <p className="text-sm text-muted-foreground p-3">Aucun client trouvé.</p> : filteredClients.map((c) => (
                        <div key={c.id} className={`px-3 py-2 cursor-pointer hover:bg-accent text-sm ${c.id === clientId ? "bg-accent font-medium" : ""}`} onClick={() => handleSelectClient(c.id)}>
                          {c.name}<span className="text-xs text-muted-foreground ml-2">{c.address}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Type de coupe</Label>
                <Select value={cutType} onValueChange={(v) => setCutType(v as CutType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="trim">Trim</SelectItem><SelectItem value="levelling">Levelling</SelectItem></SelectContent></Select>
              </div>

              <div className="space-y-2">
                <Label>Mesures (pieds linéaires)</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs text-muted-foreground">Façade</Label><Input type="number" min={0} placeholder="0" value={facadeLength} onChange={(e) => setFacadeLength(e.target.value)} /></div>
                  <div><Label className="text-xs text-muted-foreground">Gauche</Label><Input type="number" min={0} placeholder="0" value={leftLength} onChange={(e) => setLeftLength(e.target.value)} /></div>
                  <div><Label className="text-xs text-muted-foreground">Droite</Label><Input type="number" min={0} placeholder="0" value={rightLength} onChange={(e) => setRightLength(e.target.value)} /></div>
                  <div><Label className="text-xs text-muted-foreground">Arrière</Label><Input type="number" min={0} placeholder="0" value={backLength} onChange={(e) => setBackLength(e.target.value)} /></div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Hauteur</Label>
                <Select value={heightMode} onValueChange={(v) => setHeightMode(v as HeightMode)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="global">Globale</SelectItem><SelectItem value="per_side">Par côté</SelectItem></SelectContent></Select>
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

              <div className="space-y-2"><Label>Largeur (pieds)</Label><Input type="number" min={0} placeholder="2" value={width} onChange={(e) => setWidth(e.target.value)} /></div>

              {/* Bushes List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label>Bushes</Label><Button variant="outline" size="sm" onClick={addBush}><Plus className="h-3 w-3 mr-1" /> Ajouter</Button></div>
                {bushItems.map((bush) => (
                  <div key={bush.id} className="flex gap-2 items-center">
                    <Input placeholder="Description" value={bush.description} onChange={(e) => updateBush(bush.id, "description", e.target.value)} className="flex-1" />
                    <Input type="number" min={1} placeholder="Qté" value={bush.count || ""} onChange={(e) => updateBush(bush.id, "count", Number(e.target.value))} className="w-20" />
                    <Input type="number" min={0} placeholder="Prix" value={bush.price || ""} onChange={(e) => updateBush(bush.id, "price", Number(e.target.value))} className="w-24" />
                    <Button variant="ghost" size="icon" onClick={() => removeBush(bush.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>

              {/* Extras */}
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label>Extras</Label><Button variant="outline" size="sm" onClick={addExtra}><Plus className="h-3 w-3 mr-1" /> Ajouter</Button></div>
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

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" /> Résumé</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Pieds linéaires</span><span>{totalLinearFeet} pi</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Prix/pied ({cutType})</span><span>${pricePerFoot}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Base</span><span>${basePrice.toFixed(2)}</span></div>
              {bushesTotal > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Bushes ({totalBushesCount})</span><span>${bushesTotal.toFixed(2)}</span></div>}
              {extrasPrice > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Extras</span><span>${extrasPrice}</span></div>}
              {effectiveHeight >= p.height_multiplier_threshold && <div className="flex justify-between text-sm text-amber-600"><span>Mult. hauteur (×{p.height_multiplier})</span><span>Appliqué</span></div>}
              {numWidth >= p.width_multiplier_threshold && <div className="flex justify-between text-sm text-amber-600"><span>Mult. largeur (×{p.width_multiplier})</span><span>Appliqué</span></div>}
              <div className="border-t pt-3 flex justify-between font-bold text-lg"><span>Total</span><span>${totalPrice.toFixed(2)}</span></div>
              <Button className="w-full" disabled={!clientId || insertEstimation.isPending} onClick={handleCreateEstimation}>
                {insertEstimation.isPending ? "Création…" : "Créer estimation"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Historique</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {estimations.length === 0 ? <p className="text-sm text-muted-foreground">Aucune estimation.</p> : estimations.map((est) => {
                const client = customers.find((c) => c.id === est.client_id);
                return (
                  <div key={est.id} className="p-2 rounded border text-sm">
                    <div className="flex justify-between"><span className="font-medium">{client?.name ?? "Inconnu"}</span><span className="font-semibold">${est.total_price}</span></div>
                    <p className="text-xs text-muted-foreground">{est.cut_type} · {est.created_at}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau client</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Nom *</Label><Input value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="Nom complet" /></div>
            <div className="space-y-1"><Label>Téléphone</Label><Input value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} placeholder="514-555-0000" /></div>
            <div className="space-y-1"><Label>Email</Label><Input value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} placeholder="email@exemple.com" /></div>
            <div className="space-y-1"><Label>Adresse</Label><Input value={newClientAddress} onChange={(e) => setNewClientAddress(e.target.value)} placeholder="123 Rue Exemple" /></div>
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
