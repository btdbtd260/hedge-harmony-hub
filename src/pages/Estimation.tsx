import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCustomers, useEstimations, useParameters, useInsertCustomer, useInsertEstimation, useInsertJob, useInsertInvoice } from "@/hooks/useSupabaseData";
import { Calculator, Plus, Trash2, Search, UserPlus, Download, Mail, RotateCcw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { CutType, HeightMode, EstimationExtra, EstimationDiscount, DiscountType } from "@/types";
import EstimationPreview from "@/components/estimation/EstimationPreview";
import EstimationHistory from "@/components/estimation/EstimationHistory";
import { downloadEstimationPdf, getEstimationNumber, type EstimationPdfData } from "@/lib/generateEstimationPdf";
import { applyTotalRounding } from "@/lib/roundingTotal";
import { formatPhoneLive } from "@/lib/phoneFormat";

interface BushItem {
  id: string;
  description: string;
  count: number;
  price: number;
}

// Draft persistence: keep an in-progress estimation alive across navigation,
// but auto-reset after 10 minutes of inactivity. The whole form state is saved
// as a single snapshot to localStorage on every change.
const DRAFT_STORAGE_KEY = "estimation:draft:v1";
const DRAFT_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface DraftSnapshot {
  clientId: string;
  cutType: CutType;
  useCustomPrice: boolean;
  customCutPrice: string;
  facadeLength: string;
  leftLength: string;
  rightLength: string;
  backLength: string;
  backLeftLength: string;
  backRightLength: string;
  twoSidesFacade: boolean;
  twoSidesLeft: boolean;
  twoSidesRight: boolean;
  twoSidesBack: boolean;
  twoSidesBackLeft: boolean;
  twoSidesBackRight: boolean;
  heightMode: HeightMode;
  heightGlobal: string;
  heightFacade: string;
  heightLeft: string;
  heightRight: string;
  heightBack: string;
  heightBackLeft: string;
  heightBackRight: string;
  width: string;
  extras: EstimationExtra[];
  discounts: EstimationDiscount[];
  bushItems: BushItem[];
}

const DRAFT_DEFAULTS: DraftSnapshot = {
  clientId: "",
  cutType: "trim",
  useCustomPrice: false,
  customCutPrice: "",
  facadeLength: "",
  leftLength: "",
  rightLength: "",
  backLength: "",
  backLeftLength: "",
  backRightLength: "",
  twoSidesFacade: false,
  twoSidesLeft: false,
  twoSidesRight: false,
  twoSidesBack: false,
  twoSidesBackLeft: false,
  twoSidesBackRight: false,
  heightMode: "global",
  heightGlobal: "",
  heightFacade: "",
  heightLeft: "",
  heightRight: "",
  heightBack: "",
  heightBackLeft: "",
  heightBackRight: "",
  width: "",
  extras: [],
  discounts: [],
  bushItems: [],
};

/**
 * Loads a draft from localStorage if it is younger than DRAFT_TTL_MS.
 * Older drafts (>10min inactivity) are discarded so the user starts fresh.
 */
function loadInitialDraft(): DraftSnapshot {
  if (typeof window === "undefined") return DRAFT_DEFAULTS;
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return DRAFT_DEFAULTS;
    const parsed = JSON.parse(raw) as { savedAt?: number; value?: Partial<DraftSnapshot> };
    if (
      !parsed ||
      typeof parsed.savedAt !== "number" ||
      Date.now() - parsed.savedAt > DRAFT_TTL_MS
    ) {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      return DRAFT_DEFAULTS;
    }
    // Merge with defaults so missing keys (older draft schemas) stay safe.
    return { ...DRAFT_DEFAULTS, ...(parsed.value ?? {}) };
  } catch {
    return DRAFT_DEFAULTS;
  }
}

