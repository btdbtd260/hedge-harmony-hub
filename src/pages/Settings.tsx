import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parameters as defaultParams } from "@/data/mock";
import { Settings as SettingsIcon, Calculator, FileText, Bell, DollarSign } from "lucide-react";

const Settings = () => {
  const [params] = useState(defaultParams);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Paramètres</h1>
        <p className="text-muted-foreground">Configuration centrale du système</p>
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
                  <Input type="number" value={params.pricePerFootTrim} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>Prix par pied (Levelling)</Label>
                  <Input type="number" value={params.pricePerFootLevelling} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>Prix par bush</Label>
                  <Input type="number" value={params.bushPrice} readOnly />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-medium mb-3">Multiplicateur hauteur</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Seuil (pieds)</Label>
                    <Input type="number" value={params.heightMultiplierThreshold} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label>Multiplicateur</Label>
                    <Input type="number" value={params.heightMultiplier} readOnly />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-medium mb-3">Multiplicateur largeur</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Seuil (pieds)</Label>
                    <Input type="number" value={params.widthMultiplierThreshold} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label>Multiplicateur</Label>
                    <Input type="number" value={params.widthMultiplier} readOnly />
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
                  <Input value={params.companyName} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>Adresse</Label>
                  <Input value={params.companyAddress} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input value={params.companyPhone} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={params.companyEmail} readOnly />
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
                  <Input type="number" value={params.maintenanceIntervalDays} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>Heure notification</Label>
                  <Input value={params.reminderNotificationTime} readOnly />
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
                <Input type="number" value={params.splitRuleProfitExpense} readOnly />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
