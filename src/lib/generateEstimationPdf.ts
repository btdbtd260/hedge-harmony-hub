import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { DbCustomer, DbParameters } from "@/hooks/useSupabaseData";
import { formatDateQC } from "@/lib/utils";
import { loadLogoForPdf, fitLogo } from "@/lib/loadLogoForPdf";
import type { EstimationExtra, EstimationDiscount } from "@/types";

export interface EstimationPdfData {
  customer: DbCustomer | null;
  params: DbParameters | null;
  estimationNumber: string;
  cutType: "trim" | "levelling" | "restoration";
  /** @deprecated kept for backward-compat with older saved estimations */
  customCutLabel?: string;
  /** Per-estimation override of the price-per-foot. Cut type is unchanged. */
  customPricePerFoot?: number;
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
  heightBackLeft: number;
  heightBackRight: number;
  width: number;
  basePrice: number;
  bushItems: { description: string; count: number; price: number }[];
  extras: EstimationExtra[];
  discounts?: EstimationDiscount[];
  heightMultiplierApplied: boolean;
  widthMultiplierApplied: boolean;
  heightMultiplier: number;
  widthMultiplier: number;
  totalPrice: number;
  date?: string;
  /** Optional per-side two-sides flags so the PDF can show "(2 côtés)" + ×1.5 */
  twoSides?: {
    facade?: boolean; left?: boolean; right?: boolean;
    back?: boolean; back_left?: boolean; back_right?: boolean;
  };
  /** Multiplier used when a side is "2 côtés" (defaults to 1.5) */
  twoSidesMultiplier?: number;
}

