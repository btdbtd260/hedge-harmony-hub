ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes integer,
  ADD COLUMN IF NOT EXISTS duration_variance_minutes integer;

COMMENT ON COLUMN public.jobs.estimated_duration_minutes IS 'Predicted duration (minutes) computed from measurements + historical similar jobs. Used for visual end_time in calendar before completion.';
COMMENT ON COLUMN public.jobs.duration_variance_minutes IS 'Difference real - estimated (minutes). Filled when job is completed. Positive = took longer than expected.';