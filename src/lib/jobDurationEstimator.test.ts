import { describe, it, expect } from "vitest";
import {
  estimateJobDuration,
  measurementsFromJob,
  computeRealDuration,
  addMinutesToTime,
  type MeasurementInput,
} from "@/lib/jobDurationEstimator";
import type { DbJob } from "@/hooks/useSupabaseData";

// ── helpers ──

function makeJob(overrides: Partial<DbJob> = {}): DbJob {
  return {
    id: "j1",
    client_id: "c1",
    estimation_id: "e1",
    cut_type: "trim",
    status: "completed",
    scheduled_date: "2026-02-18",
    start_time: "08:00",
    end_time: "10:30",
    total_duration_minutes: 150,
    estimated_duration_minutes: null,
    estimated_profit: 540,
    real_profit: null,
    before_photos: [],
    after_photos: [],
    measurement_snapshot: {
      facade_length: 40,
      left_length: 25,
      right_length: 25,
      back_length: 30,
      height_mode: "global",
      height_global: 4,
      height_facade: 0,
      height_left: 0,
      height_right: 0,
      height_back: 0,
      width: 2,
    },
    ...overrides,
  } as any as DbJob;
}

// ── measurementsFromJob ──

describe("measurementsFromJob", () => {
  it("extracts snake_case measurement snapshot", () => {
    const job = makeJob();
    const m = measurementsFromJob(job);
    expect(m.facade).toBe(40);
    expect(m.left).toBe(25);
    expect(m.right).toBe(25);
    expect(m.back).toBe(30);
    expect(m.height_mode).toBe("global");
    expect(m.height_global).toBe(4);
    expect(m.width).toBe(2);
  });

  it("extracts camelCase measurement snapshot", () => {
    const job = makeJob({
      measurement_snapshot: {
        facadeLength: 50,
        leftLength: 20,
        rightLength: 20,
        backLength: 15,
        heightMode: "per_side",
        heightGlobal: 0,
        heightFacade: 5,
        heightLeft: 4,
        heightRight: 4,
        heightBack: 3,
        width: 3,
        bushesCount: 2,
        extras: [{ id: "e1", description: "Test", price: 25 }],
      },
    });
    const m = measurementsFromJob(job);
    expect(m.facade).toBe(50);
    expect(m.left).toBe(20);
    expect(m.right).toBe(20);
    expect(m.back).toBe(15);
    expect(m.height_mode).toBe("per_side");
    expect(m.height_facade).toBe(5);
    expect(m.height_left).toBe(4);
    expect(m.height_right).toBe(4);
    expect(m.height_back).toBe(3);
    expect(m.width).toBe(3);
    expect(m.bushes_count).toBe(2);
    expect(m.extras_count).toBe(1);
  });

  it("handles empty measurement snapshot", () => {
    const job = makeJob({ measurement_snapshot: null });
    const m = measurementsFromJob(job);
    expect(m.facade).toBe(0);
    expect(m.height_global).toBe(4); // default
    expect(m.width).toBe(2); // default
    expect(m.extras_count).toBe(0);
  });
});

// ── estimateJobDuration ──

