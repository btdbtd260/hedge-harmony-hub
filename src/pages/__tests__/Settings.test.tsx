// ============================================================
// Tests for Settings — show_taxes toggle
// ============================================================
// TDD: Tests written FIRST (RED phase), then implementation.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Settings from "@/pages/Settings";

// ─── Hoisted mock data ───

const mockDbParams = vi.hoisted(() => ({
  id: "param-1",
  company_name: "Ma Compagnie",
  company_address: "123 Rue Principale",
  company_phone: "514-555-0100",
  company_email: "info@macompagnie.ca",
  company_website: "https://macompagnie.ca",
  company_logo_url: null,
  price_per_foot_trim: 3.5,
  price_per_foot_levelling: 5.0,
  price_per_foot_restoration: 7.0,
  bush_price: 15,
  height_multiplier_threshold: 6,
  height_multiplier: 1.5,
  width_multiplier_threshold: 4,
  width_multiplier: 1.3,
  two_sides_multiplier: 1.5,
  rounding_enabled: false,
  rounding_multiple: 5,
  maintenance_interval_days: 30,
  reminder_notification_time: "08:00",
  split_rule_profit_expense: 50,
  social_links: [],
  show_taxes: false,
  updated_at: "2026-01-01T00:00:00Z",
}));

const mockMutateAsync = vi.hoisted(() => vi.fn());

// ─── Mocks ───

vi.mock("@/hooks/useSupabaseData", () => ({
  useParameters: () => ({ data: mockDbParams, isLoading: false }),
  useUpdateParameters: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, loading: false }),
  useIsAdmin: () => ({ isAdmin: true, checking: false }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ─── Mock supabase client (Settings imports supabase directly for logo upload) ───

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() => Promise.resolve({ error: null, data: {} })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://example.com/logo.png" } })),
      })),
    },
  },
}));

// ─── Helper to navigate to Template tab ───

async function goToTemplateTab(user: ReturnType<typeof userEvent.setup>) {
  const templateTab = screen.getByRole("tab", { name: /template/i });
  await user.click(templateTab);
}

// ─── Tests ───

describe("Settings — show_taxes toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the show_taxes toggle in the Template tab", async () => {
    const user = userEvent.setup();
    render(<Settings />);

    await goToTemplateTab(user);

    // The toggle should be present — look for a label containing "taxes"
    const toggleLabel = screen.getByText(/afficher les taxes/i);
    expect(toggleLabel).toBeInTheDocument();

    // The toggle should be a Switch (role "switch")
    const toggle = screen.getByRole("switch");
    expect(toggle).toBeInTheDocument();
  });

  it("toggle is OFF by default when show_taxes is false", async () => {
    // Default mock already has show_taxes: false
    const user = userEvent.setup();
    render(<Settings />);

    await goToTemplateTab(user);

    const toggle = screen.getByRole("switch");
    expect(toggle).not.toBeChecked();
  });

  it("toggle is ON when show_taxes is true", async () => {
    // Temporarily set show_taxes to true
    const saved = mockDbParams.show_taxes;
    mockDbParams.show_taxes = true;

    const user = userEvent.setup();
    render(<Settings />);

    await goToTemplateTab(user);

    const toggle = screen.getByRole("switch");
    expect(toggle).toBeChecked();

    // Restore
    mockDbParams.show_taxes = saved;
  });

  it("toggle is OFF when show_taxes is undefined (default behaviour)", async () => {
    // Temporarily remove show_taxes
    const saved = mockDbParams.show_taxes;
    delete mockDbParams.show_taxes;

    const user = userEvent.setup();
    render(<Settings />);

    await goToTemplateTab(user);

    const toggle = screen.getByRole("switch");
    expect(toggle).not.toBeChecked();

    // Restore
    mockDbParams.show_taxes = saved;
  });

  it("toggling the switch updates the form state", async () => {
    const user = userEvent.setup();
    render(<Settings />);

    await goToTemplateTab(user);

    const toggle = screen.getByRole("switch");
    expect(toggle).not.toBeChecked();

    // Click to enable
    await user.click(toggle);
    expect(toggle).toBeChecked();

    // Click again to disable
    await user.click(toggle);
    expect(toggle).not.toBeChecked();
  });

  it("saving persists the show_taxes value", async () => {
    const user = userEvent.setup();
    render(<Settings />);

    await goToTemplateTab(user);

    // Toggle ON
    const toggle = screen.getByRole("switch");
    await user.click(toggle);
    expect(toggle).toBeChecked();

    // Click Save
    const saveButton = screen.getByRole("button", { name: /sauvegarder/i });
    await user.click(saveButton);

    // Verify that updateParams was called with show_taxes: true
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ show_taxes: true })
      );
    });
  });
});
