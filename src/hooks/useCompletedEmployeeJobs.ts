import { useMemo } from "react";
import { useEmployeeJobs, useJobs, type DbEmployeeJob, type DbJob } from "./useSupabaseData";

/**
 * Returns only employee_jobs whose linked job has status === "completed".
 * Used to compute confirmed earnings (no pay counted before job completion).
 */
export function useCompletedEmployeeJobs(): {
  data: DbEmployeeJob[];
  jobsById: Map<string, DbJob>;
} {
  const { data: employeeJobs = [] } = useEmployeeJobs();
  const { data: jobs = [] } = useJobs();

  return useMemo(() => {
    const jobsById = new Map(jobs.map((j) => [j.id, j]));
    const data = employeeJobs.filter((ej) => {
      const job = jobsById.get(ej.job_id);
      return job?.status === "completed";
    });
    return { data, jobsById };
  }, [employeeJobs, jobs]);
}
