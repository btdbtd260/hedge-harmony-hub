/**
 * Tests for JobDetailDialog — Duration Factors display
 *
 * Verifies:
 * - "Facteurs de durée" section does NOT render when there are no active factors
 * - Section renders when there are active factors (twoSides, bushes, etc.)
 * - Each active factor is displayed with its label and detail
 * - Old jobs without new snapshot fields don't show the section
 * - The section appears before "Profit estimé"
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
  useEmployeeJobs: () => ({ data: [] }),
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
  JobPhotosManager: () => <div data-testid="photos-manager">Photos</div>,
}));
vi.mock("@/components/jobs/JobEmployeesSection", () => ({
  JobEmployeesSection: () => null,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
    })),
  },
}));

import { JobDetailDialog } from "@/components/jobs/JobDetailDialog";

// --- Helpers -------------------------------------------------------------

interface TwoSidesObj {
  [side: string]: boolean;
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
    bushItems: [],
    extras: [],
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

describe("JobDetailDialog — duration factors display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("does NOT render Facteurs de durée section when no active factors", () => {
    renderDialog();
    // Default snapshot has no two_sides, no bushItems, no extras
    expect(screen.queryByText("Facteurs de durée")).not.toBeInTheDocument();
  });

  it("does NOT render for old-style jobs without new snapshot fields", () => {
    const job = makeJob({
      measurement_snapshot: {
        facade_length: 40,
        height_global: 4,
        width: 2,
      },
    });
    renderDialog(job);
    expect(screen.queryByText("Facteurs de durée")).not.toBeInTheDocument();
  });

  it("does NOT render for null measurement_snapshot", () => {
    renderDialog(makeJob({ measurement_snapshot: null }));
    expect(screen.queryByText("Facteurs de durée")).not.toBeInTheDocument();
  });

  it("renders Facteurs de durée and shows twoSides factor when two_sides has any true side", () => {
    const job = makeJob({
      measurement_snapshot: makeSnapshot({
        two_sides: { facade: true } as TwoSidesObj,
        height_global: 4,
      }),
    });
    renderDialog(job);

    expect(screen.getByText("Facteurs de durée")).toBeInTheDocument();
    // The detail text "Coupe des deux côtés active" should be present
    expect(screen.getByText("Coupe des deux côtés active")).toBeInTheDocument();
  });

  it("shows 'arbustes' factor when bushItems have count > 0", () => {
    const job = makeJob({
      measurement_snapshot: makeSnapshot({
        bushItems: [
          { id: "b1", description: "Thuja", count: 3, price: 40 },
        ],
      }),
    });
    renderDialog(job);

    expect(screen.getByText("Facteurs de durée")).toBeInTheDocument();
    // The detail text "3 arbuste(s)" should be present
    expect(screen.getByText("3 arbuste(s)")).toBeInTheDocument();
  });

  it("shows 'extras' factor when extras have descriptions", () => {
    const job = makeJob({
      measurement_snapshot: makeSnapshot({
        extras: [
          { id: "e1", description: "piscine", price: 30 },
        ],
      }),
    });
    renderDialog(job);

    expect(screen.getByText("Facteurs de durée")).toBeInTheDocument();
    // The detail text should contain the detected extras
    expect(screen.getByText(/Détectés: piscine/)).toBeInTheDocument();
  });

  it("shows 'hauteur + deux côtés' when twoSides and height > 6", () => {
    const job = makeJob({
      measurement_snapshot: makeSnapshot({
        two_sides: { facade: true } as TwoSidesObj,
        height_global: 8,
      }),
    });
    renderDialog(job);

    expect(screen.getByText("Facteurs de durée")).toBeInTheDocument();
    // Should have "hauteur + deux côtés" label
    expect(screen.getByText(/hauteur \+ deux côtés/)).toBeInTheDocument();
    // And "Coupe des deux côtés active" detail
    expect(screen.getByText("Coupe des deux côtés active")).toBeInTheDocument();
  });

  it("shows multiple factors when several are active", () => {
    const job = makeJob({
      measurement_snapshot: makeSnapshot({
        two_sides: { facade: true } as TwoSidesObj,
        height_global: 8,
        bushItems: [
          { id: "b1", description: "Haie", count: 2, price: 40 },
        ],
        extras: [
          { id: "e1", description: "cabanon", price: 25 },
          { id: "e2", description: "fil", price: 20 },
        ],
      }),
    });
    renderDialog(job);

    expect(screen.getByText("Facteurs de durée")).toBeInTheDocument();
    // Check that specific detail strings are present
    expect(screen.getByText("Coupe des deux côtés active")).toBeInTheDocument();
    expect(screen.getByText("2 arbuste(s)")).toBeInTheDocument();
    expect(screen.getByText(/Détectés: cabanon, fil/)).toBeInTheDocument();
  });

  it("appears before 'Profit estimé' in the document order", () => {
    const job = makeJob({
      measurement_snapshot: makeSnapshot({
        two_sides: { facade: true } as TwoSidesObj,
        bushItems: [
          { id: "b1", description: "Thuja", count: 3, price: 40 },
        ],
      }),
    });
    renderDialog(job);

    const html = document.body.innerHTML;
    const factorsIndex = html.indexOf("Facteurs de durée");
    const profitIndex = html.indexOf("Profit estimé");

    expect(factorsIndex).toBeGreaterThanOrEqual(0);
    expect(profitIndex).toBeGreaterThan(factorsIndex);
  });

  it("still renders existing Mesures section alongside factors", () => {
    const job = makeJob({
      measurement_snapshot: makeSnapshot({
        two_sides: { facade: true } as TwoSidesObj,
      }),
    });
    renderDialog(job);

    expect(screen.getByText("Mesures")).toBeInTheDocument();
    expect(screen.getByText("Facteurs de durée")).toBeInTheDocument();
  });
});
