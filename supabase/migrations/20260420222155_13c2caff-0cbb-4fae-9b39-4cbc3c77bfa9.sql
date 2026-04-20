-- Add photos column to store optional photo URLs from external form submissions
ALTER TABLE public.estimation_requests
  ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}'::text[];

-- Index to speed up duplicate detection
CREATE INDEX IF NOT EXISTS idx_estimation_requests_dedup
  ON public.estimation_requests (requested_date, lower(client_email), client_phone);

-- Dedicated public bucket for external form photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('estimation-request-photos', 'estimation-request-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read on this bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Public read estimation-request-photos'
  ) THEN
    CREATE POLICY "Public read estimation-request-photos"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'estimation-request-photos');
  END IF;
END $$;