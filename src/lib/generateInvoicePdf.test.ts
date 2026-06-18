import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateInvoicePdf, getBillingDisplayLines, getInvoiceNumber } from "./generateInvoicePdf";
import { resolveBillingInfo } from "./billingInfo";
import type { BillingInfo } from "@/types";
import type { InvoicePdfData } from "./generateInvoicePdf";

// ── Mock resolveBillingInfo ──
vi.mock("./billingInfo", () => ({
  resolveBillingInfo: vi.fn(),
}));

// ── Base test data ──
const BASE_CUSTOMER = {
  id: "cust-1",
  name: "Jean Dupont",
  address: "123 Rue Principale",
  phone: "+1-555-0100",
  email: "jean@example.com",
  active_year: 2024,
  billing_info: null as BillingInfo | null,
  created_at: "2024-01-01",
  hidden: false,
  status: "active",
};

const BASE_INVOICE = {
  id: "inv-1",
  job_id: "job-1",
  client_id: "cust-1",
  amount: 150.0,
  status: "unpaid" as const,
  issued_at: "2024-06-15",
  paid_at: null,
  pdf_url: null,
};

const BASE_JOB = {
  id: "job-1",
  client_id: "cust-1",
  estimation_id: "est-1",
  status: "completed" as const,
  scheduled_date: "2024-06-14",
  cut_type: "trim" as const,
  total_duration_minutes: 120,
  start_time: "08:00",
  end_time: "10:00",
  before_photos: [] as string[],
  after_photos: [] as string[],
  measurement_snapshot: {
    facade_length: 10,
    left_length: 5,
    right_length: 5,
    back_length: 0,
    height_mode: "global" as const,
    height_global: 2,
    height_facade: 2,
    height_left: 2,
    height_right: 2,
    height_back: 0,
    width: 0,
  },
  estimated_profit: 100,
  real_profit: null,
};

const BASE_PARAMS: Record<string, any> = {
  company_name: "HedgePro Inc.",
  company_number: "",
  company_phone: "+1-888-555-0199",
  company_email: "info@hedgepro.com",
  company_logo_url: null,
};

function makeData(overrides?: Partial<InvoicePdfData>): InvoicePdfData {
  return {
    invoice: { ...BASE_INVOICE },
    customer: overrides?.customer ?? { ...BASE_CUSTOMER },
    job: overrides?.job ?? { ...BASE_JOB },
    params: overrides?.params ?? { ...BASE_PARAMS },
    invoiceNumber: overrides?.invoiceNumber ?? "INV-20240615-001",
    description: overrides?.description,
  };
}

