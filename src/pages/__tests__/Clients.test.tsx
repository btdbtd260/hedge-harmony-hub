// ============================================================
// Tests for Clients — French encoding integrity + Billing Info
// ============================================================
// TDD: Tests written FIRST (RED phase), then implementation.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Clients from "@/pages/Clients";
import fs from "fs";
import path from "path";

// ─── Mocks ───

const mockCustomers: any[] = [
  {
    id: "client-1",
    name: "Jean Dupont",
    phone: "514-555-0100",
    email: "jean@example.com",
    address: "123 Rue Principale",
    ville: "Montréal",
    status: "pending",
    hidden: false,
    created_at: "2024-01-01",
    active_year: 2025,
    billing_info: null,
  },
  {
    id: "client-2",
    name: "SARL Exemple",
    phone: "514-555-0200",
    email: "contact@exemple.com",
    address: "456 Avenue des Affaires",
    ville: "Québec",
    status: "completed",
    hidden: false,
    created_at: "2024-01-01",
    active_year: 2025,
    billing_info: {
      name: "SARL Exemple Facturation",
      address: "789 Boulevard du Commerce",
      phone: "514-555-0999",
      email: "factures@exemple.com",
      tax_id: "FR12345678901",
    },
  },
];
const mockJobs: any[] = [
  {
    id: "job-1",
    client_id: "client-1",
    status: "scheduled",
    cut_type: "trim",
    scheduled_date: "2025-06-15",
    estimated_profit: 500,
  },
  {
    id: "job-2",
    client_id: "client-2",
    status: "completed",
    cut_type: "levelling",
    scheduled_date: "2025-05-01",
    estimated_profit: 1200,
  },
];
const mockMutateAsync = vi.fn();

vi.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: "/clients" }),
  useNavigate: () => vi.fn(),
}));

