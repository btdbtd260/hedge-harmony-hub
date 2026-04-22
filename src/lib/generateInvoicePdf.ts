import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { DbInvoice, DbCustomer, DbJob, DbParameters } from "@/hooks/useSupabaseData";
import { formatDateQC } from "@/lib/utils";
import { loadLogoForPdf, fitLogo } from "@/lib/loadLogoForPdf";

export interface InvoicePdfData {
  invoice: DbInvoice;
  customer: DbCustomer;
  job: DbJob | null;
  params: DbParameters | null;
  invoiceNumber: string;
  description?: string;
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<jsPDF> {
  const { invoice, customer, job, params, invoiceNumber, description } = data;
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  let y = 18;

  // ── Company header (aligned with estimation PDF) ──
  // Logo: enlarged box (75×42) for stronger brand presence
  const LOGO_BOX_W = 75;
  const LOGO_BOX_H = 42;
  const logo = await loadLogoForPdf(params?.company_logo_url);
  if (logo) {
    const { w, h } = fitLogo(logo, LOGO_BOX_W, LOGO_BOX_H);
    const offsetY = (LOGO_BOX_H - h) / 2;
    doc.addImage(logo.dataUrl, logo.format, 14, y + offsetY, w, h);
  } else {
    doc.setFillColor(230, 230, 230);
    doc.roundedRect(14, y, LOGO_BOX_W, LOGO_BOX_H, 3, 3, "F");
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text("LOGO", 14 + LOGO_BOX_W / 2, y + LOGO_BOX_H / 2 + 2, { align: "center" });
  }

  // Company info - tight to logo, dynamic width based on right block actual size
  const infoX = 14 + LOGO_BOX_W + 6;
  const companyName = params?.company_name || "HedgePro";

  const companyLines: string[] = [];
  if (params?.company_address) companyLines.push(params.company_address);
  if (params?.company_phone) companyLines.push(`Tél: ${params.company_phone}`);
  if (params?.company_email) companyLines.push(params.company_email);

  // ── Right block: title + number + date (+ payée) ──
  // Pre-measure to get the actual width needed; left block adapts dynamically.
  const numberText = `N° ${invoiceNumber}`;
  const dateText = `Date: ${formatDateQC(invoice.issued_at)}`;
  const paidText = invoice.paid_at ? `Payée: ${formatDateQC(invoice.paid_at)}` : "";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  const titleW = doc.getTextWidth("FACTURE");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const numberW = doc.getTextWidth(numberText);
  const dateW = doc.getTextWidth(dateText);
  const paidW = paidText ? doc.getTextWidth(paidText) : 0;
  const rightBlockWidth = Math.max(titleW, numberW, dateW, paidW);

  // Dynamic max width for company info (with 4mm safety gap from right block)
  const maxCompanyTextWidth = Math.max(40, pageW - 14 - rightBlockWidth - infoX - 4);

  // Pre-wrap to compute total content height for vertical centering
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const nameLines = doc.splitTextToSize(companyName, maxCompanyTextWidth) as string[];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const wrappedInfoLines: string[][] = companyLines.map(line =>
    doc.splitTextToSize(line, maxCompanyTextWidth) as string[]
  );
  const totalInfoLines = wrappedInfoLines.reduce((s, arr) => s + arr.length, 0);

  const contentHeight = nameLines.length * 5 + 2 + totalInfoLines * 4.5;
  const verticalOffset = Math.max(0, (LOGO_BOX_H - contentHeight) / 2);

  // Render company name
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.text(nameLines, infoX, y + verticalOffset + 5);

  // Render company info lines
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  const nameBlockHeight = nameLines.length * 5;
  let infoLineY = y + verticalOffset + 5 + nameBlockHeight + 2;
  wrappedInfoLines.forEach(arr => {
    doc.text(arr, infoX, infoLineY);
    infoLineY += arr.length * 4.5;
  });

  // Title block right - vertically centered (matches estimation)
  const rightVerticalOffset = (LOGO_BOX_H - 22) / 2;

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("FACTURE", pageW - 14, y + rightVerticalOffset + 6, { align: "right" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  doc.text(numberText, pageW - 14, y + rightVerticalOffset + 14, { align: "right" });
  doc.text(dateText, pageW - 14, y + rightVerticalOffset + 20, { align: "right" });
  if (paidText) {
    doc.text(paidText, pageW - 14, y + rightVerticalOffset + 26, { align: "right" });
  }

  y += LOGO_BOX_H + 8;

  // ── Divider ──
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.line(14, y, pageW - 14, y);
  y += 10;

  // ── Client section ──
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Facturer à:", 14, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60);
  doc.text(customer.name, 14, y);
  y += 5;
  if (customer.address) { doc.text(customer.address, 14, y); y += 5; }
  if (customer.phone) { doc.text(`Tél: ${customer.phone}`, 14, y); y += 5; }
  if (customer.email) { doc.text(customer.email, 14, y); y += 5; }

  y += 5;

  // ── Job details table ──
  const tableBody: string[][] = [];

  if (job) {
    const cutLabel = job.cut_type === "levelling" ? "Nivelage" : "Taille";
    const dateStr = job.scheduled_date || "—";
    const duration = job.total_duration_minutes ? `${job.total_duration_minutes} min` : "—";
    const descText = description || `Service de ${cutLabel.toLowerCase()} de haies`;

    tableBody.push([descText, dateStr, cutLabel, duration, `$${Number(invoice.amount).toFixed(2)}`]);
  } else {
    tableBody.push([description || "Service de taille de haies", "—", "—", "—", `$${Number(invoice.amount).toFixed(2)}`]);
  }

  autoTable(doc, {
    startY: y,
    head: [["Description", "Date", "Type", "Durée", "Montant"]],
    body: tableBody,
    theme: "grid",
    headStyles: {
      fillColor: [45, 45, 45],
      textColor: 255,
      fontSize: 9,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [50, 50, 50],
    },
    columnStyles: {
      0: { cellWidth: 70 },
      4: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: 14, right: 14 },
  });

  // Total
  y = (doc as any).lastAutoTable.finalY + 10;
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(pageW - 80, y - 5, 66, 22, 2, 2, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  doc.text("Total dû:", pageW - 76, y + 3);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(`$${Number(invoice.amount).toFixed(2)}`, pageW - 18, y + 3, { align: "right" });

  // Status
  y += 16;
  const isPaid = invoice.status === "paid";
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(isPaid ? 34 : 180, isPaid ? 139 : 130, isPaid ? 34 : 0);
  doc.text(`Statut: ${isPaid ? "PAYÉE" : "IMPAYÉE"}`, pageW - 18, y, { align: "right" });

  // ── Notes ──
  y += 15;
  doc.setDrawColor(200);
  doc.line(14, y, pageW - 14, y);
  y += 8;
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(120);
  doc.text("Merci pour votre confiance!", 14, y);
  doc.text("Paiement dû à la réception de la facture.", 14, y + 5);

  return doc;
}

export async function downloadInvoicePdf(data: InvoicePdfData) {
  const doc = await generateInvoicePdf(data);
  const fileName = `facture-${data.invoiceNumber}-${data.customer.name.replace(/\s+/g, "_")}.pdf`;
  doc.save(fileName);
}

export function getInvoiceNumber(index: number, issuedAt: string): string {
  const d = new Date(issuedAt);
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `INV-${dateStr}-${String(index + 1).padStart(3, "0")}`;
}
