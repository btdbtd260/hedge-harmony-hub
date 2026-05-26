// ============================================================
// Tests for useUpdateJob — cache invalidation behaviour
// ============================================================
// TDD: Tests written FIRST (RED phase), then implementation.
// ============================================================

import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ─── Mock supabase client ───

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({ data: { id: "new-1" }, error: null }),
          ),
        })),
      })),
    })),
  },
}));

import { useUpdateJob } from "../useSupabaseData";

// ─── Helpers ───

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper, invalidateSpy, queryClient };
}

describe("useUpdateJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates both ['jobs'] and ['job'] query keys on success", async () => {
    const { wrapper, invalidateSpy } = createWrapper();

    const { result } = renderHook(() => useUpdateJob(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: "job-1" });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["jobs"] });
    // BUG FIX: after saving a job, the per-job cache must also be invalidated
    // so that JobDetailEditor re-fetches the freshest measurement_snapshot.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["job"] });
  });

  it("still invalidates employee_jobs and invoices on success", async () => {
    const { wrapper, invalidateSpy } = createWrapper();

    const { result } = renderHook(() => useUpdateJob(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: "job-1", cut_type: "trim" });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["employee_jobs"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["invoices"] });
  });
});