export async function generateEstimationPdf(data: EstimationPdfData): Promise<jsPDF> {
  const { customer, params, estimationNumber, cutType, facadeLength, leftLength, rightLength, backLength,
    backLeftLength, backRightLength,
    basePrice, bushItems, extras, totalPrice, date } = data;

  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  let y = 18;

  // ── Company header ──
  // Logo: enlarged box for better presence (was 60×30, now 75×42)
  const LOGO_BOX_W = 75;
  const LOGO_BOX_H = 42;
  const logo = await loadLogoForPdf(params?.company_logo_url);
  if (logo) {
    const { w, h } = fitLogo(logo, LOGO_BOX_W, LOGO_BOX_H);
    // Vertically center the logo within the box for a clean look
    const offsetY = (LOGO_BOX_H - h) / 2;
    doc.addImage(logo.dataUrl, logo.format, 14, y + offsetY, w, h);
  } else {
    doc.setFillColor(230, 230, 230);
    doc.roundedRect(14, y, LOGO_BOX_W, LOGO_BOX_H, 3, 3, "F");
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text("LOGO", 14 + LOGO_BOX_W / 2, y + LOGO_BOX_H / 2 + 2, { align: "center" });
  }

  // Company info - positioned with more space after logo and vertically centered
  const infoX = 14 + LOGO_BOX_W + 15; // Increased from 8 to 15 for better spacing
  const companyName = params?.company_name || "HedgePro";

  // Build company info lines first for height calculation
  const companyLines: string[] = [];
  if (params?.company_address) companyLines.push(params.company_address);
  if (params?.company_phone) companyLines.push(`Tél: ${params.company_phone}`);
  if (params?.company_email) companyLines.push(params.company_email);

  // Calculate vertical centering within the logo box height
  const contentHeight = 8 + (companyLines.length * 4.5); // name + lines
  const verticalOffset = (LOGO_BOX_H - contentHeight) / 2;

  doc.setFontSize(18);
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.text(companyName, infoX, y + verticalOffset + 6);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  companyLines.forEach((line, i) => {
    doc.text(line, infoX, y + verticalOffset + 12 + i * 4.5);
  });

  // Title and estimation details (right aligned, vertically centered)
  const rightVerticalOffset = (LOGO_BOX_H - 22) / 2; // 22 = height of title+number+date block

  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("ESTIMATION", pageW - 14, y + rightVerticalOffset + 6, { align: "right" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  doc.text(`N° ${estimationNumber}`, pageW - 14, y + rightVerticalOffset + 14, { align: "right" });
  doc.text(`Date: ${date || formatDateQC(new Date().toISOString())}`, pageW - 14, y + rightVerticalOffset + 20, { align: "right" });

  y += LOGO_BOX_H + 8;
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.line(14, y, pageW - 14, y);
  y += 8;

  // ── Client (unchanged) ──
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Client:", 14, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60);
  if (customer) {
    doc.text(customer.name, 14, y); y += 5;
    if (customer.address) { doc.text(customer.address, 14, y); y += 5; }
    if (customer.phone) { doc.text(`Tél: ${customer.phone}`, 14, y); y += 5; }
    if (customer.email) { doc.text(customer.email, 14, y); y += 5; }
  } else {
    doc.text("—", 14, y); y += 5;
  }
  y += 4;

  // ── Détail des coûts (now contains the structured measurement table) ──
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Détail des coûts", 14, y);
  y += 3;

  // Compute per-side pricing
  const baseLabel =
    cutType === "levelling" ? "Nivelage" :
    cutType === "restoration" ? "Restauration" :
    cutType === "trim" ? "Taillage" :
    (data.customCutLabel || "Taillage");
  const standardPrice =
    cutType === "trim" ? (params?.price_per_foot_trim ?? 4.5) :
    cutType === "levelling" ? (params?.price_per_foot_levelling ?? 6) :
    cutType === "restoration" ? ((params as any)?.price_per_foot_restoration ?? 8) :
    0;
  const pricePerFoot = data.customPricePerFoot && data.customPricePerFoot > 0 ? data.customPricePerFoot : standardPrice;
  const twoSidesMult = data.twoSidesMultiplier ?? 1.5;
  const ts = data.twoSides ?? {};

  // Build the measurement rows (only sides with length > 0).
  // Section label is shown only on the first row of each section.
  type Row = { section: string; sub: string; measure: string; subtotal: string };
  const rows: Row[] = [];

  const front: Array<{ name: string; len: number; two: boolean }> = [
    { name: "Gauche", len: leftLength, two: !!ts.left },
    { name: "Façade", len: facadeLength, two: !!ts.facade },
    { name: "Droite", len: rightLength, two: !!ts.right },
  ].filter(s => s.len > 0);

  const back: Array<{ name: string; len: number; two: boolean }> = [
    { name: "Gauche", len: backLeftLength, two: !!ts.back_left },
    { name: "Fond", len: backLength, two: !!ts.back },
    { name: "Droite", len: backRightLength, two: !!ts.back_right },
  ].filter(s => s.len > 0);

  const pushSection = (label: string, sides: typeof front) => {
    sides.forEach((s, idx) => {
      const sub = s.two ? `${s.name} (2 côtés)` : s.name;
      const measure = s.two ? `${s.len} pi (x${twoSidesMult})` : `${s.len} pi`;
      const subtotal = `$${(s.len * pricePerFoot * (s.two ? twoSidesMult : 1)).toFixed(2)}`;
      rows.push({ section: idx === 0 ? label : "", sub, measure, subtotal });
    });
  };
  pushSection("Avant", front);
  pushSection("Arrière", back);

  // Compute the measurement total (sum of all per-side subtotals shown).
  const measurementsTotal =
    front.reduce((s, x) => s + x.len * pricePerFoot * (x.two ? twoSidesMult : 1), 0) +
    back.reduce((s, x) => s + x.len * pricePerFoot * (x.two ? twoSidesMult : 1), 0);

  // Render the structured table with visible black borders and 4 columns.
  // Header gives quick context (cut type + price/pi) without changing column meaning.
  const tableHead = [[
    { content: `Section`, styles: { halign: "left" as const } },
    { content: `${baseLabel} — $${pricePerFoot}/pi`, styles: { halign: "left" as const } },
    { content: `Mesure`, styles: { halign: "right" as const } },
    { content: `Sous-total`, styles: { halign: "right" as const } },
  ]];

  const tableBody = rows.map(r => [
    { content: r.section, styles: { fontStyle: "bold" as const } },
    r.sub,
    { content: r.measure, styles: { halign: "right" as const } },
    { content: r.subtotal, styles: { halign: "right" as const, fontStyle: "bold" as const } },
  ]);

  // Final row: only the "Total mesures" cell appears under the subtotal column.
  // The first three cells are blank to keep one single box on the right.
  if (rows.length > 0) {
    tableBody.push([
      { content: "", styles: {} as any },
      { content: "", styles: {} as any },
      { content: "Total mesures", styles: { halign: "right" as const, fontStyle: "bold" as const } },
      { content: `$${measurementsTotal.toFixed(2)}`, styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: [240, 240, 240] as any } },
    ]);
  }

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableBody,
    theme: "grid",
    styles: {
      fontSize: 9,
      textColor: [30, 30, 30],
      cellPadding: 3,
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [30, 30, 30],
      fontStyle: "bold",
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 70 },
      2: { halign: "right" },
      3: { halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // ── Arbustes (only if any) ──
  if (bushItems.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Arbustes", 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60);
    bushItems.forEach((b) => {
      const label = b.description ? `${b.description} : ` : "";
      const line = `${label}${b.count} x $${b.price.toFixed(2)}`;
      const total = `$${(b.count * b.price).toFixed(2)}`;
      doc.text(line, 14, y);
      doc.text(total, pageW - 14, y, { align: "right" });
      y += 5;
    });
    y += 2;
  }

  // ── Extras (only if any) ──
  const visibleExtras = extras.filter(e => (e.description && e.description.trim() !== "") || e.price > 0);
  if (visibleExtras.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Extras", 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60);
    visibleExtras.forEach((e) => {
      doc.text(e.description || "—", 14, y);
      doc.text(`$${e.price.toFixed(2)}`, pageW - 14, y, { align: "right" });
      y += 5;
    });
    y += 2;
  }

  // ── Sous-total job ──
  const bushesTotal = bushItems.reduce((s, b) => s + b.count * b.price, 0);
  const extrasTotal = visibleExtras.reduce((s, e) => s + e.price, 0);
  // basePrice already includes height/width multipliers and per-side ×1.5,
  // so the job subtotal stays exactly aligned with the live calculation.
  const jobSubtotal = basePrice + bushesTotal + extrasTotal;

  doc.setDrawColor(180);
  doc.setLineWidth(0.3);
  doc.line(14, y, pageW - 14, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text("Sous-total job", 14, y);
  doc.text(`$${jobSubtotal.toFixed(2)}`, pageW - 14, y, { align: "right" });
  y += 6;

  // ── Rabais (only if any) ──
  // Percentages apply on the subtotal before any discounts (matches live calc).
  const discounts = data.discounts ?? [];
  if (discounts.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(20, 120, 60);
    discounts.forEach((d) => {
      const amount =
        d.type === "percent"
          ? (jobSubtotal * Math.max(0, Math.min(100, Number(d.value) || 0))) / 100
          : Math.max(0, Number(d.value) || 0);
      const label =
        d.type === "percent"
          ? `Rabais${d.description ? `: ${d.description}` : ""} (${d.value}%)`
          : `Rabais${d.description ? `: ${d.description}` : ""} ($${Number(d.value).toFixed(2)})`;
      doc.text(label, 14, y);
      doc.text(`-$${amount.toFixed(2)}`, pageW - 14, y, { align: "right" });
      y += 5;
    });
    y += 2;
  }

  // ── Total estimé (kept as black rectangle) ──
  y += 2;
  doc.setFillColor(45, 45, 45);
  doc.roundedRect(pageW - 80, y - 5, 66, 24, 2, 2, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200);
  doc.text("Total estimé:", pageW - 76, y + 4);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255);
  doc.text(`$${totalPrice.toFixed(2)}`, pageW - 18, y + 4, { align: "right" });

  // ── Footer ──
  y += 30;
  doc.setDrawColor(200);
  doc.line(14, y, pageW - 14, y);
  y += 8;
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(120);
  doc.text("Ce document est une estimation. Le prix final peut varier.", 14, y);
  doc.text("Merci pour votre confiance!", 14, y + 5);

  return doc;
}

export async function downloadEstimationPdf(data: EstimationPdfData) {
  const doc = await generateEstimationPdf(data);
  const clientName = data.customer?.name?.replace(/\s+/g, "_") || "client";
  const d = new Date();
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  doc.save(`estimation-${clientName}-${dateStr}.pdf`);
}

export function getEstimationNumber(index: number, createdAt?: string): string {
  const d = createdAt ? new Date(createdAt) : new Date();
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `EST-${dateStr}-${String(index + 1).padStart(3, "0")}`;
}
