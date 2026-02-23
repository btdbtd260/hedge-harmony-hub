import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parameters as defaultParams } from "@/data/mock";
import { Calculator, FileText, Bell, DollarSign, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import type { Parameters } from "@/types";

const Settings = () => {
  const [params, setParams] = useState<Parameters>({ ...defaultParams });
  const [estimationPdf, setEstimationPdf] = useState<string | null>(null);
  const [invoicePdf, setInvoicePdf] = useState<string | null>(null);

  const updateParam = <K extends keyof Parameters>(key: K, value: Parameters[K]) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    // In a real app this would persist to DB
    toast.success("Paramètres sauvegardés avec succès");
  };

  const handlePdfUpload = (type: "estimation" | "invoice", file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("Veuillez téléverser un fichier PDF");
      return;
    }
    const url = URL.createObjectURL(file);
    if (type === "estimation") setEstimationPdf(url);
    else setInvoicePdf(url);
    toast.success(`Template ${type === "estimation" ? "estimation" : "facture"} téléversé`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Paramètres</h1>
          <p className="text-muted-foreground">Configuration centrale du système</p>
        </div>
        <Button onClick={handleSave}><Save className="h-4 w-4 mr-1" /> Sauvegarder</Button>
      </div>

      <Tabs defaultValue="estimation">
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="estimation"><Calculator className="h-4 w-4 mr-1" /> Estimation</TabsTrigger>
          <TabsTrigger value="template"><FileText className="h-4 w-4 mr-1" /> Template</TabsTrigger>
          <TabsTrigger value="reminder"><Bell className="h-4 w-4 mr-1" /> Rappels</TabsTrigger>
          <TabsTrigger value="finance"><DollarSign className="h-4 w-4 mr-1" /> Finance</TabsTrigger>
        </TabsList>

        <TabsContent value="estimation" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle>Prix et multiplicateurs</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prix par pied (Trim)</Label>
                  <Input type="number" step="0.5" value={params.pricePerFootTrim} onChange={(e) => updateParam("pricePerFootTrim", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Prix par pied (Levelling)</Label>
                  <Input type="number" step="0.5" value={params.pricePerFootLevelling} onChange={(e) => updateParam("pricePerFootLevelling", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Prix par bush</Label>
                  <Input type="number" value={params.bushPrice} onChange={(e) => updateParam("bushPrice", Number(e.target.value))} />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-medium mb-3">Multiplicateur hauteur</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Seuil (pieds)</Label>
                    <Input type="number" value={params.heightMultiplierThreshold} onChange={(e) => updateParam("heightMultiplierThreshold", Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Multiplicateur</Label>
                    <Input type="number" step="0.1" value={params.heightMultiplier} onChange={(e) => updateParam("heightMultiplier", Number(e.target.value))} />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-medium mb-3">Multiplicateur largeur</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Seuil (pieds)</Label>
                    <Input type="number" value={params.widthMultiplierThreshold} onChange={(e) => updateParam("widthMultiplierThreshold", Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Multiplicateur</Label>
                    <Input type="number" step="0.1" value={params.widthMultiplier} onChange={(e) => updateParam("widthMultiplier", Number(e.target.value))} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="template" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle>Coordonnées entreprise</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input value={params.companyName} onChange={(e) => updateParam("companyName", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Adresse</Label>
                  <Input value={params.companyAddress} onChange={(e) => updateParam("companyAddress", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input value={params.companyPhone} onChange={(e) => updateParam("companyPhone", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={params.companyEmail} onChange={(e) => updateParam("companyEmail", e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Templates PDF</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Estimation PDF */}
              <div className="space-y-2">
                <Label>Template Estimation (PDF)</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                  {estimationPdf ? (
                    <div className="space-y-2">
                      <p className="text-sm text-foreground font-medium">✓ Template estimation téléversé</p>
                      <Button variant="outline" size="sm" onClick={() => setEstimationPdf(null)}>Remplacer</Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer space-y-2 block">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Glissez ou cliquez pour téléverser le PDF estimation</p>
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handlePdfUpload("estimation", e.target.files[0])}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Invoice PDF */}
              <div className="space-y-2">
                <Label>Template Facture (PDF)</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                  {invoicePdf ? (
                    <div className="space-y-2">
                      <p className="text-sm text-foreground font-medium">✓ Template facture téléversé</p>
                      <Button variant="outline" size="sm" onClick={() => setInvoicePdf(null)}>Remplacer</Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer space-y-2 block">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Glissez ou cliquez pour téléverser le PDF facture</p>
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handlePdfUpload("invoice", e.target.files[0])}
                      />
                    </label>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reminder" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle>Configuration rappels</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Intervalle maintenance (jours)</Label>
                  <Input type="number" value={params.maintenanceIntervalDays} onChange={(e) => updateParam("maintenanceIntervalDays", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Heure notification</Label>
                  <Input value={params.reminderNotificationTime} onChange={(e) => updateParam("reminderNotificationTime", e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finance" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle>Règles finance</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Règle split profit/dépense (%)</Label>
                <Input type="number" value={params.splitRuleProfitExpense} onChange={(e) => updateParam("splitRuleProfitExpense", Number(e.target.value))} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