// ============================================================
// getBillingDisplayLines
// ============================================================
describe("getBillingDisplayLines", () => {
  it("returns name, address, phone, email when all present", () => {
    const info: BillingInfo = {
      name: "SARL Dupont",
      address: "456 Avenue des Affaires",
      phone: "+1-555-0999",
      email: "contact@dupont-sarl.com",
      tax_id: "",
    };
    const lines = getBillingDisplayLines(info);
    expect(lines).toEqual([
      "SARL Dupont",
      "456 Avenue des Affaires",
      "Tél: +1-555-0999",
      "contact@dupont-sarl.com",
    ]);
  });

  it("includes N° de taxes / tax_id line when tax_id is present and showTaxes is true", () => {
    const info: BillingInfo = {
      name: "SARL Dupont",
      address: "456 Avenue des Affaires",
      phone: "+1-555-0999",
      email: "contact@dupont-sarl.com",
      tax_id: "FR12345678901",
    };
    const lines = getBillingDisplayLines(info, true);
    expect(lines).toContain("N° de taxes: FR12345678901");
    expect(lines).toHaveLength(5);
  });

  it("omits address when empty", () => {
    const info: BillingInfo = {
      name: "SARL Dupont",
      address: "",
      phone: "+1-555-0999",
      email: "contact@dupont-sarl.com",
      tax_id: "",
    };
    const lines = getBillingDisplayLines(info);
    expect(lines).toEqual([
      "SARL Dupont",
      "Tél: +1-555-0999",
      "contact@dupont-sarl.com",
    ]);
  });

  it("omits phone when empty", () => {
    const info: BillingInfo = {
      name: "SARL Dupont",
      address: "456 Avenue des Affaires",
      phone: "",
      email: "contact@dupont-sarl.com",
      tax_id: "",
    };
    const lines = getBillingDisplayLines(info);
    expect(lines).toEqual([
      "SARL Dupont",
      "456 Avenue des Affaires",
      "contact@dupont-sarl.com",
    ]);
  });

  it("omits email when empty", () => {
    const info: BillingInfo = {
      name: "SARL Dupont",
      address: "456 Avenue des Affaires",
      phone: "+1-555-0999",
      email: "",
      tax_id: "",
    };
    const lines = getBillingDisplayLines(info);
    expect(lines).toEqual([
      "SARL Dupont",
      "456 Avenue des Affaires",
      "Tél: +1-555-0999",
    ]);
  });

  it("omits tax_id when empty", () => {
    const info: BillingInfo = {
      name: "SARL Dupont",
      address: "456 Avenue des Affaires",
      phone: "+1-555-0999",
      email: "contact@dupont-sarl.com",
      tax_id: "",
    };
    const lines = getBillingDisplayLines(info);
    expect(lines).not.toContain("N° de taxes");
  });

  it("handles minimal info: only name", () => {
    const info: BillingInfo = {
      name: "SARL Dupont",
      address: "",
      phone: "",
      email: "",
      tax_id: "",
    };
    const lines = getBillingDisplayLines(info);
    expect(lines).toEqual(["SARL Dupont"]);
  });

  it("prefixes phone with Tél:", () => {
    const info: BillingInfo = {
      name: "SARL Dupont",
      address: "",
      phone: "+1-555-0999",
      email: "",
      tax_id: "",
    };
    const lines = getBillingDisplayLines(info);
    expect(lines[1]).toMatch(/^Tél:/);
  });

  // ── commercial_name ──

  it("includes Nom commercial: line when commercial_name is present", () => {
    const info: BillingInfo = {
      name: "SARL Dupont",
      address: "456 Avenue des Affaires",
      phone: "+1-555-0999",
      email: "contact@dupont-sarl.com",
      tax_id: "",
      commercial_name: "Dupont Élagage Pro",
    };
    const lines = getBillingDisplayLines(info);
    expect(lines).toContain("Nom commercial: Dupont Élagage Pro");
  });

  it("places Nom commercial: right after the name line", () => {
    const info: BillingInfo = {
      name: "SARL Dupont",
      address: "",
      phone: "",
      email: "",
      tax_id: "",
      commercial_name: "Dupont Élagage Pro",
    };
    const lines = getBillingDisplayLines(info);
    expect(lines[0]).toBe("SARL Dupont");
    expect(lines[1]).toBe("Nom commercial: Dupont Élagage Pro");
  });

  it("omits Nom commercial: when commercial_name is undefined", () => {
    const info: BillingInfo = {
      name: "SARL Dupont",
      address: "",
      phone: "",
      email: "",
      tax_id: "",
      commercial_name: undefined,
    };
    const lines = getBillingDisplayLines(info);
    expect(lines).not.toContain("Nom commercial:");
    expect(lines).toEqual(["SARL Dupont"]);
  });

  it("omits Nom commercial: when commercial_name is empty", () => {
    const info: BillingInfo = {
      name: "SARL Dupont",
      address: "",
      phone: "",
      email: "",
      tax_id: "",
      commercial_name: "",
    };
    const lines = getBillingDisplayLines(info);
    expect(lines).not.toContain("Nom commercial:");
    expect(lines).toEqual(["SARL Dupont"]);
  });

  // ── show_taxes ──

  it("includes N° de taxes when showTaxes is true and tax_id is present", () => {
    const info: BillingInfo = {
      name: "SARL Dupont",
      address: "",
      phone: "",
      email: "",
      tax_id: "FR12345678901",
    };
    const lines = getBillingDisplayLines(info, true);
    expect(lines).toContain("N° de taxes: FR12345678901");
  });

  it("omits N° de taxes when showTaxes is false even if tax_id present", () => {
    const info: BillingInfo = {
      name: "SARL Dupont",
      address: "",
      phone: "",
      email: "",
      tax_id: "FR12345678901",
    };
    const lines = getBillingDisplayLines(info, false);
    expect(lines).not.toContain("N° de taxes");
  });

  it("omits N° de taxes when showTaxes is undefined even if tax_id present", () => {
    const info: BillingInfo = {
      name: "SARL Dupont",
      address: "",
      phone: "",
      email: "",
      tax_id: "FR12345678901",
    };
    const lines = getBillingDisplayLines(info);
    expect(lines).not.toContain("N° de taxes");
  });

  it("omits N° de taxes when showTaxes is true but tax_id is empty", () => {
    const info: BillingInfo = {
      name: "SARL Dupont",
      address: "",
      phone: "",
      email: "",
      tax_id: "",
    };
    const lines = getBillingDisplayLines(info, true);
    expect(lines).not.toContain("N° de taxes");
  });
});

