ALTER TABLE public.estimation_requests
ADD COLUMN IF NOT EXISTS seen_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_estimation_requests_unseen
ON public.estimation_requests (seen_at)
WHERE seen_at IS NULL AND hidden = false;