import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { DbCustomer, DbParameters } from "@/hooks/useSupabaseData";
import type { EstimationExtra } from "@/types";
import { getEstimationNumber } from "@/lib/generateEstimationPdf";
import { formatDateQC } from "@/lib/utils";

interface BushItem {
  description: string;
  count: number;
  price: number;
}

interface Props {
  customer: DbCustomer | null;
  params: DbParameters | null;
  cutType: "trim" | "levelling";
  facadeLength: number;
  leftLength: number;
  rightLength: number;
  backLength: number;
  backLeftLength: number;
  backRightLength: number;
  heightMode: "global" | "per_side";
  heightGlobal: number;
  heightFacade: number;
  heightLeft: number;
  heightRight: number;
  heightBack: number;
  width: number;
  basePrice: number;
  bushItems: BushItem[];
  extras: EstimationExtra[];
  heightMultiplierApplied: boolean;
  widthMultiplierApplied: boolean;
  heightMultiplier: number;
  widthMultiplier: number;
  bushesTotal: number;
  extrasPrice: number;
  totalPrice: number;
  estimationCount: number;
}

export default function EstimationPreview({
  customer, params, cutType, facadeLength, leftLength, rightLength, backLength,
  heightMode, heightGlobal, heightFacade, heightLeft, heightRight, heightBack,
  width, basePrice, bushItems, extras, heightMultiplierApplied, widthMultiplierApplied,
  heightMultiplier, widthMultiplier, bushesTotal, extrasPrice, totalPrice, estimationCount,
}: Props) {
  const totalFeet = facadeLength + leftLength + rightLength + backLength;
  const pricePerFoot = cutType === "trim" ? (params?.price_per_foot_trim ?? 4.5) : (params?.price_per_foot_levelling ?? 6);
  const cutLabel = cutType === "levelling" ? "Nivelage" : "Taille";
  const estNumber = getEstimationNumber(estimationCount, new Date().toISOString());

  return (
    <Card className="border-2 border-dashed border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Aperçu de l'estimation</CardTitle>
          <Badge variant="outline" className="font-mono text-xs">{estNumber}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {/* Company */}
        <div>
          <p className="font-bold text-base">{params?.company_name || "HedgePro"}</p>
          {params?.company_address && <p className="text-xs text-muted-foreground">{params.company_address}</p>}
          {params?.company_phone && <p className="text-xs text-muted-foreground">Tél: {params.company_phone}</p>}
        </div>

        <Separator />

        {/* Client */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Client</p>
          {customer ? (
            <>
              <p className="font-semibold">{customer.name}</p>
              {customer.address && <p className="text-xs text-muted-foreground">{customer.address}</p>}
            </>
          ) : (
            <p className="text-muted-foreground italic">Aucun client sélectionné</p>
          )}
        </div>

        <Separator />

        {/* Measurements */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Mesures</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span>Façade</span><span className="text-right font-medium">{facadeLength} pi</span>
            <span>Gauche</span><span className="text-right font-medium">{leftLength} pi</span>
            <span>Droite</span><span className="text-right font-medium">{rightLength} pi</span>
            <span>Arrière</span><span className="text-right font-medium">{backLength} pi</span>
          </div>
          <div className="flex justify-between mt-1 font-medium">
            <span>Total</span><span>{totalFeet} pi</span>
          </div>
        </div>

        <Separator />

        {/* Pricing */}
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>{cutLabel} ({totalFeet} × ${pricePerFoot})</span>
            <span className="font-medium">${(totalFeet * pricePerFoot).toFixed(2)}</span>
          </div>

          {heightMultiplierApplied && (
            <div className="flex justify-between text-amber-600">
              <span className="flex items-center gap-1">
                <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-400 text-amber-600">×{heightMultiplier}</Badge>
                Hauteur
              </span>
              <span>Appliqué</span>
            </div>
          )}
          {widthMultiplierApplied && (
            <div className="flex justify-between text-amber-600">
              <span className="flex items-center gap-1">
                <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-400 text-amber-600">×{widthMultiplier}</Badge>
                Largeur
              </span>
              <span>Appliqué</span>
            </div>
          )}

          <div className="flex justify-between font-medium">
            <span>Sous-total coupe</span><span>${basePrice.toFixed(2)}</span>
          </div>

          {bushItems.map((b, i) => (
            <div key={i} className="flex justify-between text-muted-foreground">
              <span>Bush: {b.description || "Bush"} (×{b.count})</span>
              <span>${(b.count * b.price).toFixed(2)}</span>
            </div>
          ))}

          {extras.filter(e => e.description || e.price > 0).map((e, i) => (
            <div key={i} className="flex justify-between text-muted-foreground">
              <span>Extra: {e.description || "—"}</span>
              <span>${e.price.toFixed(2)}</span>
            </div>
          ))}
        </div>

        <Separator />

        {/* Total */}
        <div className="flex justify-between items-center pt-1">
          <span className="text-lg font-bold">Total estimé</span>
          <span className="text-2xl font-bold text-primary">${totalPrice.toFixed(2)}</span>
        </div>

        <p className="text-[10px] text-muted-foreground italic text-center">Ce document est une estimation. Le prix final peut varier.</p>
      </CardContent>
    </Card>
  );
}
