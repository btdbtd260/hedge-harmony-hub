import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { DbCustomer, DbParameters } from "@/hooks/useSupabaseData";
import { formatDateQC } from "@/lib/utils";
import type { EstimationExtra } from "@/types";

export interface EstimationPdfData {
  customer: DbCustomer | null;
  params: DbParameters | null;
  estimationNumber: string;
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
  bushItems: { description: string; count: number; price: number }[];
  extras: EstimationExtra[];
  heightMultiplierApplied: boolean;
  widthMultiplierApplied: boolean;
  heightMultiplier: number;
  widthMultiplier: number;
  totalPrice: number;
  date?: string;
}

export function generateEstimationPdf(data: EstimationPdfData): jsPDF {
  const { customer, params, estimationNumber, cutType, facadeLength, leftLength, rightLength, backLength,
    backLeftLength, backRightLength,
    heightMode, heightGlobal, heightFacade, heightLeft, heightRight, heightBack, width,
    basePrice, bushItems, extras, heightMultiplierApplied, widthMultiplierApplied,
    heightMultiplier, widthMultiplier, totalPrice, date } = data;

  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  // ── Company header ──
  doc.setFillColor(230, 230, 230);
  doc.roundedRect(14, y - 5, 40, 20, 3, 3, "F");
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("LOGO", 34, y + 7, { align: "center" });

  const companyName = params?.company_name || "HedgePro";
  doc.setFontSize(18);
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.text(companyName, 60, y + 4);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  const companyLines: string[] = [];
  if (params?.company_address) companyLines.push(params.company_address);
  if (params?.company_phone) companyLines.push(`Tél: ${params.company_phone}`);
  if (params?.company_email) companyLines.push(params.company_email);
  companyLines.forEach((line, i) => {
    doc.text(line, 60, y + 10 + i * 4.5);
  });

  // Title
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("ESTIMATION", pageW - 14, y + 5, { align: "right" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  doc.text(`N° ${estimationNumber}`, pageW - 14, y + 13, { align: "right" });
  doc.text(`Date: ${date || formatDateQC(new Date().toISOString())}`, pageW - 14, y + 19, { align: "right" });

  y += 40;
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.line(14, y, pageW - 14, y);
  y += 10;

  // ── Client ──
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
  y += 5;

  // ── Measurements ──
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Mesures", 14, y);
  y += 2;

  const totalFeet = facadeLength + leftLength + rightLength + backLength + backLeftLength + backRightLength;
  const cutLabel = cutType === "levelling" ? "Nivelage" : "Taille";
  const pricePerFoot = cutType === "trim" ? (params?.price_per_foot_trim ?? 4.5) : (params?.price_per_foot_levelling ?? 6);

  const measureRows = [
    ["", "Gauche", "Centre", "Droite"],
    ["Avant", `${leftLength} pi`, `${facadeLength} pi (Façade)`, `${rightLength} pi`],
    ["Arrière", `${backLeftLength} pi`, `${backLength} pi (Fond)`, `${backRightLength} pi`],
    ["Total pieds linéaires", `${totalFeet} pi`, "", ""],
  ];

  if (heightMode === "global") {
    measureRows.push(["Hauteur (globale)", `${heightGlobal} pi`]);
  } else {
    measureRows.push(["Hauteur façade", `${heightFacade} pi`]);
    measureRows.push(["Hauteur gauche", `${heightLeft} pi`]);
    measureRows.push(["Hauteur droite", `${heightRight} pi`]);
    measureRows.push(["Hauteur arrière", `${heightBack} pi`]);
  }
  measureRows.push(["Largeur", `${width} pi`]);

  autoTable(doc, {
    startY: y,
    body: measureRows,
    theme: "plain",
    styles: { fontSize: 9, textColor: [50, 50, 50], cellPadding: 2 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 80 }, 1: { halign: "right" } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Pricing breakdown ──
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Détail des coûts", 14, y);
  y += 2;

  const priceRows: string[][] = [];
  priceRows.push([`${cutLabel} — ${totalFeet} pi × $${pricePerFoot}/pi`, `$${(totalFeet * pricePerFoot).toFixed(2)}`]);

  if (heightMultiplierApplied) {
    priceRows.push([`Multiplicateur hauteur (×${heightMultiplier})`, "Appliqué"]);
  }
  if (widthMultiplierApplied) {
    priceRows.push([`Multiplicateur largeur (×${widthMultiplier})`, "Appliqué"]);
  }

  priceRows.push(["Sous-total coupe", `$${basePrice.toFixed(2)}`]);

  bushItems.forEach(b => {
    const label = b.description || "Bush";
    priceRows.push([`Bush: ${label} (×${b.count})`, `$${(b.count * b.price).toFixed(2)}`]);
  });

  extras.forEach(e => {
    if (e.description || e.price > 0) {
      priceRows.push([`Extra: ${e.description || "—"}`, `$${e.price.toFixed(2)}`]);
    }
  });

  autoTable(doc, {
    startY: y,
    body: priceRows,
    theme: "striped",
    styles: { fontSize: 9, textColor: [50, 50, 50], cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 120 }, 1: { halign: "right", fontStyle: "bold" } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // ── Total ──
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

  // ── Status badge ──
  y += 20;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(59, 130, 246);
  doc.text("Statut: ESTIMATION (non facturé)", pageW - 18, y, { align: "right" });

  // ── Footer ──
  y += 15;
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

export function downloadEstimationPdf(data: EstimationPdfData) {
  const doc = generateEstimationPdf(data);
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
