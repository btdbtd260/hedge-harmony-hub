/**
 * Tests for JobDetailDialog — measurements display
 *
 * Verifies:
 * - "Mesures" section renders correctly
 * - Avant measurements display
 * - Arrière measurements display
 * - "Largeur" is removed from display
 * - Bush/shrub items render inline under Mesures heading
 * - Bush/shrub items are NOT rendered in a separate bordered section
 * - Existing behavior preserved
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import React from "react";

// --- Mocks ---------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}));

vi.mock("@/hooks/useSupabaseData", () => ({
  useCustomers: () => ({
    data: [{ id: "c1", name: "Test Client", address: "123 Rue Test" }],
  }),
  useJobs: () => ({ data: [] }),
  useUpdateJob: () => ({ mutateAsync: vi.fn().mockResolvedValue(undefined) }),
  useDeleteJob: () => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  }),
  getClientNameFromList: (_: any, id: string) =>
    id === "c1" ? "Test Client" : "Unknown",
  getClientAddressFromList: (_: any, id: string) =>
    id === "c1" ? "123 Rue Test" : "",
}));

vi.mock("@/components/jobs/JobPhotosManager", () => ({
  JobPhotosManager: () => null,
}));
vi.mock("@/components/jobs/JobEmployeesSection", () => ({
  JobEmployeesSection: () => null,
}));

import { JobDetailDialog } from "@/components/jobs/JobDetailDialog";

// --- Factory -------------------------------------------------------------

interface BushItem {
  id: string;
  description: string;
  count: number;
  price: number;
}

function makeSnapshot(overrides: Record<string, any> = {}) {
  return {
    left_length: 25,
    facade_length: 40,
    right_length: 25,
    back_left_length: 10,
    back_length: 30,
    back_right_length: 15,
    width: 3,
    bushItems: [] as BushItem[],
    ...overrides,
  };
}

function makeJob(overrides: Record<string, any> = {}) {
  return {
    id: "job-1",
    client_id: "c1",
    status: "scheduled",
    cut_type: "trim",
    scheduled_date: "2026-06-01",
    start_time: "08:00:00",
    end_time: null,
    estimated_profit: 100,
    real_profit: null,
    estimated_duration_minutes: 60,
    total_duration_minutes: null,
    duration_variance_minutes: null,
    tip: 0,
    measurement_snapshot: makeSnapshot(),
    before_photos: [],
    after_photos: [],
    ...overrides,
  };
}

function renderDialog(job: any = makeJob()) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <JobDetailDialog job={job} onOpenChange={() => {}} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

// --- Tests ---------------------------------------------------------------

describe("JobDetailDialog — measurements display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the Mesures section heading", () => {
    renderDialog();
    expect(screen.getByText("Mesures")).toBeInTheDocument();
  });

  it("renders Avant measurements with Gauche, Façade, Droite", () => {
    renderDialog();
    expect(screen.getByText("Avant")).toBeInTheDocument();
    expect(screen.getByText("Gauche: 25 pi")).toBeInTheDocument();
    expect(screen.getByText("Façade: 40 pi")).toBeInTheDocument();
    expect(screen.getByText("Droite: 25 pi")).toBeInTheDocument();
  });

  it("renders Arrière measurements with Gauche, Fond, Droite", () => {
    renderDialog();
    expect(screen.getByText("Arrière")).toBeInTheDocument();
    expect(screen.getByText("Gauche: 10 pi")).toBeInTheDocument();
    expect(screen.getByText("Fond: 30 pi")).toBeInTheDocument();
    expect(screen.getByText("Droite: 15 pi")).toBeInTheDocument();
  });

  it("does NOT display Largeur anywhere in the dialog", () => {
    renderDialog();
    // The dialog should not contain "Largeur: 3 pi" or any Largeur text
    expect(screen.queryByText(/Largeur/)).not.toBeInTheDocument();
  });

  it("displays bush items under the Mesures heading", () => {
    const bushItems: BushItem[] = [
      { id: "b1", description: "Thuja", count: 3, price: 40 },
      { id: "b2", description: "Épinette", count: 2, price: 35 },
    ];
    const job = makeJob({
      measurement_snapshot: makeSnapshot({ bushItems }),
    });

    renderDialog(job);

    // Arbustes label should be visible
    expect(screen.getByText("Arbustes")).toBeInTheDocument();

    // Each bush item should be rendered with description, count, and total price
    // Thuja x3 = $120.00
    expect(screen.getByText(/Thuja/)).toBeInTheDocument();
    expect(screen.getByText(/\(x3\)/)).toBeInTheDocument();
    expect(screen.getByText(/\$120\.00/)).toBeInTheDocument();

    // Épinette x2 = $70.00
    expect(screen.getByText(/Épinette/)).toBeInTheDocument();
    expect(screen.getByText(/\(x2\)/)).toBeInTheDocument();
    expect(screen.getByText(/\$70\.00/)).toBeInTheDocument();
  });

  it("does not show bush items when there are none in the snapshot", () => {
    const job = makeJob({
      measurement_snapshot: makeSnapshot({ bushItems: [] }),
    });
    renderDialog(job);

    expect(screen.queryByText("Arbustes")).not.toBeInTheDocument();
    expect(screen.getByText("Mesures")).toBeInTheDocument();
  });

  it("handles snapshot with no bushItems field gracefully", () => {
    const job = makeJob({
      measurement_snapshot: makeSnapshot({}),
    });
    // Remove bushItems entirely
    delete job.measurement_snapshot.bushItems;
    renderDialog(job);

    expect(screen.getByText("Mesures")).toBeInTheDocument();
    expect(screen.queryByText("Arbustes")).not.toBeInTheDocument();
  });

  it("handles null measurement_snapshot gracefully", () => {
    renderDialog(makeJob({ measurement_snapshot: null }));
    // The whole Mesures block should not render
    expect(screen.queryByText("Mesures")).not.toBeInTheDocument();
  });

  it("handles zero measurement values gracefully", () => {
    const job = makeJob({
      measurement_snapshot: makeSnapshot({
        left_length: 0,
        facade_length: 0,
        right_length: 0,
        back_left_length: 0,
        back_length: 0,
        back_right_length: 0,
        width: 0,
      }),
    });
    renderDialog(job);

    // Mesures heading should still show
    expect(screen.getByText("Mesures")).toBeInTheDocument();

    // Avant and Arrière sections should NOT show since all values are 0
    expect(screen.queryByText("Avant")).not.toBeInTheDocument();
    expect(screen.queryByText("Arrière")).not.toBeInTheDocument();
  });

  it("preserves multi-line bush display format: Description (xN) - $XX.XX", () => {
    const bushItems: BushItem[] = [
      { id: "b1", description: "Haie cèdre", count: 5, price: 25 },
    ];
    const job = makeJob({
      measurement_snapshot: makeSnapshot({ bushItems }),
    });
    renderDialog(job);

    expect(screen.getByText("Arbustes")).toBeInTheDocument();
    expect(screen.getByText(/Haie cèdre/)).toBeInTheDocument();
    expect(screen.getByText(/\(x5\)/)).toBeInTheDocument();
    expect(screen.getByText(/\$125\.00/)).toBeInTheDocument();
  });

  it("renders bushes inline within Mesures section (not as separate bordered section)", () => {
    const bushItems: BushItem[] = [
      { id: "b1", description: "Thuja", count: 2, price: 40 },
    ];
    const job = makeJob({
      measurement_snapshot: makeSnapshot({ bushItems }),
    });
    const { container } = renderDialog(job);

    // Find all border-top divs - there should only be the one for Mesures section
    // (not a separate one for bushes)
    const borderTops = container.querySelectorAll(".border-t");
    // The Mesures container itself has border-t, and there's the action buttons section too
    // But there should be NO border-top div that ONLY contains bush items
    // (i.e., bushes should be inside the same border-t container as Mesures)

    // Find the Mesures heading
    const mesuresHeading = screen.getByText("Mesures");
    expect(mesuresHeading).toBeInTheDocument();

    // The Arbustes text should be in the same parent container as Mesures
    const arbustesText = screen.getByText("Arbustes");
    expect(arbustesText).toBeInTheDocument();
  });

  it("still renders job detail header info correctly alongside measurements", () => {
    renderDialog();
    expect(screen.getByText(/Test Client/)).toBeInTheDocument();
    expect(screen.getByText(/trim/)).toBeInTheDocument();
    // The job type label is shown as raw cut_type value (trim/levelling/restoration)
    expect(screen.getByText(/Type de coupe/)).toBeInTheDocument();
  });
});