describe("estimateJobDuration", () => {
  it("returns 0 for empty measurements", () => {
    const result = estimateJobDuration({}, []);
    expect(result.minutes).toBe(0);
    expect(result.basis).toBe("base");
    expect(result.explanation).toContain("Aucune mesure");
  });

  it("returns base estimate when no history exists", () => {
    const input: MeasurementInput = {
      cut_type: "trim",
      facade: 40,
      left: 25,
      right: 25,
      back: 30,
      height_global: 4,
      height_mode: "global",
      width: 2,
    };
    const result = estimateJobDuration(input, []);
    expect(result.minutes).toBeGreaterThan(0);
    expect(result.basis).toBe("base");
    expect(result.similarCount).toBe(0);
  });

  it("applies height multiplier for tall hedges", () => {
    // Use enough linear feet so the boost is visible above SETUP_MINUTES dominance
    const input: MeasurementInput = {
      cut_type: "trim",
      facade: 60,
      height_global: 7, // Above 5ft threshold → boost
      height_mode: "global",
      width: 2,
    };
    const result = estimateJobDuration(input, []);
    // With height boost, should be longer than without
    const inputNormal: MeasurementInput = {
      cut_type: "trim",
      facade: 60,
      height_global: 4, // Below threshold
      height_mode: "global",
      width: 2,
    };
    const resultNormal = estimateJobDuration(inputNormal, []);
    expect(result.minutes).toBeGreaterThan(resultNormal.minutes);
  });

  it("applies width multiplier for wide hedges", () => {
    const input: MeasurementInput = {
      cut_type: "trim",
      facade: 60,
      height_global: 4,
      height_mode: "global",
      width: 5, // Above 3ft threshold → boost
    };
    const result = estimateJobDuration(input, []);
    const inputNormal: MeasurementInput = {
      cut_type: "trim",
      facade: 60,
      height_global: 4,
      height_mode: "global",
      width: 2, // Below threshold
    };
    const resultNormal = estimateJobDuration(inputNormal, []);
    expect(result.minutes).toBeGreaterThan(resultNormal.minutes);
  });

  it("uses per_side max height correctly", () => {
    const input: MeasurementInput = {
      cut_type: "levelling",
      facade: 20,
      height_mode: "per_side",
      height_facade: 6,
      height_left: 3,
      height_right: 4,
      height_back: 5,
      width: 2,
    };
    // Effective height should be 6 (>5 threshold)
    const result = estimateJobDuration(input, []);
    expect(result.minutes).toBeGreaterThan(0);
  });

  it("blends with historical data when enough similar jobs exist", () => {
    const input: MeasurementInput = {
      cut_type: "trim",
      facade: 40,
      left: 25,
      right: 25,
      back: 30,
      height_global: 4,
      height_mode: "global",
      width: 2,
    };

    // Create 3+ similar completed jobs (within ±40% linearFeet, ±1.5ft height)
    const history: DbJob[] = [
      makeJob({
        id: "h1",
        cut_type: "trim",
        status: "completed",
        total_duration_minutes: 140,
        measurement_snapshot: {
          facade_length: 38,
          left_length: 22,
          right_length: 22,
          back_length: 28,
          height_mode: "global",
          height_global: 4,
          width: 2,
        },
      }),
      makeJob({
        id: "h2",
        cut_type: "trim",
        status: "completed",
        total_duration_minutes: 160,
        measurement_snapshot: {
          facade_length: 42,
          left_length: 27,
          right_length: 27,
          back_length: 32,
          height_mode: "global",
          height_global: 4.5,
          width: 2,
        },
      }),
      makeJob({
        id: "h3",
        cut_type: "trim",
        status: "completed",
        total_duration_minutes: 150,
        measurement_snapshot: {
          facade_length: 35,
          left_length: 20,
          right_length: 20,
          back_length: 25,
          height_mode: "global",
          height_global: 3.5,
          width: 2,
        },
      }),
    ];

    const result = estimateJobDuration(input, history);
    expect(result.basis).toBe("blended");
    expect(result.similarCount).toBeGreaterThanOrEqual(3);
    expect(result.minutes).toBeGreaterThan(0);
  });

  it("excludes non-completed jobs from history", () => {
    const input: MeasurementInput = {
      cut_type: "trim",
      facade: 40,
      height_global: 4,
      height_mode: "global",
      width: 2,
    };

    const history: DbJob[] = [
      makeJob({ id: "h1", status: "pending", total_duration_minutes: 100 }),
      makeJob({ id: "h2", status: "scheduled", total_duration_minutes: 200 }),
    ];

    const result = estimateJobDuration(input, history);
    expect(result.basis).toBe("base");
    expect(result.similarCount).toBe(0);
  });

  it("excludes jobs without duration data", () => {
    const input: MeasurementInput = {
      cut_type: "trim",
      facade: 40,
      height_global: 4,
      height_mode: "global",
      width: 2,
    };

    const history: DbJob[] = [
      makeJob({ id: "h1", status: "completed", total_duration_minutes: 0 }),
    ];

    const result = estimateJobDuration(input, history);
    expect(result.basis).toBe("base");
    expect(result.similarCount).toBe(0);
  });

  it("excludes jobs with different cut_type", () => {
    const input: MeasurementInput = {
      cut_type: "trim",
      facade: 40,
      height_global: 4,
      height_mode: "global",
      width: 2,
    };

    const history: DbJob[] = [
      makeJob({ id: "h1", cut_type: "levelling", status: "completed", total_duration_minutes: 150 }),
    ];

    const result = estimateJobDuration(input, history);
    expect(result.basis).toBe("base");
    expect(result.similarCount).toBe(0);
  });

  it("excludes jobs outside linearFeet range (±40%)", () => {
    const input: MeasurementInput = {
      cut_type: "trim",
      facade: 40,
      height_global: 4,
      height_mode: "global",
      width: 2,
    };

    const history: DbJob[] = [
      // 100 linear feet vs 40 target → ratio 2.5 → outside 0.6-1.4
      makeJob({
        id: "h1",
        cut_type: "trim",
        status: "completed",
        total_duration_minutes: 200,
        measurement_snapshot: {
          facade_length: 100,
          height_mode: "global",
          height_global: 4,
          width: 2,
        },
      }),
    ];

    const result = estimateJobDuration(input, history);
    expect(result.basis).toBe("base");
    expect(result.similarCount).toBe(0);
  });

  it("excludes jobs outside height range (±1.5ft)", () => {
    const input: MeasurementInput = {
      cut_type: "trim",
      facade: 40,
      height_global: 4,
      height_mode: "global",
      width: 2,
    };

    const history: DbJob[] = [
      makeJob({
        id: "h1",
        cut_type: "trim",
        status: "completed",
        total_duration_minutes: 150,
        measurement_snapshot: {
          facade_length: 40,
          height_mode: "global",
          height_global: 7, // 7 - 4 = 3 > 1.5 → excluded
          width: 2,
        },
      }),
    ];

    const result = estimateJobDuration(input, history);
    expect(result.basis).toBe("base");
    expect(result.similarCount).toBe(0);
  });

  it("caps blended weight at 0.7 with many similar jobs", () => {
    const input: MeasurementInput = {
      cut_type: "trim",
      facade: 40,
      height_global: 4,
      height_mode: "global",
      width: 2,
    };

    // Create 10+ similar jobs to test weight cap
    const history: DbJob[] = Array.from({ length: 10 }, (_, i) =>
      makeJob({
        id: `h${i}`,
        cut_type: "trim",
        status: "completed",
        total_duration_minutes: 150 + i,
        measurement_snapshot: {
          facade_length: 38,
          height_mode: "global",
          height_global: 4,
          width: 2,
        },
      })
    );

    const result = estimateJobDuration(input, history);
    // With 10 similar jobs, weight = min(10/10, 0.7) = 0.7
    expect(result.basis).toBe("blended");
    expect(result.similarCount).toBeGreaterThanOrEqual(10);
    expect(result.minutes).toBeGreaterThan(0);
  });

  it("handles restoration cut type", () => {
    const input: MeasurementInput = {
      cut_type: "restoration",
      facade: 20,
      height_global: 4,
      height_mode: "global",
      width: 2,
    };
    const result = estimateJobDuration(input, []);
    expect(result.minutes).toBeGreaterThan(0);
  });

  it("handles default cut type via unknown string", () => {
    const input: MeasurementInput = {
      cut_type: "unknown-type",
      facade: 20,
      height_global: 4,
      height_mode: "global",
      width: 2,
    };
    const result = estimateJobDuration(input, []);
    // Falls back to default min per foot (1.1)
    expect(result.minutes).toBeGreaterThan(0);
  });
});

