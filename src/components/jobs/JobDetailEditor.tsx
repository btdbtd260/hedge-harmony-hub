import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  useCustomers,
  useJobById,
  useUpdateJob,
  useParameters,
  getClientNameFromList,
  type DbJob,
} from "@/hooks/useSupabaseData";
import { Calculator, Plus, Trash2, Save, ArrowLeft, X } from "lucide-react";
import { computeTotalPauseMinutes, formatDurationMinutes } from "@/lib/jobDurationEstimator";
import { toast } from "sonner";
import type { PauseInterval,
  CutType,
  HeightMode,
  EstimationExtra,
  EstimationDiscount,
  DiscountType,
} from "@/types";
import { applyTotalRounding } from "@/lib/roundingTotal";

interface BushItem {
  id: string;
  description: string;
  count: number;
  price: number;
}

function loadFromSnapshot(snap: any, field: string, altField: string): string {
  const v = snap?.[field] ?? snap?.[altField];
  return v != null ? String(v) : "";
}

export default function JobDetailEditor() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { data: job, isLoading } = useJobById(jobId);
  const { data: customers = [] } = useCustomers();
  const { data: params } = useParameters();
  const updateJob = useUpdateJob();

  const [isSaving, setIsSaving] = useState(false);

  // Initialize form state with empty/default values (populated via useEffect
  // when job data arrives asynchronously — see bug fix below).
  const [cutType, setCutType] = useState<CutType>("trim");
  const [useCustomPrice, setUseCustomPrice] = useState(false);
  const [customCutPrice, setCustomCutPrice] = useState("");

  const [twoSidesLeft, setTwoSidesLeft] = useState(false);
  const [twoSidesFacade, setTwoSidesFacade] = useState(false);
  const [twoSidesRight, setTwoSidesRight] = useState(false);
  const [twoSidesBack, setTwoSidesBack] = useState(false);
  const [twoSidesBackLeft, setTwoSidesBackLeft] = useState(false);
  const [twoSidesBackRight, setTwoSidesBackRight] = useState(false);

  const [facadeLength, setFacadeLength] = useState("");
  const [leftLength, setLeftLength] = useState("");
  const [rightLength, setRightLength] = useState("");
  const [backLength, setBackLength] = useState("");
  const [backLeftLength, setBackLeftLength] = useState("");
  const [backRightLength, setBackRightLength] = useState("");

  const [heightMode, setHeightMode] = useState<HeightMode>("global");
  const [heightGlobal, setHeightGlobal] = useState("");
  const [heightFacade, setHeightFacade] = useState("");
  const [heightLeft, setHeightLeft] = useState("");
  const [heightRight, setHeightRight] = useState("");
  const [heightBack, setHeightBack] = useState("");
  const [heightBackLeft, setHeightBackLeft] = useState("");
  const [heightBackRight, setHeightBackRight] = useState("");
  const [width, setWidth] = useState("");

  const [extras, setExtras] = useState<EstimationExtra[]>([]);
  const [discounts, setDiscounts] = useState<EstimationDiscount[]>([]);
  const [bushItems, setBushItems] = useState<BushItem[]>([]);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [pauses, setPauses] = useState<PauseInterval[]>([]);

  // ── Bug fix: populate form fields when job data arrives async ──
  // On first visit, React Query hasn't fetched the job yet, so all fields
  // would stay empty. This effect populates them once job data lands.
  // After initial load for the same job, user edits are preserved.
  const lastJobIdRef = useRef<string | undefined>();
  useEffect(() => {
    if (!job) return;
    const snap = job.measurement_snapshot as any;

    // Only populate on initial load for each job
    if (lastJobIdRef.current === job.id) return;
    lastJobIdRef.current = job.id;

    setCutType((job.cut_type as CutType) || "trim");
    setUseCustomPrice(!!snap?.custom_price_per_foot);
    setCustomCutPrice(loadFromSnapshot(snap, "custom_price_per_foot"));

    const twoSides = snap?.two_sides || {};
    setTwoSidesLeft(!!twoSides.left);
    setTwoSidesFacade(!!twoSides.facade);
    setTwoSidesRight(!!twoSides.right);
    setTwoSidesBack(!!twoSides.back);
    setTwoSidesBackLeft(!!twoSides.back_left);
    setTwoSidesBackRight(!!twoSides.back_right);

    setFacadeLength(loadFromSnapshot(snap, "facadeLength", "facade_length"));
    setLeftLength(loadFromSnapshot(snap, "leftLength", "left_length"));
    setRightLength(loadFromSnapshot(snap, "rightLength", "right_length"));
    setBackLength(loadFromSnapshot(snap, "backLength", "back_length"));
    setBackLeftLength(
      loadFromSnapshot(snap, "backLeftLength", "back_left_length"),
    );
    setBackRightLength(
      loadFromSnapshot(snap, "backRightLength", "back_right_length"),
    );

    setHeightMode((snap?.height_mode as HeightMode) || "global");
    setHeightGlobal(loadFromSnapshot(snap, "heightGlobal", "height_global"));
    setHeightFacade(loadFromSnapshot(snap, "heightFacade", "height_facade"));
    setHeightLeft(loadFromSnapshot(snap, "heightLeft", "height_left"));
    setHeightRight(loadFromSnapshot(snap, "heightRight", "height_right"));
    setHeightBack(loadFromSnapshot(snap, "heightBack", "height_back"));
    setHeightBackLeft(
      loadFromSnapshot(snap, "heightBackLeft", "height_back_left"),
    );
    setHeightBackRight(
      loadFromSnapshot(snap, "heightBackRight", "height_back_right"),
    );
    setWidth(loadFromSnapshot(snap, "width"));

    setExtras(snap?.extras || []);
    setDiscounts(snap?.discounts || []);
    setBushItems(snap?.bushItems || []);
    setScheduledDate(job.scheduled_date ?? "");
    setScheduledTime(job.start_time?.slice(0, 5) ?? "");
    const jobPauses = (snap as any)?.pauses ?? (job as any).pauses;
    if (Array.isArray(jobPauses)) {
      setPauses(jobPauses);
    } else {
      setPauses([]);
    }
    // Intentionally exclude 'job' from deps — we only populate on job.id change (new job),
    // not on every refetch of the same job (which would overwrite user edits).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id]);

  const p = params ?? {
    price_per_foot_trim: 4.5,
    price_per_foot_levelling: 6,
    price_per_foot_restoration: 8,
    bush_price: 40,
    height_multiplier_threshold: 5,
    height_multiplier: 1.5,
    width_multiplier_threshold: 3,
    width_multiplier: 1.3,
    two_sides_multiplier: 1.5,
  };
  const twoSidesMult = (p as any).two_sides_multiplier ?? 1.5;
  const priceRestoration = (p as any).price_per_foot_restoration ?? 8;

  const numFacade = Number(facadeLength) || 0;
  const numLeft = Number(leftLength) || 0;
  const numRight = Number(rightLength) || 0;
  const numBack = Number(backLength) || 0;
  const numBackLeft = Number(backLeftLength) || 0;
  const numBackRight = Number(backRightLength) || 0;
  const numHeightGlobal = Number(heightGlobal) || 4;
  const numHeightFacade = Number(heightFacade) || 0;
  const numHeightLeft = Number(heightLeft) || 0;
  const numHeightRight = Number(heightRight) || 0;
  const numHeightBack = Number(heightBack) || 0;
  const numHeightBackLeft = Number(heightBackLeft) || 0;
  const numHeightBackRight = Number(heightBackRight) || 0;
  const numWidth = Number(width) || 2;
  const numCustomPrice = Number(customCutPrice) || 0;

  const standardPricePerFoot =
    cutType === "trim"
      ? p.price_per_foot_trim
      : cutType === "levelling"
        ? p.price_per_foot_levelling
        : priceRestoration;

  const totalLinearFeet =
    numFacade + numLeft + numRight + numBack + numBackLeft + numBackRight;
  const pricePerFoot =
    useCustomPrice && numCustomPrice > 0
      ? numCustomPrice
      : standardPricePerFoot;

  const sideBase = (length: number, twoSides: boolean) =>
    length * pricePerFoot * (twoSides ? twoSidesMult : 1);

  let basePrice =
    sideBase(numLeft, twoSidesLeft) +
    sideBase(numFacade, twoSidesFacade) +
    sideBase(numRight, twoSidesRight) +
    sideBase(numBackLeft, twoSidesBackLeft) +
    sideBase(numBack, twoSidesBack) +
    sideBase(numBackRight, twoSidesBackRight);

  const effectiveHeight =
    heightMode === "global"
      ? numHeightGlobal
      : Math.max(
          numHeightFacade,
          numHeightLeft,
          numHeightRight,
          numHeightBack,
          numHeightBackLeft,
          numHeightBackRight,
        );
  const heightMultiplierApplied =
    effectiveHeight >= p.height_multiplier_threshold;
  const widthMultiplierApplied = numWidth >= p.width_multiplier_threshold;
  if (heightMultiplierApplied) basePrice *= p.height_multiplier;
  if (widthMultiplierApplied) basePrice *= p.width_multiplier;

  const bushesTotal = bushItems.reduce((sum, b) => sum + b.count * b.price, 0);
  const totalBushesCount = bushItems.reduce((sum, b) => sum + b.count, 0);
  const extrasPrice = extras.reduce((sum, e) => sum + e.price, 0);
  const subtotalBeforeDiscounts = basePrice + bushesTotal + extrasPrice;

  const discountAmounts = discounts.map((d) => {
    if (d.type === "percent") {
      const pct = Math.max(0, Math.min(100, Number(d.value) || 0));
      return (subtotalBeforeDiscounts * pct) / 100;
    }
    return Math.max(0, Number(d.value) || 0);
  });
  const discountTotal = discountAmounts.reduce((s, n) => s + n, 0);
  const rawTotal = Math.max(0, subtotalBeforeDiscounts - discountTotal);
  const roundingEnabled = (params as any)?.rounding_enabled ?? true;
  const roundingMultiple = Number((params as any)?.rounding_multiple ?? 5);
  const totalPrice = applyTotalRounding(
    rawTotal,
    roundingEnabled,
    roundingMultiple,
  );

  const cutTypeLabel =
    cutType === "trim"
      ? "Taillage"
      : cutType === "levelling"
        ? "Nivelage"
        : "Restauration";

  const addExtra = () =>
    setExtras([
      ...extras,
      { id: `ext-${Date.now()}`, description: "", price: 0 },
    ]);
  const removeExtra = (id: string) =>
    setExtras(extras.filter((e) => e.id !== id));
  const updateExtra = (
    id: string,
    field: "description" | "price",
    value: string | number,
  ) =>
    setExtras(extras.map((e) => (e.id === id ? { ...e, [field]: value } : e)));

  const addDiscount = () =>
    setDiscounts([
      ...discounts,
      { id: `disc-${Date.now()}`, description: "", type: "percent", value: 0 },
    ]);
  const removeDiscount = (id: string) =>
    setDiscounts(discounts.filter((d) => d.id !== id));
  const updateDiscount = (
    id: string,
    field: keyof EstimationDiscount,
    value: string | number,
  ) =>
    setDiscounts(
      discounts.map((d) => (d.id === id ? { ...d, [field]: value } : d)),
    );

  const addBush = () =>
    setBushItems([
      ...bushItems,
      {
        id: `bush-${Date.now()}`,
        description: "",
        count: 1,
        price: p.bush_price,
      },
    ]);
  const removeBush = (id: string) =>
    setBushItems(bushItems.filter((b) => b.id !== id));
  const updateBush = (
    id: string,
    field: keyof BushItem,
    value: string | number,
  ) =>
    setBushItems(
      bushItems.map((b) => (b.id === id ? { ...b, [field]: value } : b)),
    );

  const clientName = job ? getClientNameFromList(customers, job.client_id) : "";

  const handleSave = async () => {
    if (!job) return;
    setIsSaving(true);
    try {
      const measurementSnapshot = {
        facade_length: numFacade,
        left_length: numLeft,
        right_length: numRight,
        back_length: numBack,
        back_left_length: numBackLeft,
        back_right_length: numBackRight,
        height_mode: heightMode,
        height_global: numHeightGlobal,
        height_facade: numHeightFacade,
        height_left: numHeightLeft,
        height_right: numHeightRight,
        height_back: numHeightBack,
        height_back_left: numHeightBackLeft,
        height_back_right: numHeightBackRight,
        width: numWidth,
        custom_price_per_foot:
          useCustomPrice && numCustomPrice > 0 ? numCustomPrice : null,
        two_sides: {
          facade: twoSidesFacade,
          left: twoSidesLeft,
          right: twoSidesRight,
          back: twoSidesBack,
          back_left: twoSidesBackLeft,
          back_right: twoSidesBackRight,
        },
        bushItems,
        extras,
        discounts,
      };

      const pauseMinutes = computeTotalPauseMinutes(pauses);
      await updateJob.mutateAsync({
        id: job.id,
        cut_type: cutType,
        estimated_profit: totalPrice,
        scheduled_date: scheduledDate || null,
        start_time: scheduledDate ? scheduledTime || "09:00" : null,
        status:
          scheduledDate && job.status === "pending" ? "scheduled" : job.status,
        // Merge pauses into measurement_snapshot (preserving all existing fields)
        measurement_snapshot: {
          ...measurementSnapshot,
          pauses,
          totalPauseMinutes: pauseMinutes,
        },
      } as any);

      toast.success("Job mis à jour avec succès");
      navigate("/jobs");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Chargement du job…
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Job introuvable.
      </div>
    );
  }

  if (job.status === "completed") {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>Ce job est déjà complété et ne peut pas être modifié.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate("/jobs")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour aux jobs
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/jobs")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Retour
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Modifier le job
          </h1>
          <p className="text-muted-foreground">
            {clientName} — {job.cut_type}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form – left */}
        <div className="lg:col-span-5 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Détails du job</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>Client</Label>
                <p className="text-sm font-medium">{clientName}</p>
              </div>

              <div className="space-y-2">
                <Label>Type de coupe</Label>
                <Select
                  value={cutType}
                  onValueChange={(v) => setCutType(v as CutType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trim">Taillage</SelectItem>
                    <SelectItem value="levelling">Nivelage</SelectItem>
                    <SelectItem value="restoration">Restauration</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {useCustomPrice && numCustomPrice > 0 && (
                <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {cutTypeLabel}
                    </span>{" "}
                    · prix perso{" "}
                    <span className="font-medium text-foreground">
                      ${numCustomPrice}/pi
                    </span>
                  </span>
                </div>
              )}

              <div className="space-y-3">
                <Label className="text-base font-semibold">
                  Mesures (pieds linéaires)
                </Label>
                <p className="text-xs text-muted-foreground -mt-1">
                  Cochez « 2 côtés » si la haie est coupée des deux côtés (×
                  {twoSidesMult}).
                </p>

                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <p className="text-sm font-medium text-foreground">Avant</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Gauche
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={leftLength}
                        onChange={(e) => setLeftLength(e.target.value)}
                      />
                      <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={twoSidesLeft}
                          onChange={(e) => setTwoSidesLeft(e.target.checked)}
                          className="h-3 w-3"
                        />{" "}
                        2 côtés
                      </label>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Façade
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={facadeLength}
                        onChange={(e) => setFacadeLength(e.target.value)}
                      />
                      <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={twoSidesFacade}
                          onChange={(e) => setTwoSidesFacade(e.target.checked)}
                          className="h-3 w-3"
                        />{" "}
                        2 côtés
                      </label>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Droite
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={rightLength}
                        onChange={(e) => setRightLength(e.target.value)}
                      />
                      <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={twoSidesRight}
                          onChange={(e) => setTwoSidesRight(e.target.checked)}
                          className="h-3 w-3"
                        />{" "}
                        2 côtés
                      </label>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <p className="text-sm font-medium text-foreground">Arrière</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Gauche
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={backLeftLength}
                        onChange={(e) => setBackLeftLength(e.target.value)}
                      />
                      <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={twoSidesBackLeft}
                          onChange={(e) =>
                            setTwoSidesBackLeft(e.target.checked)
                          }
                          className="h-3 w-3"
                        />{" "}
                        2 côtés
                      </label>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Fond
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={backLength}
                        onChange={(e) => setBackLength(e.target.value)}
                      />
                      <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={twoSidesBack}
                          onChange={(e) => setTwoSidesBack(e.target.checked)}
                          className="h-3 w-3"
                        />{" "}
                        2 côtés
                      </label>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Droite
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={backRightLength}
                        onChange={(e) => setBackRightLength(e.target.value)}
                      />
                      <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={twoSidesBackRight}
                          onChange={(e) =>
                            setTwoSidesBackRight(e.target.checked)
                          }
                          className="h-3 w-3"
                        />{" "}
                        2 côtés
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Hauteur</Label>
                <Select
                  value={heightMode}
                  onValueChange={(v) => setHeightMode(v as HeightMode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Globale</SelectItem>
                    <SelectItem value="per_side">Par côté</SelectItem>
                  </SelectContent>
                </Select>
                {heightMode === "global" ? (
                  <Input
                    type="number"
                    min={0}
                    placeholder="4"
                    value={heightGlobal}
                    onChange={(e) => setHeightGlobal(e.target.value)}
                  />
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                      <p className="text-sm font-medium text-foreground">
                        Avant
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Gauche
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            placeholder="0"
                            value={heightLeft}
                            onChange={(e) => setHeightLeft(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Façade
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            placeholder="0"
                            value={heightFacade}
                            onChange={(e) => setHeightFacade(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Droite
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            placeholder="0"
                            value={heightRight}
                            onChange={(e) => setHeightRight(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                      <p className="text-sm font-medium text-foreground">
                        Arrière
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Gauche
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            placeholder="0"
                            value={heightBackLeft}
                            onChange={(e) => setHeightBackLeft(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Fond
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            placeholder="0"
                            value={heightBack}
                            onChange={(e) => setHeightBack(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Droite
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            placeholder="0"
                            value={heightBackRight}
                            onChange={(e) => setHeightBackRight(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Largeur (pieds)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="2"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Date planifiée{" "}
                  <span className="text-muted-foreground font-normal">
                    (optionnelle)
                  </span>
                </Label>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => {
                    setScheduledDate(e.target.value);
                    if (!e.target.value) setScheduledTime("");
                  }}
                />
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  disabled={!scheduledDate}
                />
              </div>

              {/* Pauses management */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Pauses</Label>
                  <Button variant="outline" size="sm" onClick={() => {
                    const now = new Date();
                    const hhmm = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
                    setPauses([...pauses, { start: hhmm }]);
                  }}>
                    <Plus className="h-3 w-3 mr-1" /> Ajouter
                  </Button>
                </div>
                {pauses.length > 0 && (
                  <div className="text-xs text-muted-foreground mb-1">
                    Total pauses : {formatDurationMinutes(computeTotalPauseMinutes(pauses))}
                  </div>
                )}
                {pauses.map((p, i) => (
                  <div key={i} className="flex gap-1 items-center">
                    <Input
                      type="time"
                      value={p.start}
                      onChange={(e) => {
                        const updated = pauses.map((pp, j) => j === i ? { ...pp, start: e.target.value } : pp);
                        setPauses(updated);
                      }}
                      className="h-8 w-28"
                    />
                    <span className="text-xs text-muted-foreground">→</span>
                    <Input
                      type="time"
                      value={p.end ?? ""}
                      onChange={(e) => {
                        const updated = pauses.map((pp, j) => j === i ? { ...pp, end: e.target.value || undefined } : pp);
                        setPauses(updated);
                      }}
                      className="h-8 w-28"
                      placeholder="En cours"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setPauses(pauses.filter((_, j) => j !== i))}
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              {bushItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Bushes</Label>
                    <Button variant="outline" size="sm" onClick={addBush}>
                      <Plus className="h-3 w-3 mr-1" /> Ajouter
                    </Button>
                  </div>
                  {bushItems.map((bush) => (
                    <div key={bush.id} className="flex gap-2 items-center">
                      <Input
                        placeholder="Description"
                        value={bush.description}
                        onChange={(e) =>
                          updateBush(bush.id, "description", e.target.value)
                        }
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        min={1}
                        placeholder="Qté"
                        value={bush.count || ""}
                        onChange={(e) =>
                          updateBush(bush.id, "count", Number(e.target.value))
                        }
                        className="w-20"
                      />
                      <Input
                        type="number"
                        min={0}
                        placeholder="Prix"
                        value={bush.price || ""}
                        onChange={(e) =>
                          updateBush(bush.id, "price", Number(e.target.value))
                        }
                        className="w-24"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeBush(bush.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Extras</Label>
                  <Button variant="outline" size="sm" onClick={addExtra}>
                    <Plus className="h-3 w-3 mr-1" /> Ajouter
                  </Button>
                </div>
                {extras.map((extra) => (
                  <div key={extra.id} className="flex gap-2 items-center">
                    <Input
                      placeholder="Description"
                      value={extra.description}
                      onChange={(e) =>
                        updateExtra(extra.id, "description", e.target.value)
                      }
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={extra.price || ""}
                      onChange={(e) =>
                        updateExtra(extra.id, "price", Number(e.target.value))
                      }
                      className="w-24"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeExtra(extra.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Rabais</Label>
                  <Button variant="outline" size="sm" onClick={addDiscount}>
                    <Plus className="h-3 w-3 mr-1" /> Ajouter
                  </Button>
                </div>
                {discounts.map((d, i) => (
                  <div key={d.id} className="flex gap-2 items-center">
                    <Input
                      placeholder="Raison (optionnel)"
                      value={d.description}
                      onChange={(e) =>
                        updateDiscount(d.id, "description", e.target.value)
                      }
                      className="flex-1"
                    />
                    <Select
                      value={d.type}
                      onValueChange={(v) =>
                        updateDiscount(d.id, "type", v as DiscountType)
                      }
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">%</SelectItem>
                        <SelectItem value="fixed">Montant $</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0"
                      value={d.value || ""}
                      onChange={(e) =>
                        updateDiscount(d.id, "value", Number(e.target.value))
                      }
                      className="w-24"
                    />
                    <span className="text-xs text-muted-foreground w-16 text-right">
                      −${(discountAmounts[i] ?? 0).toFixed(2)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeDiscount(d.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary – right */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" /> Résumé
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pieds linéaires</span>
                <span>{totalLinearFeet} pi</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Prix/pied ({cutTypeLabel})
                </span>
                <span>${pricePerFoot}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Base</span>
                <span>${basePrice.toFixed(2)}</span>
              </div>
              {bushesTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Bushes ({totalBushesCount})
                  </span>
                  <span>${bushesTotal.toFixed(2)}</span>
                </div>
              )}
              {extrasPrice > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Extras</span>
                  <span>${extrasPrice}</span>
                </div>
              )}
              {(twoSidesLeft ||
                twoSidesFacade ||
                twoSidesRight ||
                twoSidesBackLeft ||
                twoSidesBack ||
                twoSidesBackRight) && (
                <div className="flex justify-between text-sm text-amber-600">
                  <span>Mult. deux côtés (×{twoSidesMult})</span>
                  <span>Appliqué</span>
                </div>
              )}
              {heightMultiplierApplied && (
                <div className="flex justify-between text-sm text-amber-600">
                  <span>Mult. hauteur (×{p.height_multiplier})</span>
                  <span>Appliqué</span>
                </div>
              )}
              {widthMultiplierApplied && (
                <div className="flex justify-between text-sm text-amber-600">
                  <span>Mult. largeur (×{p.width_multiplier})</span>
                  <span>Appliqué</span>
                </div>
              )}
              {discountTotal > 0 && (
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Rabais ({discounts.length})</span>
                  <span>−${discountTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t pt-3 flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-primary">${totalPrice.toFixed(2)}</span>
              </div>

              <Button
                className="w-full"
                disabled={isSaving}
                onClick={handleSave}
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Enregistrement…" : "Mettre à jour le job"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
