// ============================================================
// Job duration estimator
// ============================================================
// Estimates how long a job should take (in minutes) based on:
//   1) The job's measurements (length, height, width, cut type, bushes, extras)
//   2) Historical "similar" completed jobs (the more history we have,
//      the more the estimate is influenced by real data)
//
// Formula (transparent + extensible):
//
//   linearFeet = facade + left + right + back + backLeft + backRight
//   effectiveHeight = max of height_global / per-side heights (>= 1)
//   effectiveWidth = width (>= 1)
//
//   baseMinutes = linearFeet * BASE_MIN_PER_FOOT[cutType]
//                 * heightFactor(effectiveHeight)
//                 * widthFactor(effectiveWidth)
//                 + bushesCount * MIN_PER_BUSH
//                 + extrasCount * MIN_PER_EXTRA
//                 + SETUP_MINUTES
//
//   If we have >= MIN_HISTORY similar completed jobs:
//     historicalMinPerFoot = average(real_min / linearFeet) on similar jobs
//     blended = baseMinutes * (1 - w) + (historicalMinPerFoot * linearFeet * factors + extras...) * w
//     where w = min(similarCount / 10, 0.7)  (cap historical influence at 70%)
//
// Similarity rules (cheap + explainable):
//   - same cut_type
//   - linearFeet within +/- 40 %
//   - effectiveHeight within +/- 1.5 ft
//
// Result is rounded to the nearest 5 minutes, min 15 min.
// ============================================================

import type { DbJob } from "@/hooks/useSupabaseData";
import type { PauseInterval } from "@/types";

// Tunable constants - kept in one place for clarity / future tuning
const BASE_MIN_PER_FOOT = {
  trim: 0.9,        // ~54 sec per linear foot for a basic trim ("Taillage")
  levelling: 1.6,   // levelling is heavier work ("Nivelage")
  restoration: 2.2, // restoration is the heaviest - overgrown / re-shaping work
  default: 1.1,
};
const MIN_PER_BUSH = 6;
const MIN_PER_EXTRA = 10;
const SETUP_MINUTES = 20; // travel, equipment setup, cleanup

const HEIGHT_THRESHOLD = 5;     // feet
const HEIGHT_BOOST = 1.35;      // multiplier when above threshold
const WIDTH_THRESHOLD = 3;      // feet
const WIDTH_BOOST = 1.2;

const MIN_HISTORY = 3;          // need at least this many similar jobs to blend

