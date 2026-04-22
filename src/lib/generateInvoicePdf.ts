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

export function generateInvoicePdf(data: InvoicePdfData): jsPDF {
  const { invoice, customer, job, params, invoiceNumber, description } = data;
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  // ── Company header ──
  // Logo placeholder
  doc.setFillColor(230, 230, 230);
  doc.roundedRect(14, y - 5, 40, 20, 3, 3, "F");
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("LOGO", 34, y + 7, { align: "center" });

  // Company info
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

  // Invoice title right-aligned
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("FACTURE", pageW - 14, y + 5, { align: "right" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  doc.text(`N° ${invoiceNumber}`, pageW - 14, y + 13, { align: "right" });
  doc.text(`Date: ${formatDateQC(invoice.issued_at)}`, pageW - 14, y + 19, { align: "right" });
  if (invoice.paid_at) {
    doc.text(`Payée: ${formatDateQC(invoice.paid_at)}`, pageW - 14, y + 25, { align: "right" });
  }

  y += 40;

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

export function downloadInvoicePdf(data: InvoicePdfData) {
  const doc = generateInvoicePdf(data);
  const fileName = `facture-${data.invoiceNumber}-${data.customer.name.replace(/\s+/g, "_")}.pdf`;
  doc.save(fileName);
}

export function getInvoiceNumber(index: number, issuedAt: string): string {
  const d = new Date(issuedAt);
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `INV-${dateStr}-${String(index + 1).padStart(3, "0")}`;
}