const EstimationPage = () => {
  const { data: customers = [] } = useCustomers();
  const { data: estimations = [] } = useEstimations();
  const { data: params } = useParameters();
  const insertCustomer = useInsertCustomer();
  const insertEstimation = useInsertEstimation();
  const insertJob = useInsertJob();
  const insertInvoice = useInsertInvoice();

  // Hydrate from draft (or defaults if expired/missing). Computed once per mount.
  const initialDraft = loadInitialDraft();

  const [clientId, setClientId] = useState(initialDraft.clientId);
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");

  // cutType is ALWAYS one of the 3 real business types — never "custom".
  const [cutType, setCutType] = useState<CutType>(initialDraft.cutType);
  // Per-estimation override of price-per-foot. Does NOT change the cut type.
  const [useCustomPrice, setUseCustomPrice] = useState(initialDraft.useCustomPrice);
  const [customCutPrice, setCustomCutPrice] = useState(initialDraft.customCutPrice);
  const [facadeLength, setFacadeLength] = useState(initialDraft.facadeLength);
  const [leftLength, setLeftLength] = useState(initialDraft.leftLength);
  const [rightLength, setRightLength] = useState(initialDraft.rightLength);
  const [backLength, setBackLength] = useState(initialDraft.backLength);
  const [backLeftLength, setBackLeftLength] = useState(initialDraft.backLeftLength);
  const [backRightLength, setBackRightLength] = useState(initialDraft.backRightLength);
  // "Deux côtés" toggles per side — multiplies that side's price by two_sides_multiplier
  const [twoSidesFacade, setTwoSidesFacade] = useState(initialDraft.twoSidesFacade);
  const [twoSidesLeft, setTwoSidesLeft] = useState(initialDraft.twoSidesLeft);
  const [twoSidesRight, setTwoSidesRight] = useState(initialDraft.twoSidesRight);
  const [twoSidesBack, setTwoSidesBack] = useState(initialDraft.twoSidesBack);
  const [twoSidesBackLeft, setTwoSidesBackLeft] = useState(initialDraft.twoSidesBackLeft);
  const [twoSidesBackRight, setTwoSidesBackRight] = useState(initialDraft.twoSidesBackRight);
  const [heightMode, setHeightMode] = useState<HeightMode>(initialDraft.heightMode);
  const [heightGlobal, setHeightGlobal] = useState(initialDraft.heightGlobal);
  const [heightFacade, setHeightFacade] = useState(initialDraft.heightFacade);
  const [heightLeft, setHeightLeft] = useState(initialDraft.heightLeft);
  const [heightRight, setHeightRight] = useState(initialDraft.heightRight);
  const [heightBack, setHeightBack] = useState(initialDraft.heightBack);
  const [heightBackLeft, setHeightBackLeft] = useState(initialDraft.heightBackLeft);
  const [heightBackRight, setHeightBackRight] = useState(initialDraft.heightBackRight);
  const [width, setWidth] = useState(initialDraft.width);
  const [extras, setExtras] = useState<EstimationExtra[]>(initialDraft.extras);
  const [discounts, setDiscounts] = useState<EstimationDiscount[]>(initialDraft.discounts);
  const [bushItems, setBushItems] = useState<BushItem[]>(initialDraft.bushItems);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  // Dialog for "Custom" cut-type choice (pick a real type + custom price)
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [pendingCustomType, setPendingCustomType] = useState<CutType>("trim");
  const [pendingCustomPrice, setPendingCustomPrice] = useState("");

  const p = params ?? { price_per_foot_trim: 4.5, price_per_foot_levelling: 6, price_per_foot_restoration: 8, bush_price: 40, height_multiplier_threshold: 5, height_multiplier: 1.5, width_multiplier_threshold: 3, width_multiplier: 1.3, two_sides_multiplier: 1.5 };
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

  // Standard price for the chosen real cut type (always available)
  const standardPricePerFoot =
    cutType === "trim"
      ? p.price_per_foot_trim
      : cutType === "levelling"
        ? p.price_per_foot_levelling
        : priceRestoration;

  // The price actually used for this estimation: standard or per-estimation override
  const totalLinearFeet = numFacade + numLeft + numRight + numBack + numBackLeft + numBackRight;
  const pricePerFoot = useCustomPrice && numCustomPrice > 0 ? numCustomPrice : standardPricePerFoot;

  // Per-side base price with optional two-sides multiplier
  const sideBase = (length: number, twoSides: boolean) =>
    length * pricePerFoot * (twoSides ? twoSidesMult : 1);

  let basePrice =
    sideBase(numLeft, twoSidesLeft) +
    sideBase(numFacade, twoSidesFacade) +
    sideBase(numRight, twoSidesRight) +
    sideBase(numBackLeft, twoSidesBackLeft) +
    sideBase(numBack, twoSidesBack) +
    sideBase(numBackRight, twoSidesBackRight);

  const effectiveHeight = heightMode === "global" ? numHeightGlobal : Math.max(numHeightFacade, numHeightLeft, numHeightRight, numHeightBack, numHeightBackLeft, numHeightBackRight);
  const heightMultiplierApplied = effectiveHeight >= p.height_multiplier_threshold;
  const widthMultiplierApplied = numWidth >= p.width_multiplier_threshold;
  if (heightMultiplierApplied) basePrice *= p.height_multiplier;
  if (widthMultiplierApplied) basePrice *= p.width_multiplier;

  const bushesTotal = bushItems.reduce((sum, b) => sum + b.count * b.price, 0);
  const totalBushesCount = bushItems.reduce((sum, b) => sum + b.count, 0);
  const extrasPrice = extras.reduce((sum, e) => sum + e.price, 0);
  const subtotalBeforeDiscounts = basePrice + bushesTotal + extrasPrice;

  // Apply discounts in the order added. Percentages always apply to the subtotal
  // before any discounts (predictable & explainable). Fixed amounts deduct directly.
  const discountAmounts = discounts.map((d) => {
    if (d.type === "percent") {
      const pct = Math.max(0, Math.min(100, Number(d.value) || 0));
      return (subtotalBeforeDiscounts * pct) / 100;
    }
    return Math.max(0, Number(d.value) || 0);
  });
  const discountTotal = discountAmounts.reduce((s, n) => s + n, 0);
  const rawTotal = Math.max(0, subtotalBeforeDiscounts - discountTotal);
  // Optional rounding (configured in Paramètres). Disabled or invalid multiple → no rounding.
  const roundingEnabled = (params as any)?.rounding_enabled ?? true;
  const roundingMultiple = Number((params as any)?.rounding_multiple ?? 5);
  const totalPrice = applyTotalRounding(rawTotal, roundingEnabled, roundingMultiple);

  const cutTypeLabel =
    cutType === "trim" ? "Taillage" : cutType === "levelling" ? "Nivelage" : "Restauration";

  const addExtra = () => setExtras([...extras, { id: `ext-${Date.now()}`, description: "", price: 0 }]);
  const removeExtra = (id: string) => setExtras(extras.filter((e) => e.id !== id));
  const updateExtra = (id: string, field: "description" | "price", value: string | number) => setExtras(extras.map((e) => e.id === id ? { ...e, [field]: value } : e));

  const addDiscount = () => setDiscounts([...discounts, { id: `disc-${Date.now()}`, description: "", type: "percent", value: 0 }]);
  const removeDiscount = (id: string) => setDiscounts(discounts.filter((d) => d.id !== id));
  const updateDiscount = (id: string, field: keyof EstimationDiscount, value: string | number) =>
    setDiscounts(discounts.map((d) => d.id === id ? { ...d, [field]: value } : d));

  const addBush = () => setBushItems([...bushItems, { id: `bush-${Date.now()}`, description: "", count: 1, price: p.bush_price }]);
  const removeBush = (id: string) => setBushItems(bushItems.filter((b) => b.id !== id));
  const updateBush = (id: string, field: keyof BushItem, value: string | number) => setBushItems(bushItems.map((b) => b.id === id ? { ...b, [field]: value } : b));

  const filteredClients = customers.filter((c) => !c.hidden).filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()));
  const selectedClient = customers.find((c) => c.id === clientId) ?? null;

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

  const buildPdfData = (): EstimationPdfData => ({
    customer: selectedClient,
    params: params ?? null,
    estimationNumber: getEstimationNumber(estimations.length),
    cutType,
    customPricePerFoot: useCustomPrice && numCustomPrice > 0 ? numCustomPrice : undefined,
    facadeLength: numFacade, leftLength: numLeft, rightLength: numRight, backLength: numBack,
    backLeftLength: numBackLeft, backRightLength: numBackRight,
    heightMode: heightMode as "global" | "per_side",
    heightGlobal: numHeightGlobal, heightFacade: numHeightFacade, heightLeft: numHeightLeft, heightRight: numHeightRight, heightBack: numHeightBack, heightBackLeft: numHeightBackLeft, heightBackRight: numHeightBackRight,
    width: numWidth, basePrice,
    bushItems: bushItems.map(b => ({ description: b.description, count: b.count, price: b.price })),
    extras,
    discounts,
    heightMultiplierApplied, widthMultiplierApplied,
    heightMultiplier: p.height_multiplier, widthMultiplier: p.width_multiplier,
    totalPrice,
    twoSides: {
      facade: twoSidesFacade, left: twoSidesLeft, right: twoSidesRight,
      back: twoSidesBack, back_left: twoSidesBackLeft, back_right: twoSidesBackRight,
    },
    twoSidesMultiplier: twoSidesMult,
  });

  const handleDownloadPdf = async () => {
    await downloadEstimationPdf(buildPdfData());
    toast.success("PDF estimation téléchargé");
  };

  const handleOpenEmailDialog = () => {
    setEmailTo(selectedClient?.email || "");
    setEmailMessage(`Bonjour${selectedClient ? ` ${selectedClient.name}` : ""},\n\nVeuillez trouver ci-joint notre estimation pour les travaux de coupe de haies.\n\nTotal estimé : ${totalPrice.toFixed(2)} $\n\nN'hésitez pas à nous contacter pour toute question.\n\nCordialement,`);
    setShowEmailDialog(true);
  };

  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const handleSendEmail = async () => {
    if (!emailTo.trim()) { toast.error("Veuillez entrer une adresse email"); return; }
    if (isSendingEmail) return;
    setIsSendingEmail(true);
    let pdfUrl: string;
    let pdfFileName: string;
    try {
      const { generateAndUploadEstimationPdf } = await import("@/lib/uploadEstimationPdf");
      const uploaded = await generateAndUploadEstimationPdf(buildPdfData());
      pdfUrl = uploaded.signedUrl;
      pdfFileName = uploaded.fileName;
    } catch (e: any) {
      setIsSendingEmail(false);
      toast.error(`PDF non joint : ${e?.message ?? "erreur de génération"}`);
      return;
    }
    try {
      const { sendCustomerEmail } = await import("@/lib/sendCustomerEmail");
      await sendCustomerEmail({
        templateName: "estimation-to-client",
        recipientEmail: emailTo.trim(),
        idempotencyKey: `estimation-draft-${clientId || "anon"}-${Date.now()}`,
        templateData: {
          clientName: selectedClient?.name || "",
          totalPrice: totalPrice.toFixed(2),
          message: emailMessage,
          pdfUrl,
          pdfFileName,
        },
      });
      toast.success(`Email envoyé à ${emailTo} avec le PDF en pièce jointe`);
      setShowEmailDialog(false);
    } catch (e: any) {
      toast.error(`Échec de l'envoi : ${e?.message ?? "erreur inconnue"}`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleCreateEstimation = async () => {
    if (!clientId) {
      toast.error("Sélectionnez un client");
      return;
    }
    if (useCustomPrice && numCustomPrice <= 0) {
      toast.error("Entrez un prix par pied valide pour le prix personnalisé");
      return;
    }
    try {
      // The cut_type is ALWAYS one of the 3 real business types — never "custom".
      // The custom price (if any) is stored as metadata so the original cut_type
      // stays clean for the calendar, duration estimator and analytics.
      const metaExtras = [
        ...(useCustomPrice && numCustomPrice > 0
          ? [{ id: `meta-price-${Date.now()}`, description: `__PRICE_META__:${numCustomPrice}`, price: 0 }]
          : []),
        { id: `meta-sides-${Date.now()}`, description: `__SIDES_META__:${[twoSidesLeft, twoSidesFacade, twoSidesRight, twoSidesBackLeft, twoSidesBack, twoSidesBackRight].map(b => b ? "1" : "0").join("")}`, price: 0 },
        // Persist discounts as meta entries (price = computed deducted amount, negative for clarity).
        // The official total_price already includes them — these entries are for traceability/reload.
        ...discounts.map((d, i) => ({
          id: `meta-discount-${Date.now()}-${i}`,
          description: `__DISCOUNT_META__:${d.type}:${d.value}:${(d.description || "").replace(/[:|]/g, " ")}`,
          price: -discountAmounts[i],
        })),
      ];

      const estimation = await insertEstimation.mutateAsync({
        client_id: clientId, cut_type: cutType,
        facade_length: numFacade, left_length: numLeft, right_length: numRight, back_length: numBack,
        back_left_length: numBackLeft, back_right_length: numBackRight,
        height_mode: heightMode, height_global: numHeightGlobal, height_facade: numHeightFacade,
        height_left: numHeightLeft, height_right: numHeightRight, height_back: numHeightBack,
        height_back_left: numHeightBackLeft, height_back_right: numHeightBackRight,
        width: numWidth,
        extras: JSON.parse(JSON.stringify([
          ...extras,
          ...bushItems.map((b) => ({ id: b.id, description: `Bush: ${b.description || "Bush"}`, price: b.count * b.price })),
          ...metaExtras,
        ])),
        bushes_count: totalBushesCount, total_price: totalPrice,
      });

      const job = await insertJob.mutateAsync({
        client_id: clientId, estimation_id: estimation.id, cut_type: cutType,
        status: "pending", estimated_profit: totalPrice,
        measurement_snapshot: {
          facade_length: numFacade, left_length: numLeft, right_length: numRight, back_length: numBack,
          back_left_length: numBackLeft, back_right_length: numBackRight,
          height_mode: heightMode, height_global: numHeightGlobal, height_facade: numHeightFacade,
          height_left: numHeightLeft, height_right: numHeightRight, height_back: numHeightBack,
          height_back_left: numHeightBackLeft, height_back_right: numHeightBackRight, width: numWidth,
          // Per-estimation custom price override (does NOT change the cut type)
          custom_price_per_foot: useCustomPrice && numCustomPrice > 0 ? numCustomPrice : null,
          two_sides: {
            facade: twoSidesFacade, left: twoSidesLeft, right: twoSidesRight,
            back: twoSidesBack, back_left: twoSidesBackLeft, back_right: twoSidesBackRight,
          },
        },
      });

      // Facture créée en BROUILLON (draft) — elle deviendra "unpaid" automatiquement
      // (via trigger DB) quand la job passera à "completed".
      await insertInvoice.mutateAsync({ client_id: clientId, job_id: job.id, amount: totalPrice, status: "draft" });

      toast.success("Estimation créée → Job généré (facture en attente de complétion)");
      setShowConfirmation(true);
    } catch (e: any) { toast.error(e.message); }
  };

  // Resets every form field back to defaults.
  // Used by both the success-confirmation close handler and the manual
  // "Réinitialiser le brouillon" button in the form header.
  const resetDraft = () => {
    setClientId(""); setFacadeLength(""); setLeftLength(""); setRightLength(""); setBackLength("");
    setBackLeftLength(""); setBackRightLength("");
    setHeightGlobal(""); setHeightFacade(""); setHeightLeft(""); setHeightRight(""); setHeightBack("");
    setHeightBackLeft(""); setHeightBackRight("");
    setWidth(""); setBushItems([]); setExtras([]); setDiscounts([]);
    setCutType("trim");
    setUseCustomPrice(false); setCustomCutPrice("");
    setHeightMode("global");
    setTwoSidesFacade(false); setTwoSidesLeft(false); setTwoSidesRight(false);
    setTwoSidesBack(false); setTwoSidesBackLeft(false); setTwoSidesBackRight(false);
    try { window.localStorage.removeItem(DRAFT_STORAGE_KEY); } catch { /* noop */ }
  };

  const handleCloseConfirmation = () => {
    setShowConfirmation(false);
    resetDraft();
  };

  // Persist the entire form snapshot whenever any tracked field changes.
  // The TTL is enforced on hydration (loadInitialDraft): drafts older than
  // DRAFT_TTL_MS are discarded and the form resets to defaults.
  useEffect(() => {
    const snapshot: DraftSnapshot = {
      clientId, cutType, useCustomPrice, customCutPrice,
      facadeLength, leftLength, rightLength, backLength, backLeftLength, backRightLength,
      twoSidesFacade, twoSidesLeft, twoSidesRight, twoSidesBack, twoSidesBackLeft, twoSidesBackRight,
      heightMode, heightGlobal, heightFacade, heightLeft, heightRight, heightBack,
      heightBackLeft, heightBackRight, width, extras, discounts, bushItems,
    };
    try {
      window.localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({ savedAt: Date.now(), value: snapshot }),
      );
    } catch {
      // localStorage may be full / unavailable — fail silently, the form still works.
    }
  }, [
    clientId, cutType, useCustomPrice, customCutPrice,
    facadeLength, leftLength, rightLength, backLength, backLeftLength, backRightLength,
    twoSidesFacade, twoSidesLeft, twoSidesRight, twoSidesBack, twoSidesBackLeft, twoSidesBackRight,
    heightMode, heightGlobal, heightFacade, heightLeft, heightRight, heightBack,
    heightBackLeft, heightBackRight, width, extras, discounts, bushItems,
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Estimation</h1>
        <p className="text-muted-foreground">Créer une estimation et générer automatiquement un job et une facture</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form – left */}
        <div className="lg:col-span-5 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Nouvelle estimation</CardTitle>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5" />
                    Réinitialiser le brouillon
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Réinitialiser le brouillon ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Toutes les données saisies dans le formulaire seront effacées,
                      ainsi que le brouillon enregistré localement. Cette action est irréversible.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        resetDraft();
                        toast.success("Brouillon réinitialisé");
                      }}
                    >
                      Réinitialiser
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardHeader>
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
                <Select
                  value={useCustomPrice ? "custom" : cutType}
                  onValueChange={(v) => {
                    if (v === "custom") {
                      // Open dialog to pick the real cut type + custom price
                      setPendingCustomType(cutType);
                      setPendingCustomPrice(customCutPrice);
                      setShowCustomDialog(true);
                    } else {
                      setCutType(v as CutType);
                      setUseCustomPrice(false);
                      setCustomCutPrice("");
                    }
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trim">Taillage</SelectItem>
                    <SelectItem value="levelling">Nivelage</SelectItem>
                    <SelectItem value="restoration">Restauration</SelectItem>
                    <SelectItem value="custom">Custom (prix personnalisé)</SelectItem>
                  </SelectContent>
                </Select>

                {useCustomPrice && numCustomPrice > 0 && (
                  <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-xs">
                    <span className="text-muted-foreground">
                      <span className="font-medium text-foreground">{cutTypeLabel}</span> · prix perso{" "}
                      <span className="font-medium text-foreground">${numCustomPrice}/pi</span>
                    </span>
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => {
                        setPendingCustomType(cutType);
                        setPendingCustomPrice(customCutPrice);
                        setShowCustomDialog(true);
                      }}
                    >
                      Modifier
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Label className="text-base font-semibold">Mesures (pieds linéaires)</Label>
                <p className="text-xs text-muted-foreground -mt-1">Cochez « 2 côtés » si la haie est coupée des deux côtés (×{twoSidesMult}).</p>

                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <p className="text-sm font-medium text-foreground">Avant</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Gauche</Label>
                      <Input type="number" min={0} placeholder="0" value={leftLength} onChange={(e) => setLeftLength(e.target.value)} />
                      <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                        <input type="checkbox" checked={twoSidesLeft} onChange={(e) => setTwoSidesLeft(e.target.checked)} className="h-3 w-3" /> 2 côtés
                      </label>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Façade</Label>
                      <Input type="number" min={0} placeholder="0" value={facadeLength} onChange={(e) => setFacadeLength(e.target.value)} />
                      <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                        <input type="checkbox" checked={twoSidesFacade} onChange={(e) => setTwoSidesFacade(e.target.checked)} className="h-3 w-3" /> 2 côtés
                      </label>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Droite</Label>
                      <Input type="number" min={0} placeholder="0" value={rightLength} onChange={(e) => setRightLength(e.target.value)} />
                      <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                        <input type="checkbox" checked={twoSidesRight} onChange={(e) => setTwoSidesRight(e.target.checked)} className="h-3 w-3" /> 2 côtés
                      </label>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <p className="text-sm font-medium text-foreground">Arrière</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Gauche</Label>
                      <Input type="number" min={0} placeholder="0" value={backLeftLength} onChange={(e) => setBackLeftLength(e.target.value)} />
                      <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                        <input type="checkbox" checked={twoSidesBackLeft} onChange={(e) => setTwoSidesBackLeft(e.target.checked)} className="h-3 w-3" /> 2 côtés
                      </label>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Fond</Label>
                      <Input type="number" min={0} placeholder="0" value={backLength} onChange={(e) => setBackLength(e.target.value)} />
                      <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                        <input type="checkbox" checked={twoSidesBack} onChange={(e) => setTwoSidesBack(e.target.checked)} className="h-3 w-3" /> 2 côtés
                      </label>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Droite</Label>
                      <Input type="number" min={0} placeholder="0" value={backRightLength} onChange={(e) => setBackRightLength(e.target.value)} />
                      <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                        <input type="checkbox" checked={twoSidesBackRight} onChange={(e) => setTwoSidesBackRight(e.target.checked)} className="h-3 w-3" /> 2 côtés
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Hauteur</Label>
                <Select value={heightMode} onValueChange={(v) => setHeightMode(v as HeightMode)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="global">Globale</SelectItem><SelectItem value="per_side">Par côté</SelectItem></SelectContent></Select>
                {heightMode === "global" ? (
                  <Input type="number" min={0} placeholder="4" value={heightGlobal} onChange={(e) => setHeightGlobal(e.target.value)} />
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                      <p className="text-sm font-medium text-foreground">Avant</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div><Label className="text-xs text-muted-foreground">Gauche</Label><Input type="number" min={0} placeholder="0" value={heightLeft} onChange={(e) => setHeightLeft(e.target.value)} /></div>
                        <div><Label className="text-xs text-muted-foreground">Façade</Label><Input type="number" min={0} placeholder="0" value={heightFacade} onChange={(e) => setHeightFacade(e.target.value)} /></div>
                        <div><Label className="text-xs text-muted-foreground">Droite</Label><Input type="number" min={0} placeholder="0" value={heightRight} onChange={(e) => setHeightRight(e.target.value)} /></div>
                      </div>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                      <p className="text-sm font-medium text-foreground">Arrière</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div><Label className="text-xs text-muted-foreground">Gauche</Label><Input type="number" min={0} placeholder="0" value={heightBackLeft} onChange={(e) => setHeightBackLeft(e.target.value)} /></div>
                        <div><Label className="text-xs text-muted-foreground">Fond</Label><Input type="number" min={0} placeholder="0" value={heightBack} onChange={(e) => setHeightBack(e.target.value)} /></div>
                        <div><Label className="text-xs text-muted-foreground">Droite</Label><Input type="number" min={0} placeholder="0" value={heightBackRight} onChange={(e) => setHeightBackRight(e.target.value)} /></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2"><Label>Largeur (pieds)</Label><Input type="number" min={0} placeholder="2" value={width} onChange={(e) => setWidth(e.target.value)} /></div>

              {/* Bushes */}
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

              {/* Rabais — only displayed if user adds one. Mirrors the Extras pattern. */}
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
                      onChange={(e) => updateDiscount(d.id, "description", e.target.value)}
                      className="flex-1"
                    />
                    <Select
                      value={d.type}
                      onValueChange={(v) => updateDiscount(d.id, "type", v as DiscountType)}
                    >
                      <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
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
                      onChange={(e) => updateDiscount(d.id, "value", Number(e.target.value))}
                      className="w-24"
                    />
                    <span className="text-xs text-muted-foreground w-16 text-right">
                      −${(discountAmounts[i] ?? 0).toFixed(2)}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => removeDiscount(d.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary + Actions – middle */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" /> Résumé</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Pieds linéaires</span><span>{totalLinearFeet} pi</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Prix/pied ({cutTypeLabel})</span><span>${pricePerFoot}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Base</span><span>${basePrice.toFixed(2)}</span></div>
              {bushesTotal > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Bushes ({totalBushesCount})</span><span>${bushesTotal.toFixed(2)}</span></div>}
              {extrasPrice > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Extras</span><span>${extrasPrice}</span></div>}
              {(twoSidesLeft || twoSidesFacade || twoSidesRight || twoSidesBackLeft || twoSidesBack || twoSidesBackRight) && (
                <div className="flex justify-between text-sm text-amber-600"><span>Mult. deux côtés (×{twoSidesMult})</span><span>Appliqué</span></div>
              )}
              {heightMultiplierApplied && <div className="flex justify-between text-sm text-amber-600"><span>Mult. hauteur (×{p.height_multiplier})</span><span>Appliqué</span></div>}
              {widthMultiplierApplied && <div className="flex justify-between text-sm text-amber-600"><span>Mult. largeur (×{p.width_multiplier})</span><span>Appliqué</span></div>}
              {discountTotal > 0 && (
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Rabais ({discounts.length})</span>
                  <span>−${discountTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t pt-3 flex justify-between font-bold text-lg"><span>Total</span><span className="text-primary">${totalPrice.toFixed(2)}</span></div>

              <Button variant="outline" className="w-full" onClick={handleDownloadPdf}>
                <Download className="h-4 w-4 mr-2" /> Télécharger PDF
              </Button>
              <Button variant="outline" className="w-full" onClick={handleOpenEmailDialog}>
                <Mail className="h-4 w-4 mr-2" /> Envoyer par email
              </Button>
              <Button className="w-full" disabled={!clientId || insertEstimation.isPending} onClick={handleCreateEstimation}>
                {insertEstimation.isPending ? "Création…" : "Créer estimation"}
              </Button>
            </CardContent>
          </Card>

          <EstimationHistory estimations={estimations} customers={customers} params={params ?? null} />
        </div>

        {/* Live Preview – right */}
        <div className="lg:col-span-4">
          <div className="sticky top-6">
            <EstimationPreview
              customer={selectedClient}
              params={params ?? null}
              cutType={cutType}
              customPricePerFoot={useCustomPrice && numCustomPrice > 0 ? numCustomPrice : undefined}
              facadeLength={numFacade} leftLength={numLeft} rightLength={numRight} backLength={numBack}
              backLeftLength={numBackLeft} backRightLength={numBackRight}
              heightMode={heightMode as "global" | "per_side"}
              heightGlobal={numHeightGlobal} heightFacade={numHeightFacade} heightLeft={numHeightLeft}
              heightRight={numHeightRight} heightBack={numHeightBack}
              heightBackLeft={numHeightBackLeft} heightBackRight={numHeightBackRight}
              width={numWidth}
              basePrice={basePrice} bushItems={bushItems} extras={extras}
              discounts={discounts} discountAmounts={discountAmounts} discountTotal={discountTotal}
              heightMultiplierApplied={heightMultiplierApplied} widthMultiplierApplied={widthMultiplierApplied}
              heightMultiplier={p.height_multiplier} widthMultiplier={p.width_multiplier}
              bushesTotal={bushesTotal} extrasPrice={extrasPrice} totalPrice={totalPrice}
              estimationCount={estimations.length}
            />
          </div>
        </div>
      </div>

      <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau client</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Nom *</Label><Input value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="Nom complet" /></div>
            <div className="space-y-1"><Label>Téléphone</Label><Input value={newClientPhone} onChange={(e) => setNewClientPhone(formatPhoneLive(e.target.value))} placeholder="514-555-0000" inputMode="tel" maxLength={12} /></div>
            <div className="space-y-1"><Label>Email</Label><Input value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} placeholder="email@exemple.com" /></div>
            <div className="space-y-1"><Label>Adresse</Label><Input value={newClientAddress} onChange={(e) => setNewClientAddress(e.target.value)} placeholder="123 Rue Exemple" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewClientDialog(false)}>Annuler</Button>
            <Button onClick={handleCreateClient} disabled={!newClientName.trim()}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
            <p className="text-xs text-muted-foreground">L'email sera envoyé depuis Taille de haie ACF.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>Annuler</Button>
            <Button onClick={handleSendEmail} disabled={!emailTo.trim() || isSendingEmail}>
              <Mail className="h-4 w-4 mr-2" /> {isSendingEmail ? "Envoi en cours..." : "Envoyer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={(open) => { if (!open) handleCloseConfirmation(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Calculator className="h-5 w-5" /> Estimation créée avec succès!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Client</span>
                <span className="font-medium">{selectedClient?.name ?? "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">{cutTypeLabel}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pieds linéaires</span>
                <span className="font-medium">{totalLinearFeet} pi</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-primary">${totalPrice.toFixed(2)}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Un job et une facture brouillon ont été créés automatiquement.</p>
            <div className="flex flex-col gap-2">
              <Button className="w-full" onClick={() => { handleDownloadPdf(); }}>
                <Download className="h-4 w-4 mr-2" /> Télécharger le PDF
              </Button>
              <Button variant="outline" className="w-full" onClick={() => { setShowConfirmation(false); handleOpenEmailDialog(); }}>
                <Mail className="h-4 w-4 mr-2" /> Envoyer par email
              </Button>
              <Button variant="ghost" className="w-full" onClick={handleCloseConfirmation}>
                Fermer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom cut-type dialog: pick real type + custom price-per-foot */}
      <Dialog open={showCustomDialog} onOpenChange={setShowCustomDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Coupe personnalisée</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choisissez le type de coupe réel et un prix par pied personnalisé pour cette estimation. Le type sélectionné est conservé pour le calendrier et l'analyse.
            </p>
            <div className="space-y-2">
              <Label>Type de coupe réel</Label>
              <Select value={pendingCustomType} onValueChange={(v) => setPendingCustomType(v as CutType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trim">Taillage</SelectItem>
                  <SelectItem value="levelling">Nivelage</SelectItem>
                  <SelectItem value="restoration">Restauration</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Prix standard</Label>
                <Input
                  value={`$${
                    pendingCustomType === "trim"
                      ? p.price_per_foot_trim
                      : pendingCustomType === "levelling"
                        ? p.price_per_foot_levelling
                        : priceRestoration
                  }/pi`}
                  disabled
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Prix personnalisé ($/pi)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0"
                  value={pendingCustomPrice}
                  onChange={(e) => setPendingCustomPrice(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCustomDialog(false)}>Annuler</Button>
            <Button
              onClick={() => {
                const v = Number(pendingCustomPrice);
                if (!v || v <= 0) {
                  toast.error("Entrez un prix par pied valide");
                  return;
                }
                setCutType(pendingCustomType);
                setCustomCutPrice(pendingCustomPrice);
                setUseCustomPrice(true);
                setShowCustomDialog(false);
              }}
            >
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EstimationPage;