// ============================================================
// generateInvoicePdf — billing info integration
// ============================================================
describe("generateInvoicePdf — billing info", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls resolveBillingInfo with the customer", async () => {
    const mockResolved: BillingInfo = {
      name: "Jean Dupont",
      address: "123 Rue Principale",
      phone: "+1-555-0100",
      email: "jean@example.com",
      tax_id: "",
    };
    vi.mocked(resolveBillingInfo).mockReturnValue(mockResolved);

    const data = makeData();
    await generateInvoicePdf(data);

    expect(resolveBillingInfo).toHaveBeenCalledTimes(1);
    expect(resolveBillingInfo).toHaveBeenCalledWith(data.customer);
  });

  it("renders billing_info name and address instead of customer fields", async () => {
    const mockResolved: BillingInfo = {
      name: "SARL Dupont Entreprise",
      address: "456 Avenue des Affaires",
      phone: "+1-555-0999",
      email: "contact@dupont-sarl.com",
      tax_id: "",
    };
    vi.mocked(resolveBillingInfo).mockReturnValue(mockResolved);

    const data = makeData();
    const doc = await generateInvoicePdf(data);
    const pdfStr = extractPdfText(doc);

    // Should use billing info name/address, not customer name
    expect(pdfStr).toContain("SARL Dupont Entreprise");
    expect(pdfStr).toContain("456 Avenue des Affaires");
  });

  it("renders N° de taxes line when tax_id is present and show_taxes=true", async () => {
    const mockResolved: BillingInfo = {
      name: "SARL Dupont",
      address: "456 Avenue des Affaires",
      phone: "+1-555-0999",
      email: "contact@dupont-sarl.com",
      tax_id: "FR12345678901",
    };
    vi.mocked(resolveBillingInfo).mockReturnValue(mockResolved);

    const data = makeData({ params: { ...BASE_PARAMS, show_taxes: true } });
    const doc = await generateInvoicePdf(data);
    const pdfStr = extractPdfText(doc);

    expect(pdfStr).toContain("N° de taxes");
    expect(pdfStr).toContain("FR12345678901");
  });

  it("does NOT render N° de taxes line when tax_id is empty", async () => {
    const mockResolved: BillingInfo = {
      name: "Jean Dupont",
      address: "123 Rue Principale",
      phone: "+1-555-0100",
      email: "jean@example.com",
      tax_id: "",
    };
    vi.mocked(resolveBillingInfo).mockReturnValue(mockResolved);

    const data = makeData();
    const doc = await generateInvoicePdf(data);
    const pdfStr = extractPdfText(doc);

    expect(pdfStr).not.toContain("N° de taxes");
  });

  it("falls back to customer fields when billing_info resolves to default", async () => {
    const mockResolved: BillingInfo = {
      name: "Jean Dupont",
      address: "123 Rue Principale",
      phone: "+1-555-0100",
      email: "jean@example.com",
      tax_id: "",
    };
    vi.mocked(resolveBillingInfo).mockReturnValue(mockResolved);

    const data = makeData();
    const doc = await generateInvoicePdf(data);
    const pdfStr = extractPdfText(doc);

    expect(pdfStr).toContain("Jean Dupont");
    expect(pdfStr).toContain("123 Rue Principale");
    expect(pdfStr).not.toContain("N° de taxes");
  });

  it("still renders company header and total", async () => {
    const mockResolved: BillingInfo = {
      name: "Jean Dupont",
      address: "123 Rue Principale",
      phone: "+1-555-0100",
      email: "jean@example.com",
      tax_id: "",
    };
    vi.mocked(resolveBillingInfo).mockReturnValue(mockResolved);

    const data = makeData();
    const doc = await generateInvoicePdf(data);
    const pdfStr = extractPdfText(doc);

    expect(pdfStr).toContain("FACTURE");
    expect(pdfStr).toContain("HedgePro");
    expect(pdfStr).toContain("INV-20240615-001");
    expect(pdfStr).toContain("$150.00");
  });

  it("works with null job (no job details table)", async () => {
    const mockResolved: BillingInfo = {
      name: "Jean Dupont",
      address: "123 Rue Principale",
      phone: "+1-555-0100",
      email: "jean@example.com",
      tax_id: "",
    };
    vi.mocked(resolveBillingInfo).mockReturnValue(mockResolved);

    const data = makeData({ job: null });
    const doc = await generateInvoicePdf(data);
    const pdfStr = extractPdfText(doc);

    expect(pdfStr).toContain("FACTURE");
    expect(pdfStr).toContain("Jean Dupont");
    expect(pdfStr).toContain("$150.00");
  });

  // ── commercial_name in PDF ──

  it("renders Nom commercial: line in PDF when commercial_name is present", async () => {
    const mockResolved: BillingInfo = {
      name: "SARL Dupont",
      address: "456 Avenue des Affaires",
      phone: "+1-555-0999",
      email: "contact@dupont-sarl.com",
      tax_id: "",
      commercial_name: "Dupont Élagage Pro",
    };
    vi.mocked(resolveBillingInfo).mockReturnValue(mockResolved);

    const data = makeData();
    const doc = await generateInvoicePdf(data);
    const pdfStr = extractPdfText(doc);

    expect(pdfStr).toContain("Nom commercial: Dupont Élagage Pro");
    expect(pdfStr).toContain("SARL Dupont");
  });

  it("does NOT render Nom commercial: line when commercial_name is absent", async () => {
    const mockResolved: BillingInfo = {
      name: "SARL Dupont",
      address: "456 Avenue des Affaires",
      phone: "+1-555-0999",
      email: "contact@dupont-sarl.com",
      tax_id: "",
    };
    vi.mocked(resolveBillingInfo).mockReturnValue(mockResolved);

    const data = makeData();
    const doc = await generateInvoicePdf(data);
    const pdfStr = extractPdfText(doc);

    expect(pdfStr).not.toContain("Nom commercial:");
  });

  // ── show_taxes in PDF ──

  it("renders N° de taxes when show_taxes=true and tax_id present", async () => {
    const mockResolved: BillingInfo = {
      name: "SARL Dupont",
      address: "456 Avenue des Affaires",
      phone: "+1-555-0999",
      email: "contact@dupont-sarl.com",
      tax_id: "FR12345678901",
    };
    vi.mocked(resolveBillingInfo).mockReturnValue(mockResolved);

    const data = makeData({ params: { ...BASE_PARAMS, show_taxes: true } });
    const doc = await generateInvoicePdf(data);
    const pdfStr = extractPdfText(doc);

    expect(pdfStr).toContain("N° de taxes: FR12345678901");
  });

  it("does NOT render N° de taxes when show_taxes=false even if tax_id present", async () => {
    const mockResolved: BillingInfo = {
      name: "SARL Dupont",
      address: "456 Avenue des Affaires",
      phone: "+1-555-0999",
      email: "contact@dupont-sarl.com",
      tax_id: "FR12345678901",
    };
    vi.mocked(resolveBillingInfo).mockReturnValue(mockResolved);

    const data = makeData({ params: { ...BASE_PARAMS, show_taxes: false } });
    const doc = await generateInvoicePdf(data);
    const pdfStr = extractPdfText(doc);

    expect(pdfStr).not.toContain("N° de taxes");
  });

  it("does NOT render N° de taxes when show_taxes is absent from params", async () => {
    const mockResolved: BillingInfo = {
      name: "SARL Dupont",
      address: "456 Avenue des Affaires",
      phone: "+1-555-0999",
      email: "contact@dupont-sarl.com",
      tax_id: "FR12345678901",
    };
    vi.mocked(resolveBillingInfo).mockReturnValue(mockResolved);

    const data = makeData({ params: { ...BASE_PARAMS } }); // show_taxes not set
    const doc = await generateInvoicePdf(data);
    const pdfStr = extractPdfText(doc);

    expect(pdfStr).not.toContain("N° de taxes");
  });

  it("does NOT render N° de taxes when show_taxes=true but tax_id is empty", async () => {
    const mockResolved: BillingInfo = {
      name: "Jean Dupont",
      address: "123 Rue Principale",
      phone: "+1-555-0100",
      email: "jean@example.com",
      tax_id: "",
    };
    vi.mocked(resolveBillingInfo).mockReturnValue(mockResolved);

    const data = makeData({ params: { ...BASE_PARAMS, show_taxes: true } });
    const doc = await generateInvoicePdf(data);
    const pdfStr = extractPdfText(doc);

    expect(pdfStr).not.toContain("N° de taxes");
  });
});

// ============================================================
// getInvoiceNumber (existing — verify it still works)
// ============================================================
describe("getInvoiceNumber", () => {
  it("formats invoice number correctly", () => {
    // Note: uses local timezone, so date may shift one day from UTC
    const result = getInvoiceNumber(0, "2024-06-15");
    expect(result).toMatch(/^INV-202406\d{2}-001$/);
  });

  it("pads index to 3 digits", () => {
    const result = getInvoiceNumber(12, "2024-07-01");
    // Use a regex that matches the local-timezone-rendered date
    expect(result).toMatch(/^INV-20240[67]\d{2}-013$/);
  });
});

// ── Helper: Extract text content from jsPDF document ──
function extractPdfText(doc: any): string {
  try {
    const dataUri = doc.output("datauristring");
    if (!dataUri) return "";
    const base64 = dataUri.split(",")[1];
    if (!base64) return "";
    const binaryStr = atob(base64);
    const textMatches = binaryStr.match(/\(([^)]*)\)\s*Tj/g);
    if (textMatches) {
      return textMatches
        .map((m: string) => m.replace(/^\(/, "").replace(/\)\s*Tj$/, ""))
        .join("\n");
    }
    return binaryStr;
  } catch {
    return "";
  }
}
