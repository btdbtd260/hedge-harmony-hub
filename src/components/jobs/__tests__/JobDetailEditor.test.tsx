// ============================================================
// Tests for JobDetailEditor — async form population bug
// ============================================================
// TDD: Tests written FIRST (RED phase), then implementation.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import React from "react";

// ─── Mocks ───
// NOTE: vi.mock factory is hoisted to top — use vi.fn() directly inside.

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}));

vi.mock("@/hooks/useSupabaseData", () => ({
  useCustomers: () => ({ data: [] }),
  useJobById: vi.fn(),
  useUpdateJob: () => ({ mutateAsync: vi.fn().mockResolvedValue(undefined) }),
  useParameters: () => ({
    data: {
      price_per_foot_trim: 4.5,
      price_per_foot_levelling: 6,
      price_per_foot_restoration: 8,
      bush_price: 40,
      height_multiplier_threshold: 5,
      height_multiplier: 1.5,
      width_multiplier_threshold: 3,
      width_multiplier: 1.3,
      two_sides_multiplier: 1.5,
      rounding_enabled: true,
      rounding_multiple: 5,
    },
  }),
  getClientNameFromList: () => "Test Client",
  getClientAddressFromList: () => "",
}));

import { useJobById } from "@/hooks/useSupabaseData";
import JobDetailEditor from "@/components/jobs/JobDetailEditor";

// ─── Factory ───

function makeJob(overrides: Record<string, any> = {}) {
  return {
    id: "job-1",
    client_id: "c1",
    status: "scheduled",
    cut_type: "trim",
    scheduled_date: "2026-06-01",
    start_time: "09:00:00",
    end_time: null,
    estimated_profit: 540,
    real_profit: null,
    estimated_duration_minutes: 60,
    total_duration_minutes: null,
    duration_variance_minutes: null,
    tip: 0,
    measurement_snapshot: {
      facade_length: 40,
      left_length: 25,
      right_length: 25,
      back_length: 30,
      back_left_length: 0,
      back_right_length: 0,
      height_mode: "global",
      height_global: 4,
      height_facade: 0,
      height_left: 0,
      height_right: 0,
      height_back: 0,
      height_back_left: 0,
      height_back_right: 0,
      width: 2,
      custom_price_per_foot: null,
      two_sides: {
        facade: false,
        left: false,
        right: false,
        back: false,
        back_left: false,
        back_right: false,
      },
      extras: [],
      discounts: [],
    },
    before_photos: [],
    after_photos: [],
    ...overrides,
  };
}

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={["/jobs/job-1/edit-details"]}>
      <Routes>
        <Route path="/jobs/:jobId/edit-details" element={<JobDetailEditor />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("JobDetailEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state when job data is loading", () => {
    vi.mocked(useJobById).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    } as any);

    renderEditor();

    expect(screen.getByText("Chargement du job…")).toBeInTheDocument();
  });

  it("shows not-found message when job is null (not loading)", () => {
    vi.mocked(useJobById).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    } as any);

    renderEditor();

    expect(screen.getByText("Job introuvable.")).toBeInTheDocument();
  });

  it("populates form fields from measurement_snapshot when job data arrives async", () => {
    const mockJobById = vi.mocked(useJobById);

    // Simulate the bug scenario: first render has no data (loading),
    // then job arrives (async React Query fetch).
    // Use mockReturnValue so the mock doesn't get exhausted.
    mockJobById.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    } as any);

    const { rerender } = renderEditor();

    // Phase 1: loading — should show loading indicator
    expect(screen.getByText("Chargement du job…")).toBeInTheDocument();

    // Phase 2: data arrives — change mock and re-render with new return value
    mockJobById.mockReturnValue({
      data: makeJob(),
      isLoading: false,
      error: null,
    } as any);

    rerender(
      <MemoryRouter initialEntries={["/jobs/job-1/edit-details"]}>
        <Routes>
          <Route
            path="/jobs/:jobId/edit-details"
            element={<JobDetailEditor />}
          />
        </Routes>
      </MemoryRouter>,
    );

    // The summary should now reflect values from measurement_snapshot
    // totalLinearFeet = 40 + 25 + 25 + 30 + 0 + 0 = 120
    expect(screen.getByText("120 pi")).toBeInTheDocument();

    // basePrice = 120 * 4.5 = 540
    // Rounding to nearest 5: floor(540/5)*5 = 540
    // $540.00 appears twice: in the basePrice line and the total line
    expect(screen.getAllByText("$540.00")).toHaveLength(2);
  });

  it("displays zero values when measurement_snapshot has all zeros", () => {
    const job = makeJob({
      measurement_snapshot: {
        facade_length: 0,
        left_length: 0,
        right_length: 0,
        back_length: 0,
        back_left_length: 0,
        back_right_length: 0,
        height_mode: "global",
        height_global: 0,
        height_facade: 0,
        height_left: 0,
        height_right: 0,
        height_back: 0,
        height_back_left: 0,
        height_back_right: 0,
        width: 0,
        custom_price_per_foot: null,
        two_sides: {
          facade: false,
          left: false,
          right: false,
          back: false,
          back_left: false,
          back_right: false,
        },
        extras: [],
        discounts: [],
      },
    });

    vi.mocked(useJobById).mockReturnValue({
      data: job,
      isLoading: false,
      error: null,
    } as any);

    renderEditor();

    // totalLinearFeet = 0
    expect(screen.getByText("0 pi")).toBeInTheDocument();
    // basePrice = 0, total = 0 (rounding floor(0/5)*5 = 0)
    // $0.00 appears twice: in the basePrice line and the total line
    expect(screen.getAllByText("$0.00")).toHaveLength(2);
  });
});
