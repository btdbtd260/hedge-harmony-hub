// ============================================================
// Tests for useCompletedEmployeeJobs — pure filtering logic
// ============================================================
// TDD: Tests written FIRST (RED phase), then implementation.
// ============================================================

import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock the React Query hooks from useSupabaseData
vi.mock("../useSupabaseData", () => ({
  useEmployeeJobs: vi.fn(),
  useJobs: vi.fn(),
}));

import {
  filterCompletedEmployeeJobs,
  useCompletedEmployeeJobs,
  type CompletedEmployeeJobsResult,
} from "../useCompletedEmployeeJobs";
// Import the mocked functions to control their return values
import { useEmployeeJobs, useJobs } from "../useSupabaseData";

// ─── Helpers ───

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Factories ───

function makeEmployeeJob(overrides: Partial<{
  id: string;
  employee_id: string;
  job_id: string;
  hours_worked: number;
  calculated_pay: number;
  is_present: boolean;
}> = {}) {
  return {
    id: "ej-1",
    employee_id: "emp-1",
    job_id: "job-1",
    hours_worked: 8,
    calculated_pay: 160,
    is_present: true,
    ...overrides,
  };
}

function makeJob(overrides: Partial<{
  id: string;
  client_id: string;
  status: string;
  cut_type: string;
  scheduled_date: string;
}> = {}) {
  return {
    id: "job-1",
    client_id: "client-1",
    status: "completed",
    cut_type: "trim",
    scheduled_date: "2026-02-18",
    ...overrides,
  };
}

// ─── Tests ───

describe("filterCompletedEmployeeJobs", () => {
  // ─── Happy path ───

  it("returns only employee_jobs whose linked job has status 'completed'", () => {
    const ej1 = makeEmployeeJob({ id: "ej-1", job_id: "job-1" });
    const ej2 = makeEmployeeJob({ id: "ej-2", job_id: "job-2" });
    const ej3 = makeEmployeeJob({ id: "ej-3", job_id: "job-3" });

    const jobs = [
      makeJob({ id: "job-1", status: "completed" }),
      makeJob({ id: "job-2", status: "pending" }),
      makeJob({ id: "job-3", status: "scheduled" }),
    ];

    const result = filterCompletedEmployeeJobs([ej1, ej2, ej3], jobs);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe("ej-1");
  });

  it("returns all employee_jobs when all linked jobs are completed", () => {
    const ej1 = makeEmployeeJob({ id: "ej-1", job_id: "job-1" });
    const ej2 = makeEmployeeJob({ id: "ej-2", job_id: "job-2" });

    const jobs = [
      makeJob({ id: "job-1", status: "completed" }),
      makeJob({ id: "job-2", status: "completed" }),
    ];

    const result = filterCompletedEmployeeJobs([ej1, ej2], jobs);

    expect(result.data).toHaveLength(2);
  });

  it("returns empty array when no employee_jobs have completed jobs", () => {
    const ej1 = makeEmployeeJob({ id: "ej-1", job_id: "job-1" });
    const ej2 = makeEmployeeJob({ id: "ej-2", job_id: "job-2" });

    const jobs = [
      makeJob({ id: "job-1", status: "pending" }),
      makeJob({ id: "job-2", status: "scheduled" }),
    ];

    const result = filterCompletedEmployeeJobs([ej1, ej2], jobs);

    expect(result.data).toHaveLength(0);
  });

  it("builds a jobsById map for convenience", () => {
    const ej1 = makeEmployeeJob({ job_id: "job-1" });
    const jobs = [
      makeJob({ id: "job-1", status: "completed" }),
      makeJob({ id: "job-2", status: "pending" }),
    ];

    const result = filterCompletedEmployeeJobs([ej1], jobs);

    expect(result.jobsById).toBeInstanceOf(Map);
    expect(result.jobsById.get("job-1")?.status).toBe("completed");
    expect(result.jobsById.get("job-2")?.status).toBe("pending");
    expect(result.jobsById.size).toBe(2);
  });

  // ─── Edge cases ───

  it("returns empty data and empty map when employeeJobs is empty", () => {
    const result = filterCompletedEmployeeJobs([], [
      makeJob({ id: "job-1", status: "completed" }),
    ]);

    expect(result.data).toEqual([]);
    expect(result.jobsById.size).toBe(1);
  });

  it("returns empty data when jobs array is empty (all jobs missing)", () => {
    const ej1 = makeEmployeeJob({ id: "ej-1", job_id: "job-1" });
    const ej2 = makeEmployeeJob({ id: "ej-2", job_id: "job-2" });

    const result = filterCompletedEmployeeJobs([ej1, ej2], []);

    expect(result.data).toEqual([]);
    expect(result.jobsById.size).toBe(0);
  });

  it("handles employeeJobs referencing non-existent jobs", () => {
    const ej1 = makeEmployeeJob({ id: "ej-1", job_id: "nonexistent-job" });

    const result = filterCompletedEmployeeJobs([ej1], [
      makeJob({ id: "job-1", status: "completed" }),
    ]);

    // The job doesn't exist, so it shouldn't be included
    expect(result.data).toHaveLength(0);
  });

  it("handles null/undefined job status gracefully", () => {
    const ej1 = makeEmployeeJob({ id: "ej-1", job_id: "job-1" });

    const jobs = [
      { ...makeJob({ id: "job-1" }), status: null },
    ];

    const result = filterCompletedEmployeeJobs([ej1], jobs as any);

    expect(result.data).toHaveLength(0);
  });

  it("preserves all fields on filtered employee_jobs", () => {
    const ej1 = makeEmployeeJob({
      id: "ej-1",
      employee_id: "emp-1",
      job_id: "job-1",
      hours_worked: 8,
      calculated_pay: 200,
      is_present: true,
    });

    const result = filterCompletedEmployeeJobs([ej1], [
      makeJob({ id: "job-1", status: "completed" }),
    ]);

    expect(result.data[0].employee_id).toBe("emp-1");
    expect(result.data[0].hours_worked).toBe(8);
    expect(result.data[0].calculated_pay).toBe(200);
    expect(result.data[0].is_present).toBe(true);
  });

  it("filters correctly with mixed statuses including hidden and cancelled", () => {
    const ejs = [
      makeEmployeeJob({ id: "ej-1", job_id: "job-completed" }),
      makeEmployeeJob({ id: "ej-2", job_id: "job-pending" }),
      makeEmployeeJob({ id: "ej-3", job_id: "job-hidden" }),
      makeEmployeeJob({ id: "ej-4", job_id: "job-scheduled" }),
    ];

    const jobs = [
      makeJob({ id: "job-completed", status: "completed" }),
      makeJob({ id: "job-pending", status: "pending" }),
      makeJob({ id: "job-hidden", status: "hidden" }),
      makeJob({ id: "job-scheduled", status: "scheduled" }),
    ];

    const result = filterCompletedEmployeeJobs(ejs, jobs);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe("ej-1");
  });

  it("handles multiple employee jobs per employee correctly", () => {
    const ejs = [
      makeEmployeeJob({ id: "ej-1", employee_id: "emp-1", job_id: "job-1" }),
      makeEmployeeJob({ id: "ej-2", employee_id: "emp-1", job_id: "job-2" }),
      makeEmployeeJob({ id: "ej-3", employee_id: "emp-2", job_id: "job-3" }),
    ];

    const jobs = [
      makeJob({ id: "job-1", status: "completed" }),
      makeJob({ id: "job-2", status: "completed" }),
      makeJob({ id: "job-3", status: "pending" }),
    ];

    const result = filterCompletedEmployeeJobs(ejs, jobs);

    // emp-1 has 2 completed, emp-2 has 0 completed
    expect(result.data).toHaveLength(2);
    expect(result.data.filter(ej => ej.employee_id === "emp-1")).toHaveLength(2);
    expect(result.data.filter(ej => ej.employee_id === "emp-2")).toHaveLength(0);
  });

  it("returns typed result with data and jobsById", () => {
    const result = filterCompletedEmployeeJobs([], []);
    
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("jobsById");
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.jobsById instanceof Map).toBe(true);
  });
});