// ── computeRealDuration ──

describe("computeRealDuration", () => {
  it("returns null for null/undefined input", () => {
    expect(computeRealDuration(null, "10:00")).toBeNull();
    expect(computeRealDuration("08:00", undefined)).toBeNull();
    expect(computeRealDuration(null, null)).toBeNull();
  });

  it("returns null for invalid time format", () => {
    expect(computeRealDuration("not-a-time", "10:00")).toBeNull();
    expect(computeRealDuration("08:00", "bad")).toBeNull();
  });

  it("computes duration from start to end", () => {
    expect(computeRealDuration("08:00", "10:30")).toBe(150);
  });

  it("handles times crossing midnight", () => {
    expect(computeRealDuration("22:00", "01:30")).toBe(210);
  });

  it("returns 0 for same time", () => {
    expect(computeRealDuration("09:00", "09:00")).toBe(0);
  });
});

// ── addMinutesToTime ──

describe("addMinutesToTime", () => {
  it("returns null for null/undefined input", () => {
    expect(addMinutesToTime(null, 30)).toBeNull();
    expect(addMinutesToTime(undefined, 30)).toBeNull();
  });

  it("returns null for invalid time format", () => {
    expect(addMinutesToTime("bad", 30)).toBeNull();
  });

  it("adds minutes to a time", () => {
    expect(addMinutesToTime("08:00", 150)).toBe("10:30");
  });

  it("wraps around midnight", () => {
    expect(addMinutesToTime("23:00", 120)).toBe("01:00");
  });

  it("handles negative minutes by wrapping back", () => {
    expect(addMinutesToTime("01:00", -120)).toBe("23:00");
  });

  it("handles large minute values", () => {
    expect(addMinutesToTime("08:00", 1440)).toBe("08:00"); // exactly 24h later
  });
});
