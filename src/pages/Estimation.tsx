import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { customers, estimations, parameters } from "@/data/mock";
import { Calculator, Plus, Trash2 } from "lucide-react";
import type { CutType, HeightMode, EstimationExtra } from "@/types";

const EstimationPage = () => {
  const [clientId, setClientId] = useState("");
  const [cutType, setCutType] = useState<CutType>("trim");
  const [facadeLength, setFacadeLength] = useState(0);
  const [leftLength, setLeftLength] = useState(0);
  const [rightLength, setRightLength] = useState(0);
  const [backLength, setBackLength] = useState(0);
  const [heightMode, setHeightMode] = useState<HeightMode>("global");
  const [heightGlobal, setHeightGlobal] = useState(4);
  const [heightFacade, setHeightFacade] = useState(0);
  const [heightLeft, setHeightLeft] = useState(0);
  const [heightRight, setHeightRight] = useState(0);
  const [heightBack, setHeightBack] = useState(0);
  const [width, setWidth] = useState(2);
  const [extras, setExtras] = useState<EstimationExtra[]>([]);
  const [bushes, setBushes] = useState(0);

  const p = parameters;

  // Price calculation
  const totalLinearFeet = facadeLength + leftLength + rightLength + backLength;
  const pricePerFoot = cutType === "trim" ? p.pricePerFootTrim : p.pricePerFootLevelling;
  let basePrice = totalLinearFeet * pricePerFoot;

  // Height multiplier
  const effectiveHeight = heightMode === "global" ? heightGlobal : Math.max(heightFacade, heightLeft, heightRight, heightBack);
  if (effectiveHeight >= p.heightMultiplierThreshold) {
    basePrice *= p.heightMultiplier;
  }

  // Width multiplier
  if (width >= p.widthMultiplierThreshold) {
    basePrice *= p.widthMultiplier;
  }

  const bushesPrice = bushes * p.bushPrice;
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Estimation</h1>
        <p className="text-muted-foreground">Créer une estimation et générer automatiquement un job et une facture</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle>Nouvelle estimation</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Client */}
              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                  <SelectContent>
                    {customers.filter((c) => !c.hidden).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

              {/* Measurements */}
              <div className="space-y-2">
                <Label>Mesures (pieds linéaires)</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs text-muted-foreground">Façade</Label><Input type="number" min={0} value={facadeLength} onChange={(e) => setFacadeLength(Number(e.target.value))} /></div>
                  <div><Label className="text-xs text-muted-foreground">Gauche</Label><Input type="number" min={0} value={leftLength} onChange={(e) => setLeftLength(Number(e.target.value))} /></div>
                  <div><Label className="text-xs text-muted-foreground">Droite</Label><Input type="number" min={0} value={rightLength} onChange={(e) => setRightLength(Number(e.target.value))} /></div>
                  <div><Label className="text-xs text-muted-foreground">Arrière</Label><Input type="number" min={0} value={backLength} onChange={(e) => setBackLength(Number(e.target.value))} /></div>
                </div>
              </div>

              {/* Height */}
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
                  <Input type="number" min={0} value={heightGlobal} onChange={(e) => setHeightGlobal(Number(e.target.value))} />
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs text-muted-foreground">Façade</Label><Input type="number" min={0} value={heightFacade} onChange={(e) => setHeightFacade(Number(e.target.value))} /></div>
                    <div><Label className="text-xs text-muted-foreground">Gauche</Label><Input type="number" min={0} value={heightLeft} onChange={(e) => setHeightLeft(Number(e.target.value))} /></div>
                    <div><Label className="text-xs text-muted-foreground">Droite</Label><Input type="number" min={0} value={heightRight} onChange={(e) => setHeightRight(Number(e.target.value))} /></div>
                    <div><Label className="text-xs text-muted-foreground">Arrière</Label><Input type="number" min={0} value={heightBack} onChange={(e) => setHeightBack(Number(e.target.value))} /></div>
                  </div>
                )}
              </div>

              {/* Width */}
              <div className="space-y-2">
                <Label>Largeur (pieds)</Label>
                <Input type="number" min={0} value={width} onChange={(e) => setWidth(Number(e.target.value))} />
              </div>

              {/* Bushes */}
              <div className="space-y-2">
                <Label>Bushes</Label>
                <Input type="number" min={0} value={bushes} onChange={(e) => setBushes(Number(e.target.value))} />
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
                    <Input type="number" min={0} placeholder="Prix" value={extra.price || ""} onChange={(e) => updateExtra(extra.id, "price", Number(e.target.value))} className="w-24" />
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
              {bushes > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Bushes ({bushes} × ${p.bushPrice})</span>
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
              {width >= p.widthMultiplierThreshold && (
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

          {/* History */}
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
    </div>
  );
};

export default EstimationPage;