// ─── Hook tests (integration with mocked React Query) ───

describe("useCompletedEmployeeJobs (hook)", () => {
  it("returns filtered data when useEmployeeJobs and useJobs provide data", () => {
    const ej1 = makeEmployeeJob({ id: "ej-1", job_id: "job-1" });
    const ej2 = makeEmployeeJob({ id: "ej-2", job_id: "job-2" });

    vi.mocked(useEmployeeJobs).mockReturnValue({ data: [ej1, ej2] } as any);
    vi.mocked(useJobs).mockReturnValue({
      data: [
        makeJob({ id: "job-1", status: "completed" }),
        makeJob({ id: "job-2", status: "pending" }),
      ],
    } as any);

    const { result } = renderHook(() => useCompletedEmployeeJobs(), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].id).toBe("ej-1");
    expect(result.current.jobsById.size).toBe(2);
  });

  it("returns empty data when no employee jobs match completed jobs", () => {
    vi.mocked(useEmployeeJobs).mockReturnValue({
      data: [makeEmployeeJob({ job_id: "job-1" })],
    } as any);
    vi.mocked(useJobs).mockReturnValue({
      data: [makeJob({ id: "job-1", status: "pending" })],
    } as any);

    const { result } = renderHook(() => useCompletedEmployeeJobs(), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toHaveLength(0);
  });

  it("uses defaults (empty arrays) when data is undefined", () => {
    vi.mocked(useEmployeeJobs).mockReturnValue({ data: undefined } as any);
    vi.mocked(useJobs).mockReturnValue({ data: undefined } as any);

    const { result } = renderHook(() => useCompletedEmployeeJobs(), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.jobsById.size).toBe(0);
  });

  it("memoizes result — returns same reference on re-render with same data", () => {
    vi.mocked(useEmployeeJobs).mockReturnValue({ data: [] } as any);
    vi.mocked(useJobs).mockReturnValue({ data: [] } as any);

    const { result, rerender } = renderHook(() => useCompletedEmployeeJobs(), {
      wrapper: createWrapper(),
    });

    const first = result.current;
    rerender();
    const second = result.current;

    // With same data, useMemo should return the same reference
    expect(second).toBe(first);
  });

  it("recomputes when data changes", () => {
    const ej1 = makeEmployeeJob({ id: "ej-1", job_id: "job-1" });
    const ej2 = makeEmployeeJob({ id: "ej-2", job_id: "job-2" });

    // First render: only ej-1 is completed
    vi.mocked(useEmployeeJobs).mockReturnValue({ data: [ej1, ej2] } as any);
    vi.mocked(useJobs).mockReturnValue({
      data: [
        makeJob({ id: "job-1", status: "completed" }),
        makeJob({ id: "job-2", status: "pending" }),
      ],
    } as any);

    const { result, rerender } = renderHook(() => useCompletedEmployeeJobs(), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toHaveLength(1);

    // Update: both jobs are now completed
    vi.mocked(useJobs).mockReturnValue({
      data: [
        makeJob({ id: "job-1", status: "completed" }),
        makeJob({ id: "job-2", status: "completed" }),
      ],
    } as any);

    // Force re-render with new data
    rerender();

    expect(result.current.data).toHaveLength(2);
  });
});
