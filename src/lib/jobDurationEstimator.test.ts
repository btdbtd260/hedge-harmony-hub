import { describe, it, expect } from "vitest";
import {
  estimateJobDuration,
  measurementsFromJob,
  computeRealDuration,
  addMinutesToTime,
  computeTotalPauseMinutes,
  parseTimeToMinutes,
  computeElapsedMinutes,
  formatDurationMinutes,
  workedTimeInfo,
  getActivePause,
  isDateTimeFormat,
  parseDateTime,
  getCurrentDateTimeStr,
  type MeasurementInput,
} from "@/lib/jobDurationEstimator";
import type { PauseInterval } from "@/types";
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
      height_global: 7, // Above 5ft threshold -> boost
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
      width: 5, // Above 3ft threshold -> boost
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

    // Create 3+ similar completed jobs (within +-40% linearFeet, +-1.5ft height)
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

  it("excludes jobs outside linearFeet range (+-40%)", () => {
    const input: MeasurementInput = {
      cut_type: "trim",
      facade: 40,
      height_global: 4,
      height_mode: "global",
      width: 2,
    };

    const history: DbJob[] = [
      // 100 linear feet vs 40 target -> ratio 2.5 -> outside 0.6-1.4
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

  it("excludes jobs outside height range (+-1.5ft)", () => {
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
          height_global: 7, // 7 - 4 = 3 > 1.5 -> excluded
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
        id: "h" + i,
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

// -- computeRealDuration --

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

// -- addMinutesToTime --

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

// -- computeTotalPauseMinutes --

describe("computeTotalPauseMinutes", () => {

  it("returns 0 for null/undefined/empty pauses", () => {
    expect(computeTotalPauseMinutes(null)).toBe(0);
    expect(computeTotalPauseMinutes(undefined)).toBe(0);
    expect(computeTotalPauseMinutes([])).toBe(0);
  });

  it("sums single pause interval", () => {
    expect(computeTotalPauseMinutes([{ start: "12:00", end: "12:15" }])).toBe(15);
  });

  it("sums multiple pause intervals", () => {
    expect(computeTotalPauseMinutes([
      { start: "10:00", end: "10:10" },
      { start: "12:00", end: "12:30" },
    ])).toBe(40);
  });

  it("handles pauses crossing midnight", () => {
    expect(computeTotalPauseMinutes([{ start: "23:45", end: "00:15" }])).toBe(30);
  });

  it("treats end-before-start as midnight crossing (23h 30m)", () => {
    // When end < start, the function assumes midnight crossing
    // Since computeElapsedMinutes handles this, it returns 1410 min
    expect(computeTotalPauseMinutes([{ start: "12:30", end: "12:00" }])).toBe(1410);
  });

  it("counts active pause (no end) up to provided now", () => {
    expect(computeTotalPauseMinutes([{ start: "10:00" }], "10:15")).toBe(15);
  });

  it("counts active pause with current time when no now provided", () => {
    const result = computeTotalPauseMinutes([{ start: "00:00" }]);
    expect(result).toBeGreaterThan(0);
  });

  it("handles mixed completed and active pauses", () => {
    expect(computeTotalPauseMinutes([
      { start: "09:00", end: "09:10" },
      { start: "10:00" },
    ], "10:30")).toBe(40); // 10 completed + 30 active
  });
});

// -- getActivePause --

describe("getActivePause", () => {

  it("returns undefined for null/undefined/empty", () => {
    expect(getActivePause(null)).toBeUndefined();
    expect(getActivePause(undefined)).toBeUndefined();
    expect(getActivePause([])).toBeUndefined();
  });

  it("returns undefined when all pauses have end", () => {
    expect(getActivePause([{ start: "09:00", end: "09:10" }])).toBeUndefined();
  });

  it("finds the active pause (no end)", () => {
    const active = { start: "10:00" } as PauseInterval;
    expect(getActivePause([{ start: "09:00", end: "09:10" }, active])).toBe(active);
  });
});

// -- computeRealDuration with pauses --

describe("computeRealDuration with pauses", () => {

  it("subtracts pauses from elapsed time", () => {
    const result = computeRealDuration("08:00", "10:30", [
      { start: "09:00", end: "09:15" },
    ]);
    // 150 min elapsed - 15 min pause = 135 min
    expect(result).toBe(135);
  });

  it("returns same as elapsed when no pauses", () => {
    const result = computeRealDuration("08:00", "10:30", []);
    expect(result).toBe(150);
  });

  it("returns same as elapsed when pauses is null/undefined", () => {
    expect(computeRealDuration("08:00", "10:30", null)).toBe(150);
    expect(computeRealDuration("08:00", "10:30", undefined)).toBe(150);
  });

  it("handles multiple pauses", () => {
    const result = computeRealDuration("08:00", "12:00", [
      { start: "09:00", end: "09:10" },
      { start: "10:30", end: "10:45" },
      { start: "11:30", end: "11:35" },
    ]);
    // 240 min elapsed - 30 min total pause = 210 min
    expect(result).toBe(210);
  });

  it("returns 0 if pauses exceed elapsed time", () => {
    const result = computeRealDuration("08:00", "09:00", [
      { start: "08:00", end: "09:00" },
    ]);
    expect(result).toBe(0);
  });
});

// -- formatDurationMinutes --

describe("formatDurationMinutes", () => {

  it("formats 0 minutes", () => {
    expect(formatDurationMinutes(0)).toBe("0m");
  });

  it("formats less than an hour", () => {
    expect(formatDurationMinutes(45)).toBe("45m");
  });

  it("formats exactly one hour", () => {
    expect(formatDurationMinutes(60)).toBe("1h");
  });

  it("formats hours and minutes", () => {
    expect(formatDurationMinutes(150)).toBe("2h 30m");
  });

  it("formats multiple hours", () => {
    expect(formatDurationMinutes(480)).toBe("8h");
  });
});

// -- parseTimeToMinutes --

describe("parseTimeToMinutes", () => {

  it("parses valid time", () => {
    expect(parseTimeToMinutes("08:30")).toBe(510);
  });

  it("returns null for null/undefined", () => {
    expect(parseTimeToMinutes(null)).toBeNull();
    expect(parseTimeToMinutes(undefined)).toBeNull();
  });

  it("returns null for invalid format", () => {
    expect(parseTimeToMinutes("bad")).toBeNull();
  });
});

// -- computeElapsedMinutes --

describe("computeElapsedMinutes", () => {

  it("computes elapsed time", () => {
    expect(computeElapsedMinutes("08:00", "10:30")).toBe(150);
  });

  it("handles midnight crossing", () => {
    expect(computeElapsedMinutes("22:00", "01:30")).toBe(210);
  });

  it("returns null for invalid input", () => {
    expect(computeElapsedMinutes(null, "10:00")).toBeNull();
  });
});

// -- workedTimeInfo --

describe("workedTimeInfo", () => {

  it("returns info without pauses", () => {
    const info = workedTimeInfo("08:00", "10:30", []);
    expect(info.elapsed).toBe(150);
    expect(info.worked).toBe(150);
    expect(info.pauseTotal).toBe(0);
    expect(info.label).toBe("2h 30m");
  });

  it("returns info with pauses", () => {
    const info = workedTimeInfo("08:00", "10:30", [
      { start: "09:00", end: "09:15" },
    ]);
    expect(info.elapsed).toBe(150);
    expect(info.worked).toBe(135);
    expect(info.pauseTotal).toBe(15);
    expect(info.label).toContain("2h 15m");
    expect(info.label).toContain("pause");
  });

  it("returns null elapsed for missing times", () => {
    const info = workedTimeInfo(null, "10:00", []);
    expect(info.elapsed).toBeNull();
    expect(info.worked).toBeNull();
    expect(info.label).toBe("");
  });
});

// ================================================================
// DATETIME TESTS
// ================================================================

// -- isDateTimeFormat --

describe("isDateTimeFormat", () => {

  it("returns true for YYYY-MM-DDTHH:mm format", () => {
    expect(isDateTimeFormat("2026-05-31T08:00")).toBe(true);
  });

  it("returns false for legacy HH:mm", () => {
    expect(isDateTimeFormat("08:00")).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isDateTimeFormat(null)).toBe(false);
    expect(isDateTimeFormat(undefined)).toBe(false);
  });

  it("returns false for invalid strings", () => {
    expect(isDateTimeFormat("not-a-date")).toBe(false);
    expect(isDateTimeFormat("2026-05-31")).toBe(false);
  });
});

// -- parseDateTime --

describe("parseDateTime", () => {

  it("parses valid datetime string", () => {
    const d = parseDateTime("2026-05-31T08:00");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(4); // 0-indexed: May = 4
    expect(d!.getDate()).toBe(31);
    expect(d!.getHours()).toBe(8);
    expect(d!.getMinutes()).toBe(0);
  });

  it("returns null for legacy HH:mm", () => {
    expect(parseDateTime("08:00")).toBeNull();
  });

  it("returns null for null/undefined", () => {
    expect(parseDateTime(null)).toBeNull();
    expect(parseDateTime(undefined)).toBeNull();
  });
});

// -- getCurrentDateTimeStr --

describe("getCurrentDateTimeStr", () => {

  it("returns a string in YYYY-MM-DDTHH:mm format", () => {
    const result = getCurrentDateTimeStr();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("returns a valid date part that can be parsed", () => {
    const result = getCurrentDateTimeStr();
    const datePart = result.substring(0, 10);
    expect(datePart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// -- computeElapsedMinutes with datetime --

describe("computeElapsedMinutes with datetime", () => {

  it("computes duration for same-day datetimes", () => {
    expect(computeElapsedMinutes("2026-05-31T08:00", "2026-05-31T10:30")).toBe(150);
  });

  it("computes duration across multiple days", () => {
    // From May 31 22:00 to June 1 01:30 = 210 min
    expect(computeElapsedMinutes("2026-05-31T22:00", "2026-06-01T01:30")).toBe(210);
  });

  it("computes duration across 2+ days", () => {
    // From May 31 08:00 to June 2 10:00 = 50h = 3000 min
    const result = computeElapsedMinutes("2026-05-31T08:00", "2026-06-02T10:00");
    expect(result).toBe(3000);
  });

  it("returns null for null/undefined with datetime", () => {
    expect(computeElapsedMinutes(null, "2026-05-31T10:00")).toBeNull();
    expect(computeElapsedMinutes("2026-05-31T08:00", undefined)).toBeNull();
  });

  it("handles mixed datetime and HH:mm with jobScheduledDate fallback", () => {
    // If start is a datetime, and end is HH:mm, use the start's date as fallback
    expect(computeElapsedMinutes("2026-05-31T08:00", "10:30", "2026-05-31")).toBe(150);
  });

  it("handles mixed datetime and HH:mm midnight crossing", () => {
    // start is datetime at 22:00, end is HH:mm at 01:30 -> should detect as next day
    expect(computeElapsedMinutes("2026-05-31T22:00", "01:30")).toBe(210);
  });
});

// -- computeTotalPauseMinutes with datetime pauses --

describe("computeTotalPauseMinutes with datetime pauses", () => {

  it("sums pauses with full datetime start/end", () => {
    const pauses = [
      { start: "2026-05-31T12:00", end: "2026-05-31T12:15" },
    ];
    expect(computeTotalPauseMinutes(pauses)).toBe(15);
  });

  it("handles pause spanning midnight with datetimes", () => {
    const pauses = [
      { start: "2026-05-31T23:45", end: "2026-06-01T00:15" },
    ];
    expect(computeTotalPauseMinutes(pauses)).toBe(30);
  });

  it("handles legacy HH:mm pauses with jobScheduledDate fallback", () => {
    const pauses: PauseInterval[] = [
      { start: "12:00", end: "12:15" },
    ];
    expect(computeTotalPauseMinutes(pauses, undefined, "2026-05-31")).toBe(15);
  });

  it("handles mixed datetime and HH:mm pauses", () => {
    const pauses = [
      { start: "2026-05-31T12:00", end: "12:15" },
    ];
    expect(computeTotalPauseMinutes(pauses, undefined, "2026-05-31")).toBe(15);
  });

  it("counts active datetime pause up to now", () => {
    const pauses = [
      { start: "2026-05-31T10:00" },
    ];
    expect(computeTotalPauseMinutes(pauses, "2026-05-31T10:15")).toBe(15);
  });
});

// -- computeRealDuration with datetime --

describe("computeRealDuration with datetime", () => {

  it("computes worked duration with datetime start/end", () => {
    const result = computeRealDuration(
      "2026-05-31T08:00",
      "2026-05-31T10:30",
      [{ start: "2026-05-31T09:00", end: "2026-05-31T09:15" }],
    );
    expect(result).toBe(135); // 150 - 15 = 135
  });

  it("computes multi-day worked duration", () => {
    const result = computeRealDuration(
      "2026-05-31T08:00",
      "2026-06-01T10:00", // 26h later = 1560 min
      [{ start: "2026-05-31T12:00", end: "2026-05-31T12:30" }], // 30min pause
    );
    expect(result).toBe(1530); // 1560 - 30
  });

  it("works with legacy HH:mm values", () => {
    const result = computeRealDuration(
      "08:00",
      "10:30",
      [{ start: "09:00", end: "09:15" }],
    );
    expect(result).toBe(135);
  });
});

// -- workedTimeInfo with datetime --

describe("workedTimeInfo with datetime", () => {

  it("returns info with datetime values", () => {
    const info = workedTimeInfo(
      "2026-05-31T08:00",
      "2026-05-31T10:30",
      [{ start: "2026-05-31T09:00", end: "2026-05-31T09:15" }],
    );
    expect(info.elapsed).toBe(150);
    expect(info.worked).toBe(135);
    expect(info.pauseTotal).toBe(15);
    expect(info.label).toContain("2h 15m");
  });

  it("handles multi-day job", () => {
    const info = workedTimeInfo(
      "2026-05-31T22:00",
      "2026-06-01T02:00",
      [],
    );
    expect(info.elapsed).toBe(240); // 4 hours
    expect(info.worked).toBe(240);
  });
});

// -- getCurrentDateTimeStr in pause workflows --

describe("getCurrentDateTimeStr usage in pause workflows", () => {

  it("returns a full datetime for handlePause", () => {
    const pauseStart = getCurrentDateTimeStr();
    expect(pauseStart).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("returns a full datetime for handleResume", () => {
    const pauseEnd = getCurrentDateTimeStr();
    expect(pauseEnd).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("default completion time returns full datetime", () => {
    const completionTime = getCurrentDateTimeStr();
    expect(completionTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});