vi.mock("@/hooks/useSupabaseData", () => ({
  useCustomers: () => ({ data: mockCustomers, isLoading: false }),
  useJobs: () => ({ data: mockJobs, isLoading: false }),
  useInsertCustomer: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useUpdateCustomer: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useHideCustomer: () => ({ mutateAsync: mockMutateAsync }),
  useRestoreCustomer: () => ({ mutateAsync: mockMutateAsync }),
  useDeleteCustomerCascade: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/clients/AddressAutocomplete", () => ({
  AddressAutocomplete: ({ value, onChange, placeholder }: any) => (
    <input
      data-testid="address-autocomplete"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
}));

// ─── Tests ───

describe("Clients — French encoding integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Source file encoding check ──

  it("source file has no mojibake corruption patterns", () => {
    const filePath = path.resolve(__dirname, "../../pages/Clients.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    // Known corruption patterns from double-encoded UTF-8
    const corruptPatterns = [
      "Ã©",  // should be é
      "Ã¨",  // should be è
      "Ã ",  // should be à (with space)
      "Ã ",   // should be à (with space, lowercase)
      "Ã‰",  // should be É
      "Ã€",  // should be À
      "ÃŠ",  // should be Ê
      "Ãš",  // should be Ù
      "Ã»",  // should be û
      "Ã´",  // should be ô
      "Ã®",  // should be î
      "Ã§",  // should be ç
      "Â«",  // should be «
      "Â»",  // should be »
      "Â·",  // should be ·
      "â€”", // should be —
      "â€“", // should be –
      "â€¦", // should be …
      "â€™", // should be '
      "â€œ", // should be "
      "â€",  // generic catch for â€ patterns
    ];

    const violations = corruptPatterns
      .filter((pattern) => content.includes(pattern))
      .map((p) => `  Found "${p}" in Clients.tsx`);

    if (violations.length > 0) {
      console.warn("Encoding corruptions found:\n" + violations.join("\n"));
    }

    expect(violations).toHaveLength(0);
  });

  // ── Rendered French text checks ──

  it("renders 'Gérez votre liste de clients' correctly", () => {
    render(<Clients />);
    expect(screen.getByText("Gérez votre liste de clients")).toBeInTheDocument();
  });

  it("renders 'Nouveau client' button label correctly", () => {
    render(<Clients />);
    expect(screen.getByText("Nouveau client")).toBeInTheDocument();
  });

  it("renders 'Rechercher un client…' placeholder correctly", () => {
    render(<Clients />);
    const input = screen.getByPlaceholderText("Rechercher un client…");
    expect(input).toBeInTheDocument();
  });

  it("renders 'Voir masqués' button text correctly", () => {
    render(<Clients />);
    // The button with "Voir masqués" is rendered when showHidden is false
    const voirBtn = screen.getByText("Voir masqués");
    expect(voirBtn).toBeInTheDocument();
  });

  it("renders 'Clients' heading correctly", () => {
    render(<Clients />);
    const heading = screen.getByRole("heading", { name: /^clients$/i });
    expect(heading).toBeInTheDocument();
  });

  it("renders customer cards when customers exist", () => {
    render(<Clients />);
    // Customers with scheduled/completed jobs are shown in the "clients" tab
    expect(screen.getByText("Jean Dupont")).toBeInTheDocument();
    expect(screen.getByText("SARL Exemple")).toBeInTheDocument();
  });
});

// ─── Billing Info Tests (TDD Phase 2) ───

describe("Clients — Billing Info UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Add client dialog", () => {
    it("shows billing info section when add dialog is opened", async () => {
      const user = userEvent.setup();
      render(<Clients />);

      await user.click(screen.getByText("Nouveau client"));

      expect(screen.getByText("Informations de facturation")).toBeInTheDocument();
    });

    it("renders billing name field in add dialog", async () => {
      const user = userEvent.setup();
      render(<Clients />);

      await user.click(screen.getByText("Nouveau client"));

      expect(screen.getByPlaceholderText("Nom de l'entreprise")).toBeInTheDocument();
    });

    it("renders billing address field in add dialog", async () => {
      const user = userEvent.setup();
      render(<Clients />);

      await user.click(screen.getByText("Nouveau client"));

      expect(screen.getByPlaceholderText("Adresse de facturation")).toBeInTheDocument();
    });

    it("renders billing phone field in add dialog", async () => {
      const user = userEvent.setup();
      render(<Clients />);

      await user.click(screen.getByText("Nouveau client"));

      // billing phone has the same placeholder as regular phone; check for label text
      expect(screen.getByText("Téléphone de facturation")).toBeInTheDocument();
      // Also verify there are two phone inputs (one regular, one billing)
      const phoneInputs = screen.getAllByPlaceholderText("514-555-0000");
      expect(phoneInputs.length).toBe(2);
    });

    it("renders billing email field in add dialog", async () => {
      const user = userEvent.setup();
      render(<Clients />);

      await user.click(screen.getByText("Nouveau client"));

      expect(screen.getByPlaceholderText("factures@exemple.com")).toBeInTheDocument();
    });

    it("renders tax id field in add dialog", async () => {
      const user = userEvent.setup();
      render(<Clients />);

      await user.click(screen.getByText("Nouveau client"));

      expect(screen.getByPlaceholderText("FR12345678901")).toBeInTheDocument();
    });

    it("passes billing_info to insertCustomer when creating client", async () => {
      const user = userEvent.setup();
      render(<Clients />);

      await user.click(screen.getByText("Nouveau client"));

      // Fill basic fields
      const nameInput = screen.getByPlaceholderText("Nom complet");
      await user.type(nameInput, "Test Client");
      const phoneInput = screen.getAllByPlaceholderText("514-555-0000")[0];
      await user.type(phoneInput, "5145551234");
      const emailInput = screen.getByPlaceholderText("email@exemple.com");
      await user.type(emailInput, "test@example.com");
      const addressInput = screen.getByTestId("address-autocomplete");
      await user.type(addressInput, "123 Rue Test");

      // Fill billing info fields
      const billingNameInput = screen.getByPlaceholderText("Nom de l'entreprise");
      await user.type(billingNameInput, "SARL Test");
      const billingAddressInput = screen.getByPlaceholderText("Adresse de facturation");
      await user.type(billingAddressInput, "456 Boulevard Test");
      const billingPhoneInput = screen.getAllByPlaceholderText("514-555-0000")[1];
      await user.type(billingPhoneInput, "5145559999");
      const billingEmailInput = screen.getByPlaceholderText("factures@exemple.com");
      await user.type(billingEmailInput, "factures@test.com");
      const taxIdInput = screen.getByPlaceholderText("FR12345678901");
      await user.type(taxIdInput, "FR987654321");

      // Submit
      await user.click(screen.getByText("Créer"));

      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Test Client",
          billing_info: expect.objectContaining({
            name: "SARL Test",
            address: "456 Boulevard Test",
            phone: "514-555-9999",
            email: "factures@test.com",
            tax_id: "FR987654321",
          }),
        })
      );
    });

    it("passes empty billing_info when billing fields are empty", async () => {
      const user = userEvent.setup();
      render(<Clients />);

      await user.click(screen.getByText("Nouveau client"));

      // Fill only basic required fields
      const nameInput = screen.getByPlaceholderText("Nom complet");
      await user.type(nameInput, "Test Client");
      const addressInput = screen.getByTestId("address-autocomplete");
      await user.type(addressInput, "123 Rue Test");

      // Submit without filling billing info
      await user.click(screen.getByText("Créer"));

      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Test Client",
          billing_info: expect.objectContaining({
            name: "",
            address: "",
            phone: "",
            email: "",
            tax_id: "",
          }),
        })
      );
    });
  });

  describe("Edit client dialog", () => {
    it("shows billing info section when edit dialog is opened", async () => {
      const user = userEvent.setup();
      render(<Clients />);

      // Open client detail first
      const clientCard = screen.getByText("Jean Dupont");
      await user.click(clientCard);

      // Click "Modifier" button
      const editButton = screen.getByText("Modifier");
      await user.click(editButton);

      expect(screen.getByText("Informations de facturation")).toBeInTheDocument();
    });

    it("pre-fills billing fields from existing billing_info", async () => {
      const user = userEvent.setup();
      render(<Clients />);

      // Open client with billing_info
      const clientCard = screen.getByText("SARL Exemple");
      await user.click(clientCard);

      // Click "Modifier" button
      const editButton = screen.getByText("Modifier");
      await user.click(editButton);

      // Check billing fields are pre-filled
      expect(screen.getByDisplayValue("SARL Exemple Facturation")).toBeInTheDocument();
      expect(screen.getByDisplayValue("789 Boulevard du Commerce")).toBeInTheDocument();
      expect(screen.getByDisplayValue("514-555-0999")).toBeInTheDocument();
      expect(screen.getByDisplayValue("factures@exemple.com")).toBeInTheDocument();
      expect(screen.getByDisplayValue("FR12345678901")).toBeInTheDocument();
    });

    it("pre-fills billing fields from customer fields when billing_info is null", async () => {
      const user = userEvent.setup();
      render(<Clients />);

      // Open client without billing_info
      const clientCard = screen.getByText("Jean Dupont");
      await user.click(clientCard);

      // Click "Modifier" button
      const editButton = screen.getByText("Modifier");
      await user.click(editButton);

      // Billing fields should be pre-filled from customer fields
      // billing name input has placeholder "Nom de l'entreprise"
      const billingNameInput = screen.getByPlaceholderText("Nom de l'entreprise") as HTMLInputElement;
      expect(billingNameInput.value).toBe("Jean Dupont");

      // billing phone has two inputs with same placeholder, use index 1
      const phoneInputs = screen.getAllByPlaceholderText("514-555-0000");
      expect((phoneInputs[1] as HTMLInputElement).value).toBe("514-555-0100");
    });

    it("passes billing_info to updateCustomer when saving edit", async () => {
      const user = userEvent.setup();
      render(<Clients />);

      // Open client detail
      const clientCard = screen.getByText("Jean Dupont");
      await user.click(clientCard);

      // Open edit dialog
      const editButton = screen.getByText("Modifier");
      await user.click(editButton);

      // Fill billing info - billing name has placeholder "Nom de l'entreprise"
      const billingNameInput = screen.getByPlaceholderText("Nom de l'entreprise");
      await user.clear(billingNameInput);
      await user.type(billingNameInput, "Updated Billing Name");
      const taxIdInput = screen.getByPlaceholderText("FR12345678901");
      await user.type(taxIdInput, "CA-12345");

      // Save
      await user.click(screen.getByText("Enregistrer"));

      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "client-1",
          billing_info: expect.objectContaining({
            name: "Updated Billing Name",
            tax_id: "CA-12345",
          }),
        })
      );
    });
  });

  describe("Client detail dialog", () => {
    it("shows billing info section when client has billing_info", async () => {
      const user = userEvent.setup();
      render(<Clients />);

      // Open client with billing_info
      const clientCard = screen.getByText("SARL Exemple");
      await user.click(clientCard);

      expect(screen.getByText("Facturation")).toBeInTheDocument();
    });

    it("displays billing name in client detail", async () => {
      const user = userEvent.setup();
      render(<Clients />);

      // Open client with billing_info
      const clientCard = screen.getByText("SARL Exemple");
      await user.click(clientCard);

      expect(screen.getByText("SARL Exemple Facturation")).toBeInTheDocument();
    });

    it("displays billing tax_id in client detail", async () => {
      const user = userEvent.setup();
      render(<Clients />);

      // Open client with billing_info
      const clientCard = screen.getByText("SARL Exemple");
      await user.click(clientCard);

      expect(screen.getByText("FR12345678901")).toBeInTheDocument();
    });

    it("does not show billing section when billing_info is null", async () => {
      const user = userEvent.setup();
      render(<Clients />);

      // Open client without billing_info
      const clientCard = screen.getByText("Jean Dupont");
      await user.click(clientCard);

      expect(screen.queryByText("Facturation")).not.toBeInTheDocument();
    });
  });
});