// --- helpers ---
function num(v: any, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export interface MeasurementInput {
  cut_type?: string | null;
  facade?: number;
  left?: number;
  right?: number;
  back?: number;
  back_left?: number;
  back_right?: number;
  height_mode?: "global" | "per_side" | string | null;
  height_global?: number;
  height_facade?: number;
  height_left?: number;
  height_right?: number;
  height_back?: number;
  height_back_left?: number;
  height_back_right?: number;
  width?: number;
  bushes_count?: number;
  extras_count?: number;
}

/** Extract pauses from a DbJob's measurement_snapshot.
 *  Reads job.measurement_snapshot.pauses (the canonical storage location).
 *  Returns an empty array if missing or malformed. */
export function getPausesFromJob(job: DbJob | null | undefined): PauseInterval[] {
  const snap = (job?.measurement_snapshot ?? {}) as any;
  const p = snap.pauses;
  return Array.isArray(p) ? p : [];
}

export function measurementsFromJob(job: DbJob): MeasurementInput {
  const s = (job.measurement_snapshot ?? {}) as any;
  return {
    cut_type: job.cut_type,
    facade: num(s.facadeLength ?? s.facade_length),
    left: num(s.leftLength ?? s.left_length),
    right: num(s.rightLength ?? s.right_length),
    back: num(s.backLength ?? s.back_length),
    back_left: num(s.backLeftLength ?? s.back_left_length),
    back_right: num(s.backRightLength ?? s.back_right_length),
    height_mode: s.heightMode ?? s.height_mode,
    height_global: num(s.heightGlobal ?? s.height_global, 4),
    height_facade: num(s.heightFacade ?? s.height_facade),
    height_left: num(s.heightLeft ?? s.height_left),
    height_right: num(s.heightRight ?? s.height_right),
    height_back: num(s.heightBack ?? s.height_back),
    height_back_left: num(s.heightBackLeft ?? s.height_back_left),
    height_back_right: num(s.heightBackRight ?? s.height_back_right),
    width: num(s.width, 2),
    bushes_count: num(s.bushesCount ?? s.bushes_count),
    extras_count: Array.isArray(s.extras) ? s.extras.length : 0,
  };
}

function linearFeet(m: MeasurementInput): number {
  return (
    num(m.facade) + num(m.left) + num(m.right) +
    num(m.back) + num(m.back_left) + num(m.back_right)
  );
}

function effectiveHeight(m: MeasurementInput): number {
  if (m.height_mode === "per_side") {
    return Math.max(
      num(m.height_facade), num(m.height_left), num(m.height_right),
      num(m.height_back), num(m.height_back_left), num(m.height_back_right),
      1,
    );
  }
  return Math.max(num(m.height_global, 4), 1);
}

function basePrediction(m: MeasurementInput): number {
  const lf = linearFeet(m);
  if (lf <= 0) return 0;

  const cut = (m.cut_type ?? "trim") as keyof typeof BASE_MIN_PER_FOOT;
  const minPerFoot = BASE_MIN_PER_FOOT[cut] ?? BASE_MIN_PER_FOOT.default;

  const h = effectiveHeight(m);
  const w = Math.max(num(m.width, 2), 1);
  const heightFactor = h > HEIGHT_THRESHOLD ? HEIGHT_BOOST : 1;
  const widthFactor = w > WIDTH_THRESHOLD ? WIDTH_BOOST : 1;

  const cutting = lf * minPerFoot * heightFactor * widthFactor;
  const bushes = num(m.bushes_count) * MIN_PER_BUSH;
  const extras = num(m.extras_count) * MIN_PER_EXTRA;

  return cutting + bushes + extras + SETUP_MINUTES;
}

/** Pick completed jobs whose measurements are close enough to be informative. */
function findSimilarJobs(
  target: MeasurementInput,
  history: DbJob[],
): { job: DbJob; minPerFoot: number }[] {
  const targetLf = linearFeet(target);
  const targetH = effectiveHeight(target);
  if (targetLf <= 0) return [];

  const out: { job: DbJob; minPerFoot: number }[] = [];
  for (const j of history) {
    if (j.status !== "completed") continue;
    if (!j.total_duration_minutes || j.total_duration_minutes <= 0) continue;
    if (j.cut_type !== target.cut_type) continue;

    const m = measurementsFromJob(j);
    const lf = linearFeet(m);
    if (lf <= 0) continue;

    const lfRatio = lf / targetLf;
    if (lfRatio < 0.6 || lfRatio > 1.4) continue;

    const h = effectiveHeight(m);
    if (Math.abs(h - targetH) > 1.5) continue;

    out.push({ job: j, minPerFoot: j.total_duration_minutes / lf });
  }
  return out;
}

/** Round up to nearest 5 minutes, min 15. */
function tidy(minutes: number): number {
  const m = Math.max(15, Math.round(minutes / 5) * 5);
  return m;
}

export interface EstimationResult {
  minutes: number;
  basis: "base" | "blended";
  similarCount: number;
  /** Human-readable explanation, useful for tooltips / debugging. */
  explanation: string;
}

/**
 * Estimate the expected duration (minutes) for a job.
 * Blends a transparent base formula with the average pace of similar past jobs.
 */
export function estimateJobDuration(
  input: MeasurementInput,
  history: DbJob[] = [],
): EstimationResult {
  const base = basePrediction(input);
  if (base <= 0) {
    return { minutes: 0, basis: "base", similarCount: 0, explanation: "Aucune mesure renseignee." };
  }

  const similar = findSimilarJobs(input, history);
  if (similar.length < MIN_HISTORY) {
    return {
      minutes: tidy(base),
      basis: "base",
      similarCount: similar.length,
      explanation: "Estimation de base (" + similar.length + " job(s) similaire(s) dans l'historique, min " + MIN_HISTORY + ").",
    };
  }

  // Historical pace blended with the base formula
  const lf = linearFeet(input);
  const h = effectiveHeight(input);
  const w = Math.max(num(input.width, 2), 1);
  const heightFactor = h > HEIGHT_THRESHOLD ? HEIGHT_BOOST : 1;
  const widthFactor = w > WIDTH_THRESHOLD ? WIDTH_BOOST : 1;

  const avgMinPerFoot = similar.reduce((s, x) => s + x.minPerFoot, 0) / similar.length;
  const histCutting = avgMinPerFoot * lf * (heightFactor / 1) * (widthFactor / 1);
  const histTotal =
    histCutting +
    num(input.bushes_count) * MIN_PER_BUSH +
    num(input.extras_count) * MIN_PER_EXTRA +
    SETUP_MINUTES;

  const weight = Math.min(similar.length / 10, 0.7); // cap at 70 %
  const blended = base * (1 - weight) + histTotal * weight;

  return {
    minutes: tidy(blended),
    basis: "blended",
    similarCount: similar.length,
    explanation: "Melange : " + Math.round((1 - weight) * 100) + "% formule de base + " + Math.round(weight * 100) + "% historique (" + similar.length + " jobs similaires, " + avgMinPerFoot.toFixed(2) + " min/pi).",
  };
}

// ===============================================================
// DATETIME HELPERS
// ===============================================================

/** Regex for a full datetime string "YYYY-MM-DDTHH:mm" */
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Check whether a string is a full datetime (vs legacy "HH:mm"). */
export function isDateTimeFormat(str: string | null | undefined): boolean {
  if (!str) return false;
  return DATETIME_RE.test(str);
}

/** Parse a full datetime string "YYYY-MM-DDTHH:mm" into a Date.
 *  Returns null for invalid/missing input or legacy HH:mm strings. */
export function parseDateTime(str: string | null | undefined): Date | null {
  if (!str) return null;
  if (isDateTimeFormat(str)) {
    // Append ":00" seconds so the ISO parser works
    const d = new Date(str + ":00");
    return Number.isFinite(d.getTime()) ? d : null;
  }
  return null;
}

/** Get the current date+time as "YYYY-MM-DDTHH:mm". */
export function getCurrentDateTimeStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return y + "-" + mo + "-" + day + "T" + h + ":" + mi;
}

