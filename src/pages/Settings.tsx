import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useParameters, useUpdateParameters } from "@/hooks/useSupabaseData";
import { Calculator, FileText, Bell, Save, Upload } from "lucide-react";
import { toast } from "sonner";

const Settings = () => {
  const { data: dbParams, isLoading } = useParameters();
  const updateParams = useUpdateParameters();

  const [form, setForm] = useState<Record<string, any>>({});
  const [estimationPdf, setEstimationPdf] = useState<string | null>(null);
  const [invoicePdf, setInvoicePdf] = useState<string | null>(null);

  useEffect(() => {
    if (dbParams) setForm({ ...dbParams });
  }, [dbParams]);

  const updateField = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const numValue = (key: string) => {
    const v = form[key];
    if (v === undefined || v === null) return "";
    return String(v);
  };

  const handleNumChange = (key: string, val: string) => {
    if (val === "") updateField(key, null);
    else updateField(key, Number(val));
  };

  const handleSave = async () => {
    if (!form.id) return;
    try {
      const { id, ...rest } = form;
      await updateParams.mutateAsync({ id, ...rest });
      toast.success("Paramètres sauvegardés");
    } catch (e: any) { toast.error(e.message); }
  };

  const handlePdfUpload = (type: "estimation" | "invoice", file: File) => {
    if (file.type !== "application/pdf") { toast.error("Veuillez téléverser un fichier PDF"); return; }
    const url = URL.createObjectURL(file);
    if (type === "estimation") setEstimationPdf(url); else setInvoicePdf(url);
    toast.success(`Template ${type === "estimation" ? "estimation" : "facture"} téléversé`);
  };

  if (isLoading) return <p className="p-6 text-muted-foreground">Chargement…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Paramètres</h1>
          <p className="text-muted-foreground">Configuration centrale du système</p>
        </div>
        <Button onClick={handleSave} disabled={updateParams.isPending}><Save className="h-4 w-4 mr-1" /> Sauvegarder</Button>
      </div>

      <Tabs defaultValue="estimation">
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          <TabsTrigger value="estimation"><Calculator className="h-4 w-4 mr-1" /> Estimation</TabsTrigger>
          <TabsTrigger value="template"><FileText className="h-4 w-4 mr-1" /> Template</TabsTrigger>
          <TabsTrigger value="reminder"><Bell className="h-4 w-4 mr-1" /> Rappels</TabsTrigger>
        </TabsList>

        <TabsContent value="estimation" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle>Prix et multiplicateurs</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Prix par pied (Trim)</Label><Input type="number" step="0.5" placeholder="0" value={numValue("price_per_foot_trim")} onChange={(e) => handleNumChange("price_per_foot_trim", e.target.value)} /></div>
                <div className="space-y-2"><Label>Prix par pied (Levelling)</Label><Input type="number" step="0.5" placeholder="0" value={numValue("price_per_foot_levelling")} onChange={(e) => handleNumChange("price_per_foot_levelling", e.target.value)} /></div>
                <div className="space-y-2"><Label>Prix par bush</Label><Input type="number" placeholder="0" value={numValue("bush_price")} onChange={(e) => handleNumChange("bush_price", e.target.value)} /></div>
              </div>
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium mb-3">Hauteur</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Seuil (pieds)</Label><Input type="number" placeholder="0" value={numValue("height_multiplier_threshold")} onChange={(e) => handleNumChange("height_multiplier_threshold", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Multiplicateur</Label><Input type="number" step="0.1" placeholder="0" value={numValue("height_multiplier")} onChange={(e) => handleNumChange("height_multiplier", e.target.value)} /></div>
                </div>
              </div>
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium mb-3">Largeur</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Seuil (pieds)</Label><Input type="number" placeholder="0" value={numValue("width_multiplier_threshold")} onChange={(e) => handleNumChange("width_multiplier_threshold", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Multiplicateur</Label><Input type="number" step="0.1" placeholder="0" value={numValue("width_multiplier")} onChange={(e) => handleNumChange("width_multiplier", e.target.value)} /></div>
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
                <div className="space-y-2"><Label>Nom</Label><Input value={form.company_name ?? ""} onChange={(e) => updateField("company_name", e.target.value)} /></div>
                <div className="space-y-2"><Label>Adresse</Label><Input value={form.company_address ?? ""} onChange={(e) => updateField("company_address", e.target.value)} /></div>
                <div className="space-y-2"><Label>Téléphone</Label><Input value={form.company_phone ?? ""} onChange={(e) => updateField("company_phone", e.target.value)} /></div>
                <div className="space-y-2"><Label>Email</Label><Input value={form.company_email ?? ""} onChange={(e) => updateField("company_email", e.target.value)} /></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Templates PDF</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Template Estimation (PDF)</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                  {estimationPdf ? (
                    <div className="space-y-2"><p className="text-sm text-foreground font-medium">✓ Template estimation téléversé</p><Button variant="outline" size="sm" onClick={() => setEstimationPdf(null)}>Remplacer</Button></div>
                  ) : (
                    <label className="cursor-pointer space-y-2 block"><Upload className="h-8 w-8 mx-auto text-muted-foreground" /><p className="text-sm text-muted-foreground">Glissez ou cliquez pour téléverser le PDF estimation</p><input type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handlePdfUpload("estimation", e.target.files[0])} /></label>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Template Facture (PDF)</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                  {invoicePdf ? (
                    <div className="space-y-2"><p className="text-sm text-foreground font-medium">✓ Template facture téléversé</p><Button variant="outline" size="sm" onClick={() => setInvoicePdf(null)}>Remplacer</Button></div>
                  ) : (
                    <label className="cursor-pointer space-y-2 block"><Upload className="h-8 w-8 mx-auto text-muted-foreground" /><p className="text-sm text-muted-foreground">Glissez ou cliquez pour téléverser le PDF facture</p><input type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handlePdfUpload("invoice", e.target.files[0])} /></label>
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
                <div className="space-y-2"><Label>Intervalle maintenance (jours)</Label><Input type="number" value={form.maintenance_interval_days ?? ""} onChange={(e) => updateField("maintenance_interval_days", Number(e.target.value))} /></div>
                <div className="space-y-2"><Label>Heure notification</Label><Input value={form.reminder_notification_time ?? ""} onChange={(e) => updateField("reminder_notification_time", e.target.value)} /></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
