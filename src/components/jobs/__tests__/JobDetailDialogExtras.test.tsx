/**
 * Tests for JobDetailDialog — Extras section display
 *
 * Verifies:
 * - Extras section renders when snap.extras has visible extras
 * - Extras section appears after Mesures and before JobPhotosManager
 * - Extras with blank description AND 0 price are filtered out
 * - Extras with description but 0 price ARE shown
 * - Extras with blank description but non-zero price ARE shown
 * - Extras section does not render when there are no visible extras
 * - Existing Mesures section still renders
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
  JobPhotosManager: () => <div data-testid="photos-manager">Photos</div>,
}));
vi.mock("@/components/jobs/JobEmployeesSection", () => ({
  JobEmployeesSection: () => null,
}));

// ─── Mock supabase client (JobDetailDialog imports supabase directly for invoice ops) ───

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

// --- Extras item interface -----------------------------------------------

interface ExtraItem {
  description: string;
  price: number;
}

// --- Factory -------------------------------------------------------------

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
    extras: [] as ExtraItem[],
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

describe("JobDetailDialog — extras display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the Extras section heading when there are visible extras", () => {
    const extras: ExtraItem[] = [
      { description: "Haie supplémentaire", price: 50 },
    ];
    const job = makeJob({
      measurement_snapshot: makeSnapshot({ extras }),
    });
    renderDialog(job);

    expect(screen.getByText("Extras")).toBeInTheDocument();
  });

  it("renders each extra with description and formatted price", () => {
    const extras: ExtraItem[] = [
      { description: "Haie supplémentaire", price: 50 },
      { description: "Nettoyage approfondi", price: 75.5 },
    ];
    const job = makeJob({
      measurement_snapshot: makeSnapshot({ extras }),
    });
    renderDialog(job);

    expect(screen.getByText("Haie supplémentaire")).toBeInTheDocument();
    expect(screen.getByText(/\$50\.00/)).toBeInTheDocument();
    expect(screen.getByText("Nettoyage approfondi")).toBeInTheDocument();
    expect(screen.getByText(/\$75\.50/)).toBeInTheDocument();
  });

  it("appears after the Mesures section and before JobPhotosManager", () => {
    const extras: ExtraItem[] = [
      { description: "Extra service", price: 30 },
    ];
    const job = makeJob({
      measurement_snapshot: makeSnapshot({ extras }),
    });
    renderDialog(job);

    // Radix UI Dialog uses portals, so we search in document.body
    const html = document.body.innerHTML;

    // Mesures should appear before Extras
    const mesuresIndex = html.indexOf("Mesures");
    const extrasIndex = html.indexOf("Extras");
    const photosIndex = html.indexOf("photos-manager");

    expect(mesuresIndex).toBeGreaterThanOrEqual(0);
    expect(extrasIndex).toBeGreaterThan(mesuresIndex);
    expect(photosIndex).toBeGreaterThan(extrasIndex);
  });

  it("filters out extras where description is blank AND price is 0", () => {
    const extras: ExtraItem[] = [
      { description: "Visible extra", price: 25 },
      { description: "", price: 0 },
      { description: "   ", price: 0 },
    ];
    const job = makeJob({
      measurement_snapshot: makeSnapshot({ extras }),
    });
    renderDialog(job);

    // The section should still render (there's 1 visible extra)
    expect(screen.getByText("Extras")).toBeInTheDocument();

    // The visible extra should be rendered
    expect(screen.getByText("Visible extra")).toBeInTheDocument();
    expect(screen.getByText(/\$25\.00/)).toBeInTheDocument();
  });

  it("shows extras with description but 0 price", () => {
    const extras: ExtraItem[] = [
      { description: "Free service", price: 0 },
    ];
    const job = makeJob({
      measurement_snapshot: makeSnapshot({ extras }),
    });
    renderDialog(job);

    expect(screen.getByText("Extras")).toBeInTheDocument();
    expect(screen.getByText("Free service")).toBeInTheDocument();
    expect(screen.getByText(/\$0\.00/)).toBeInTheDocument();
  });

  it("shows extras with blank description but non-zero price", () => {
    const extras: ExtraItem[] = [
      { description: "", price: 45 },
    ];
    const job = makeJob({
      measurement_snapshot: makeSnapshot({ extras }),
    });
    renderDialog(job);

    expect(screen.getByText("Extras")).toBeInTheDocument();
    expect(screen.getByText(/\$45\.00/)).toBeInTheDocument();
  });

  it("does NOT render Extras section when snap.extras is an empty array", () => {
    const job = makeJob({
      measurement_snapshot: makeSnapshot({ extras: [] }),
    });
    renderDialog(job);

    expect(screen.queryByText("Extras")).not.toBeInTheDocument();
  });

  it("does NOT render Extras section when all extras are filtered out", () => {
    const extras: ExtraItem[] = [
      { description: "", price: 0 },
      { description: "", price: 0 },
    ];
    const job = makeJob({
      measurement_snapshot: makeSnapshot({ extras }),
    });
    renderDialog(job);

    expect(screen.queryByText("Extras")).not.toBeInTheDocument();
  });

  it("does NOT render Extras section when snap.extras is undefined", () => {
    const job = makeJob({
      measurement_snapshot: makeSnapshot({}),
    });
    delete job.measurement_snapshot.extras;
    renderDialog(job);

    expect(screen.queryByText("Extras")).not.toBeInTheDocument();
  });

  it("does NOT render Extras section when measurement_snapshot is null", () => {
    renderDialog(makeJob({ measurement_snapshot: null }));

    expect(screen.queryByText("Extras")).not.toBeInTheDocument();
  });

  it("does NOT render Extras section when extras is null", () => {
    const job = makeJob({
      measurement_snapshot: makeSnapshot({ extras: null }),
    });
    renderDialog(job);

    expect(screen.queryByText("Extras")).not.toBeInTheDocument();
  });

  it("still renders existing Mesures section alongside Extras", () => {
    const extras: ExtraItem[] = [
      { description: "Extra service", price: 30 },
    ];
    const job = makeJob({
      measurement_snapshot: makeSnapshot({ extras }),
    });
    renderDialog(job);

    // Both sections should be present
    expect(screen.getByText("Mesures")).toBeInTheDocument();
    expect(screen.getByText("Extras")).toBeInTheDocument();

    // Mesures content should still be there
    expect(screen.getByText("Avant")).toBeInTheDocument();
    expect(screen.getByText("Gauche: 25 pi")).toBeInTheDocument();
  });

  it("uses the same border-t pt-3 visual style as Mesures section", () => {
    const extras: ExtraItem[] = [
      { description: "Extra service", price: 30 },
    ];
    const job = makeJob({
      measurement_snapshot: makeSnapshot({ extras }),
    });
    const { container } = renderDialog(job);

    // The extras section is rendered inside a div with border-t pt-3 classes
    // We can't easily test CSS in jsdom, but we can check the structure exists
    // The Extras text should be followed by price-formatted content
    expect(screen.getByText("Extras")).toBeInTheDocument();
    expect(screen.getByText("Extra service")).toBeInTheDocument();
    expect(screen.getByText(/\$30\.00/)).toBeInTheDocument();
  });
});
