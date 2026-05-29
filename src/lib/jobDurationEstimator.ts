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
//   - linearFeet within ±40 %
//   - effectiveHeight within ±1.5 ft
//
// Result is rounded to the nearest 5 minutes, min 15 min.
// ============================================================

import type { DbJob } from "@/hooks/useSupabaseData";
import type { PauseInterval } from "@/types";

// Tunable constants — kept in one place for clarity / future tuning
const BASE_MIN_PER_FOOT = {
  trim: 0.9,        // ~54 sec per linear foot for a basic trim ("Taillage")
  levelling: 1.6,   // levelling is heavier work ("Nivelage")
  restoration: 2.2, // restoration is the heaviest — overgrown / re-shaping work
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

// ─── helpers ───
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

/** Extract measurement inputs from a DbJob row (handles snake_case/camelCase snapshots). */

/** Extract pauses from a DbJob's measurement_snapshot.
 *  Reads `job.measurement_snapshot.pauses` (the canonical storage location).
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
    return { minutes: 0, basis: "base", similarCount: 0, explanation: "Aucune mesure renseignée." };
  }

  const similar = findSimilarJobs(input, history);
  if (similar.length < MIN_HISTORY) {
    return {
      minutes: tidy(base),
      basis: "base",
      similarCount: similar.length,
      explanation: `Estimation de base (${similar.length} job(s) similaire(s) dans l'historique, min ${MIN_HISTORY}).`,
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
    explanation: `Mélangé : ${Math.round((1 - weight) * 100)}% formule de base + ${Math.round(weight * 100)}% historique (${similar.length} jobs similaires, ${avgMinPerFoot.toFixed(2)} min/pi).`,
  };
}

/** Parse "HH:mm" into total minutes since midnight. */
export function parseTimeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const m = time.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Compute total elapsed minutes from start to end (handles midnight crossing).
 * Returns elapsed time (wall clock), NOT accounting for pauses.
 */
export function computeElapsedMinutes(start: string | null | undefined, end: string | null | undefined): number | null {
  const s = parseTimeToMinutes(start);
  const e = parseTimeToMinutes(end);
  if (s === null || e === null) return null;
  if (e < s) return e + 24 * 60 - s; // crossed midnight
  return e - s;
}

/** Compute total pause duration in minutes from an array of pause intervals.
 *  Active pauses (end is null/undefined) are counted up to `now`.
 *  If `now` is not provided, uses the current time. */
export function computeTotalPauseMinutes(
  pauses: PauseInterval[] | null | undefined,
  now?: string,
): number {
  if (!pauses || !Array.isArray(pauses) || pauses.length === 0) return 0;
  let total = 0;
  for (const p of pauses) {
    const end = p.end ?? now ?? getCurrentHHMM();
    const duration = computeElapsedMinutes(p.start, end);
    if (duration !== null && duration > 0) {
      total += duration;
    }
  }
  return total;
}

function getCurrentHHMM(): string {
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

/**
 * Compute real WORKED duration in minutes = elapsed time minus total pause time.
 * This is the value stored as total_duration_minutes for completed jobs.
 */
export function computeRealDuration(
  start: string | null | undefined,
  end: string | null | undefined,
  pauses?: PauseInterval[] | null | undefined,
): number | null {
  const elapsed = computeElapsedMinutes(start, end);
  if (elapsed === null) return null;
  const pauseTotal = computeTotalPauseMinutes(pauses);
  return Math.max(0, elapsed - pauseTotal);
}

/** Add minutes to "HH:mm" → "HH:mm" (wraps within a single day display). */
export function addMinutesToTime(time: string | null | undefined, minutes: number): string | null {
  if (!time) return null;
  const m = time.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const total = Number(m[1]) * 60 + Number(m[2]) + minutes;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const mm = String(wrapped % 60).padStart(2, "0");
  return `${hh}:${mm}`;
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
): { elapsed: number | null; worked: number | null; pauseTotal: number; label: string } {
  const elapsed = computeElapsedMinutes(start, end);
  const pauseTotal = computeTotalPauseMinutes(pauses, end ?? undefined);
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
