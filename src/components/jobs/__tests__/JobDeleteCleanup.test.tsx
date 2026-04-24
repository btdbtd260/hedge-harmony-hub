/**
 * UI regression test — Job deletion must never freeze the page.
 *
 * Background: Radix AlertDialog + parent Dialog can leave
 * `pointer-events: none` on <body> when both close in the same tick.
 * The fix in JobDetailDialog sequences the closures and explicitly
 * clears body pointer-events. This test guards that invariant.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { screen, fireEvent, waitFor } from "@testing-library/dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// --- Mocks ---------------------------------------------------------------
const deleteMutate = vi.fn().mockResolvedValue(undefined);
const updateMutate = vi.fn().mockResolvedValue(undefined);

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}));

vi.mock("@/hooks/useSupabaseData", () => ({
  useCustomers: () => ({ data: [{ id: "c1", name: "Test Client" }] }),
  useJobs: () => ({ data: [] }),
  useUpdateJob: () => ({ mutateAsync: updateMutate }),
  useDeleteJob: () => ({ mutateAsync: deleteMutate, isPending: false }),
  getClientNameFromList: (_: any, id: string) => (id === "c1" ? "Test Client" : "Unknown"),
}));

// Heavy children we don't need for this regression
vi.mock("@/components/jobs/JobPhotosManager", () => ({
  JobPhotosManager: () => null,
}));
vi.mock("@/components/jobs/JobEmployeesSection", () => ({
  JobEmployeesSection: () => null,
}));

// Import AFTER mocks
import { JobDetailDialog } from "@/components/jobs/JobDetailDialog";

const mockJob: any = {
  id: "job-1",
  client_id: "c1",
  status: "scheduled",
  cut_type: "trim",
  scheduled_date: "2026-04-25",
  start_time: "08:00:00",
  end_time: null,
  estimated_profit: 100,
  real_profit: null,
  estimated_duration_minutes: 60,
  total_duration_minutes: null,
  duration_variance_minutes: null,
  tip: 0,
  measurement_snapshot: null,
  before_photos: [],
  after_photos: [],
};

function renderDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <JobDetailDialog job={mockJob} onOpenChange={() => {}} />
    </QueryClientProvider>,
  );
}

describe("Job deletion — UI regression", () => {
  beforeEach(() => {
    deleteMutate.mockClear();
    document.body.style.pointerEvents = "";
  });

  afterEach(() => {
    cleanup();
    document.body.style.pointerEvents = "";
  });

  it("calls the delete mutation and clears body pointer-events afterwards", async () => {
    renderDialog();

    // Open the delete confirmation alert
    fireEvent.click(screen.getByRole("button", { name: /supprimer ce job/i }));

    // Simulate Radix temporarily locking the body during overlay transition
    document.body.style.pointerEvents = "none";

    // Confirm deletion
    const confirmBtn = await screen.findByRole("button", {
      name: /supprimer définitivement/i,
    });
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(deleteMutate).toHaveBeenCalledWith("job-1"));

    // The handler waits 50ms before cleanup; advance real time a bit
    await new Promise((r) => setTimeout(r, 100));

    // Body must be interactive again — page is not frozen
    expect(document.body.style.pointerEvents).toBe("");
  });

  it("never leaves <body> with pointer-events:none after deletion completes", async () => {
    const onOpenChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <JobDetailDialog job={mockJob} onOpenChange={onOpenChange} />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /supprimer ce job/i }));
    document.body.style.pointerEvents = "none"; // worst-case Radix state

    const confirmBtn = await screen.findByRole("button", {
      name: /supprimer définitivement/i,
    });
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(deleteMutate).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 100));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(document.body.style.pointerEvents).not.toBe("none");
  });
});
