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
import { sendCustomerEmail } from "@/lib/sendCustomerEmail";
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

  const p = params ?? { price_per_foot_trim: 4.5, price_per_foot_levelling: 6, price_per_foot_restoration: 8, bush_price: 40, height_multiplier_threshold: 5, height_multiplier: 1.5, width_multiplier_threshold: 3, width_multiplier: 1.3 };

  const handleDownload = async (est: DbEstimation, index: number) => {
    const client = customers.find(c => c.id === est.client_id) ?? null;
    const extras = Array.isArray(est.extras) ? (est.extras as any[]) : [];
    const bushExtras = extras.filter((e: any) => e.description?.startsWith("Bush:"));
    const otherExtras = extras.filter((e: any) =>
      !e.description?.startsWith("Bush:") &&
      !e.description?.startsWith("__PRICE_META__") &&
      !e.description?.startsWith("__SIDES_META__") &&
      !e.description?.startsWith("__DISCOUNT_META__") &&
      !e.description?.startsWith("__CUT_META__"),
    );

    // Recover any per-estimation custom price stored in extras metadata
    const priceMeta = extras.find((e: any) => e.description?.startsWith("__PRICE_META__"));
    const customPriceFromMeta = priceMeta ? Number(String(priceMeta.description).split(":")[1]) || 0 : 0;

    // Recover per-side "2 côtés" flags (order: left, facade, right, backLeft, back, backRight)
    const sidesMeta = extras.find((e: any) => e.description?.startsWith("__SIDES_META__"));
    const sidesBits = sidesMeta ? String(sidesMeta.description).split(":")[1] || "" : "";
    const ts = {
      left:       sidesBits[0] === "1",
      facade:     sidesBits[1] === "1",
      right:      sidesBits[2] === "1",
      back_left:  sidesBits[3] === "1",
      back:       sidesBits[4] === "1",
      back_right: sidesBits[5] === "1",
    };
    const twoSidesMult = (p as any).two_sides_multiplier ?? 1.5;

    // Recover discounts from meta entries (format: __DISCOUNT_META__:type:value:description)
    const discounts = extras
      .filter((e: any) => e.description?.startsWith("__DISCOUNT_META__"))
      .map((e: any, i: number) => {
        const parts = String(e.description).split(":");
        const type = (parts[1] === "fixed" ? "fixed" : "percent") as "percent" | "fixed";
        const value = Number(parts[2]) || 0;
        const description = parts.slice(3).join(":") || "";
        return { id: `disc-${i}`, type, value, description };
      });

    const standardPrice =
      est.cut_type === "trim" ? p.price_per_foot_trim :
      est.cut_type === "levelling" ? p.price_per_foot_levelling :
      est.cut_type === "restoration" ? ((p as any).price_per_foot_restoration ?? 8) :
      p.price_per_foot_trim;
    const pricePerFoot = customPriceFromMeta > 0 ? customPriceFromMeta : standardPrice;
    const sideBase = (len: number, two: boolean) => Number(len) * pricePerFoot * (two ? twoSidesMult : 1);
    let basePrice =
      sideBase(Number(est.left_length), ts.left) +
      sideBase(Number(est.facade_length), ts.facade) +
      sideBase(Number(est.right_length), ts.right) +
      sideBase(Number((est as any).back_left_length || 0), ts.back_left) +
      sideBase(Number(est.back_length), ts.back) +
      sideBase(Number((est as any).back_right_length || 0), ts.back_right);
    const effH = est.height_mode === "global" ? Number(est.height_global) : Math.max(Number(est.height_facade), Number(est.height_left), Number(est.height_right), Number(est.height_back));
    const hApplied = effH >= p.height_multiplier_threshold;
    const wApplied = Number(est.width) >= p.width_multiplier_threshold;
    if (hApplied) basePrice *= p.height_multiplier;
    if (wApplied) basePrice *= p.width_multiplier;

    const data: EstimationPdfData = {
      customer: client,
      params: params ?? null,
      estimationNumber: getEstimationNumber(index, est.created_at),
      cutType: (est.cut_type === "levelling" || est.cut_type === "restoration" || est.cut_type === "trim" ? est.cut_type : "trim") as "trim" | "levelling" | "restoration",
      customPricePerFoot: customPriceFromMeta > 0 ? customPriceFromMeta : undefined,
      facadeLength: Number(est.facade_length),
      leftLength: Number(est.left_length),
      rightLength: Number(est.right_length),
      backLength: Number(est.back_length),
      backLeftLength: Number((est as any).back_left_length || 0),
      backRightLength: Number((est as any).back_right_length || 0),
      heightMode: est.height_mode as "global" | "per_side",
      heightGlobal: Number(est.height_global),
      heightFacade: Number(est.height_facade),
      heightLeft: Number(est.height_left),
      heightRight: Number(est.height_right),
      heightBack: Number(est.height_back),
      heightBackLeft: Number((est as any).height_back_left || 0),
      heightBackRight: Number((est as any).height_back_right || 0),
      width: Number(est.width),
      basePrice,
      bushItems: bushExtras.map((e: any) => ({ description: e.description?.replace("Bush: ", "") || "", count: 1, price: Number(e.price) })),
      extras: otherExtras.map((e: any) => ({ id: e.id, description: e.description || "", price: Number(e.price) })),
      discounts,
      heightMultiplierApplied: hApplied,
      widthMultiplierApplied: wApplied,
      heightMultiplier: p.height_multiplier,
      widthMultiplier: p.width_multiplier,
      totalPrice: Number(est.total_price),
      date: formatDateQC(est.created_at),
      twoSides: ts,
      twoSidesMultiplier: twoSidesMult,
    };
    await downloadEstimationPdf(data);
    toast.success("PDF estimation téléchargé");
  };

  const handleOpenEmail = (est: DbEstimation, idx: number) => {
    const client = customers.find(c => c.id === est.client_id) ?? null;
    setEmailEstimation({ est, idx });
    setEmailTo(client?.email || "");
    setEmailMessage(`Bonjour${client ? ` ${client.name}` : ""},\n\nVeuillez trouver ci-joint notre estimation pour les travaux de coupe de haies.\n\nTotal estimé : ${Number(est.total_price).toFixed(2)} $\n\nN'hésitez pas à nous contacter pour toute question.\n\nCordialement,`);
    setShowEmailDialog(true);
  };

  const handleSendEmail = async () => {
    if (!emailTo.trim() || !emailEstimation) { toast.error("Veuillez entrer une adresse email"); return; }
    const est = emailEstimation.est;
    const clientName = customers.find(c => c.id === est.client_id)?.name || "Client";
    try {
      await sendCustomerEmail({
        templateName: "estimation-to-client",
        recipientEmail: emailTo.trim(),
        idempotencyKey: `estimation-${est.id}-${emailTo.trim().toLowerCase()}`,
        templateData: {
          clientName,
          totalPrice: Number(est.total_price).toFixed(2),
          message: emailMessage,
        },
      });
      toast.success(`Email envoyé à ${emailTo}`);
      setShowEmailDialog(false);
    } catch (e: any) {
      toast.error(`Échec de l'envoi : ${e?.message ?? "erreur inconnue"}`);
    }
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
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleOpenEmail(est, idx); }}>
                        <Mail className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleDownload(est, idx); }}>
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
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
                  <div><span className="text-muted-foreground">Type:</span> <span className="font-medium">{selected.cut_type === "levelling" ? "Nivelage" : selected.cut_type === "restoration" ? "Restauration" : "Taillage"}</span></div>
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
                  <Button variant="outline" className="flex-1" onClick={() => { setSelected(null); handleOpenEmail(selected, estIdx); }}>
                    <Mail className="h-4 w-4 mr-2" /> Envoyer par email
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Envoyer l'estimation par email</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Destinataire *</Label>
              <Input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="email@exemple.com" />
            </div>
            <div className="space-y-1">
              <Label>Message</Label>
              <Textarea value={emailMessage} onChange={(e) => setEmailMessage(e.target.value)} rows={6} />
            </div>
            <p className="text-xs text-muted-foreground">L'email s'ouvrira dans votre application de messagerie. Pensez à joindre le PDF téléchargé.</p>
          </div>
          <DialogFooter>
            {emailEstimation && (
              <Button variant="outline" onClick={() => { handleDownload(emailEstimation.est, emailEstimation.idx); }}>
                <Download className="h-4 w-4 mr-2" /> Télécharger PDF
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>Annuler</Button>
            <Button onClick={handleSendEmail} disabled={!emailTo.trim()}>
              <Mail className="h-4 w-4 mr-2" /> Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
