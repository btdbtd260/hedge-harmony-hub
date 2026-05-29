-- Add pause tracking to jobs table
-- Pauses are stored as JSONB array of {start: "HH:mm", end: "HH:mm"} intervals
-- total_pause_minutes is the sum of all pause durations for quick querying

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS pauses jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS total_pause_minutes integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.jobs.pauses IS 'Array of pause intervals: [{"start":"HH:mm","end":"HH:mm"}]. Start/end are within the job elapsed time.';
COMMENT ON COLUMN public.jobs.total_pause_minutes IS 'Total pause duration in minutes, computed as sum of all pause intervals. Subtracted from elapsed time for worked time.';
