import { useMemo } from "react";
import { useEmployeeJobs, useJobs, type DbEmployeeJob, type DbJob } from "./useSupabaseData";

// ─── Pure utility ───

export interface CompletedEmployeeJobsResult {
  data: DbEmployeeJob[];
  jobsById: Map<string, DbJob>;
}

/**
 * Pure function: filters employee_jobs to only those whose linked job
 * has status === "completed". Also returns a Map of all jobs by id.
 *
 * Extracted from the hook so it can be unit-tested independently.
 */
export function filterCompletedEmployeeJobs(
  employeeJobs: DbEmployeeJob[],
  jobs: DbJob[],
): CompletedEmployeeJobsResult {
  const jobsById = new Map(jobs.map((j) => [j.id, j]));
  const data = employeeJobs.filter((ej) => {
    const job = jobsById.get(ej.job_id);
    return job?.status === "completed";
  });
  return { data, jobsById };
}

// ─── Hook (thin wrapper around pure function) ───

/**
 * Returns only employee_jobs whose linked job has status === "completed".
 * Used to compute confirmed earnings (no pay counted before job completion).
 */
export function useCompletedEmployeeJobs(): CompletedEmployeeJobsResult {
  const { data: employeeJobs = [] } = useEmployeeJobs();
  const { data: jobs = [] } = useJobs();

  return useMemo(
    () => filterCompletedEmployeeJobs(employeeJobs, jobs),
    [employeeJobs, jobs],
  );
}