/** Parse "HH:mm" into total minutes since midnight. */
export function parseTimeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const m = time.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Build a full Date from "YYYY-MM-DD" and "HH:mm".
 * Returns null if either part is missing/invalid.
 */
function combineDateAndTime(dateStr: string | null | undefined, timeStr: string | null | undefined): Date | null {
  if (!dateStr || !timeStr) return null;
  // dateStr is expected as "YYYY-MM-DD"
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const time = parseTimeToMinutes(timeStr);
  if (time === null) return null;
  // Parse date parts as local (avoid TZ shift)
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  date.setHours(Math.floor(time / 60), time % 60, 0, 0);
  return date;
}

/**
 * Normalize a time/datetime value to a Date for computation.
 */
function toDate(value: string | null | undefined, jobDate?: string | null | undefined): Date | null {
  if (!value) return null;

  // Try full datetime first
  const dt = parseDateTime(value);
  if (dt) return dt;

  // Legacy HH:mm - try to combine with job date
  if (jobDate && parseTimeToMinutes(value) !== null) {
    return combineDateAndTime(jobDate, value);
  }

  return null;
}

/**
 * Compute total elapsed minutes from start to end.
 *
 * Supports:
 *  - Both values as full datetime "YYYY-MM-DDTHH:mm" -> precise diff
 *  - Both values as legacy "HH:mm" -> old logic (handles midnight crossing)
 *  - Mixed formats -> uses jobScheduledDate as fallback date for HH:mm values
 *
 * Returns elapsed wall-clock time (NOT accounting for pauses).
 */
export function computeElapsedMinutes(
  start: string | null | undefined,
  end: string | null | undefined,
  jobScheduledDate?: string | null | undefined,
): number | null {
  if (!start || !end) return null;

  const startIsDt = isDateTimeFormat(start);
  const endIsDt = isDateTimeFormat(end);

  // If both are full datetimes -> precise Date diff
  if (startIsDt && endIsDt) {
    const s = parseDateTime(start);
    const e = parseDateTime(end);
    if (!s || !e) return null;
    return (e.getTime() - s.getTime()) / 60000;
  }

  // If one or both are legacy HH:mm, try to get dates
  if (startIsDt || endIsDt) {
    // At least one is a datetime: use that date as the reference
    const refParsed = parseDateTime(startIsDt ? start : end);
    if (!refParsed) return null;

    // Build the reference date string "YYYY-MM-DD" from the datetime
    const refStr = startIsDt ? start! : end!;
    const refDateStr = refStr.substring(0, 10);

    const s = startIsDt ? parseDateTime(start) : combineDateAndTime(refDateStr, start);
    const eVal = endIsDt ? parseDateTime(end) : combineDateAndTime(refDateStr, end);
    if (!s || !eVal) return null;

    const diff = (eVal.getTime() - s.getTime()) / 60000;
    // If negative, the HH:mm likely refers to the next day (midnight crossing)
    if (diff < 0) {
      eVal.setDate(eVal.getDate() + 1);
      return (eVal.getTime() - s.getTime()) / 60000;
    }
    return diff;
  }

  // Both legacy HH:mm - use old logic (with optional jobDate as fallback for midnight)
  const s = parseTimeToMinutes(start);
  const e = parseTimeToMinutes(end);
  if (s === null || e === null) return null;
  if (e < s) return e + 24 * 60 - s;
  return e - s;
}

