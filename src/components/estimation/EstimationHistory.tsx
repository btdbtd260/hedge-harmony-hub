import { formatDateQC } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCustomers, useParameters, type DbEstimation, type DbCustomer } from "@/hooks/useSupabaseData";
import { FileText, Download, Mail } from "lucide-react";
import { toast } from "sonner";
import { downloadEstimationPdf, getEstimationNumber, type EstimationPdfData } from "@/lib/generateEstimationPdf";
import { useState } from "react";

interface Props {
  estimations: DbEstimation[];
  customers: DbCustomer[];
  params: ReturnType<typeof useParameters>["data"];
}

export default function EstimationHistory({ estimations, customers, params }: Props) {
  const [selected, setSelected] = useState<DbEstimation | null>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailEstimation, setEmailEstimation] = useState<{ est: DbEstimation; idx: number } | null>(null);

  const p = params ?? { price_per_foot_trim: 4.5, price_per_foot_levelling: 6, bush_price: 40, height_multiplier_threshold: 5, height_multiplier: 1.5, width_multiplier_threshold: 3, width_multiplier: 1.3 };

  const handleDownload = (est: DbEstimation, index: number) => {
    const client = customers.find(c => c.id === est.client_id) ?? null;
    const extras = Array.isArray(est.extras) ? (est.extras as any[]) : [];
    const bushExtras = extras.filter((e: any) => e.description?.startsWith("Bush:"));
    const otherExtras = extras.filter((e: any) => !e.description?.startsWith("Bush:"));

    const totalFeet = Number(est.facade_length) + Number(est.left_length) + Number(est.right_length) + Number(est.back_length);
    const pricePerFoot = est.cut_type === "trim" ? p.price_per_foot_trim : p.price_per_foot_levelling;
    let basePrice = totalFeet * pricePerFoot;
    const effH = est.height_mode === "global" ? Number(est.height_global) : Math.max(Number(est.height_facade), Number(est.height_left), Number(est.height_right), Number(est.height_back));
    const hApplied = effH >= p.height_multiplier_threshold;
    const wApplied = Number(est.width) >= p.width_multiplier_threshold;
    if (hApplied) basePrice *= p.height_multiplier;
    if (wApplied) basePrice *= p.width_multiplier;

    const data: EstimationPdfData = {
      customer: client,
      params: params ?? null,
      estimationNumber: getEstimationNumber(index, est.created_at),
      cutType: est.cut_type as "trim" | "levelling",
      facadeLength: Number(est.facade_length),
      leftLength: Number(est.left_length),
      rightLength: Number(est.right_length),
      backLength: Number(est.back_length),
      heightMode: est.height_mode as "global" | "per_side",
      heightGlobal: Number(est.height_global),
      heightFacade: Number(est.height_facade),
      heightLeft: Number(est.height_left),
      heightRight: Number(est.height_right),
      heightBack: Number(est.height_back),
      width: Number(est.width),
      basePrice,
      bushItems: bushExtras.map((e: any) => ({ description: e.description?.replace("Bush: ", "") || "", count: 1, price: Number(e.price) })),
      extras: otherExtras.map((e: any) => ({ id: e.id, description: e.description || "", price: Number(e.price) })),
      heightMultiplierApplied: hApplied,
      widthMultiplierApplied: wApplied,
      heightMultiplier: p.height_multiplier,
      widthMultiplier: p.width_multiplier,
      totalPrice: Number(est.total_price),
      date: formatDateQC(est.created_at),
    };
    downloadEstimationPdf(data);
    toast.success("PDF estimation téléchargé");
  };

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-sm">Historique</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {estimations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune estimation.</p>
          ) : (
            estimations.map((est, idx) => {
              const client = customers.find(c => c.id === est.client_id);
              return (
                <div
                  key={est.id}
                  className="p-2 rounded border text-sm cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => setSelected(est)}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{client?.name ?? "Inconnu"}</span>
                    <span className="font-semibold">${est.total_price}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{est.cut_type} · {formatDateQC(est.created_at)}</p>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleDownload(est, idx); }}>
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Détails de l'estimation</DialogTitle></DialogHeader>
          {selected && (() => {
            const client = customers.find(c => c.id === selected.client_id);
            const estIdx = estimations.findIndex(e => e.id === selected.id);
            const extras = Array.isArray(selected.extras) ? (selected.extras as any[]) : [];
            const totalFeet = Number(selected.facade_length) + Number(selected.left_length) + Number(selected.right_length) + Number(selected.back_length);
            return (
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-lg">{client?.name ?? "Inconnu"}</p>
                    {client?.address && <p className="text-sm text-muted-foreground">{client.address}</p>}
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">{getEstimationNumber(estIdx, selected.created_at)}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Type:</span> <span className="font-medium">{selected.cut_type === "levelling" ? "Nivelage" : "Taille"}</span></div>
                  <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{formatDateQC(selected.created_at)}</span></div>
                  <div><span className="text-muted-foreground">Pieds linéaires:</span> <span className="font-medium">{totalFeet} pi</span></div>
                  <div><span className="text-muted-foreground">Largeur:</span> <span className="font-medium">{selected.width} pi</span></div>
                </div>

                {selected.height_mode === "global" ? (
                  <p className="text-sm"><span className="text-muted-foreground">Hauteur globale:</span> <span className="font-medium">{selected.height_global} pi</span></p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>H. façade: {selected.height_facade} pi</div>
                    <div>H. gauche: {selected.height_left} pi</div>
                    <div>H. droite: {selected.height_right} pi</div>
                    <div>H. arrière: {selected.height_back} pi</div>
                  </div>
                )}

                {extras.length > 0 && (
                  <div className="text-sm">
                    <p className="text-muted-foreground font-medium mb-1">Extras / Bushes:</p>
                    {extras.map((e: any, i: number) => (
                      <div key={i} className="flex justify-between"><span>{e.description || "—"}</span><span className="font-medium">${Number(e.price).toFixed(2)}</span></div>
                    ))}
                  </div>
                )}

                <div className="border-t pt-3 flex justify-between items-center">
                  <span className="text-lg font-bold">Total</span>
                  <span className="text-2xl font-bold text-primary">${Number(selected.total_price).toFixed(2)}</span>
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => { handleDownload(selected, estIdx); }}>
                    <Download className="h-4 w-4 mr-2" /> Télécharger PDF
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