function getCurrentHHMM(): string {
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

/**
 * Compute total pause duration in minutes from an array of pause intervals.
 * Active pauses (end is null/undefined) are counted up to 
ow.
 * If 
ow is not provided, uses the current time.
 * jobScheduledDate is used as fallback date for legacy HH:mm pause values.
 */
export function computeTotalPauseMinutes(
  pauses: PauseInterval[] | null | undefined,
  now?: string,
  jobScheduledDate?: string | null | undefined,
): number {
  if (!pauses || !Array.isArray(pauses) || pauses.length === 0) return 0;
  let total = 0;
  for (const p of pauses) {
    const end = p.end ?? now ?? getCurrentDateTimeStr();
    const duration = computeElapsedMinutes(p.start, end, jobScheduledDate);
    if (duration !== null && duration > 0) {
      total += duration;
    }
  }
  return total;
}

/**
 * Compute real WORKED duration in minutes = elapsed time minus total pause time.
 * This is the value stored as total_duration_minutes for completed jobs.
 */
export function computeRealDuration(
  start: string | null | undefined,
  end: string | null | undefined,
  pauses?: PauseInterval[] | null | undefined,
  jobScheduledDate?: string | null | undefined,
): number | null {
  const elapsed = computeElapsedMinutes(start, end, jobScheduledDate);
  if (elapsed === null) return null;
  const pauseTotal = computeTotalPauseMinutes(pauses, end ?? undefined, jobScheduledDate);
  return Math.max(0, elapsed - pauseTotal);
}

/** Add minutes to "HH:mm" -> "HH:mm" (wraps within a single day display). */
export function addMinutesToTime(time: string | null | undefined, minutes: number): string | null {
  if (!time) return null;
  const m = time.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const total = Number(m[1]) * 60 + Number(m[2]) + minutes;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const mm = String(wrapped % 60).padStart(2, "0");
  return hh + ":" + mm;
}

/** Format a duration in minutes to a human-readable string like "2h 30m" or "45m". */
export function formatDurationMinutes(minutes: number): string {
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return h + "h " + m + "m";
  if (h > 0) return h + "h";
  return m + "m";
}

/**
 * Get the active (ongoing) pause from an array, if any.
 */
export function getActivePause(pauses: PauseInterval[] | null | undefined): PauseInterval | undefined {
  if (!pauses || !Array.isArray(pauses)) return undefined;
  return pauses.find((p) => !p.end);
}

/**
 * Compute worked (pause-adjusted) duration and return both elapsed and worked,
 * plus a formatted label suitable for display in the UI.
 */
export function workedTimeInfo(
  start: string | null | undefined,
  end: string | null | undefined,
  pauses?: PauseInterval[] | null | undefined,
  jobScheduledDate?: string | null | undefined,
): { elapsed: number | null; worked: number | null; pauseTotal: number; label: string } {
  const elapsed = computeElapsedMinutes(start, end, jobScheduledDate);
  const pauseTotal = computeTotalPauseMinutes(pauses, end ?? undefined, jobScheduledDate);
  let worked: number | null = null;
  if (elapsed !== null) {
    worked = Math.max(0, elapsed - pauseTotal);
  }
  let label = "";
  if (elapsed !== null && worked !== null) {
    if (pauseTotal > 0) {
      label = formatDurationMinutes(worked) + " (incl. " + formatDurationMinutes(pauseTotal) + " de pause, " + formatDurationMinutes(elapsed) + " total)";
    } else {
      label = formatDurationMinutes(worked);
    }
  }
  return { elapsed, worked, pauseTotal, label };
}
