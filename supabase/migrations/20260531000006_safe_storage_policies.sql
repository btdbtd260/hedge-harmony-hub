-- ============================================================
-- Migration 6/8: Storage Policies (safe, non-destructive)
-- ============================================================
-- This migration creates Row Level Security policies for
-- storage.objects to control access to each bucket.
--
-- All policies are wrapped in DO blocks that check pg_policies
-- before creating, ensuring idempotency. If a policy already
-- exists, it is silently skipped.
--
-- ⚠️  Assumes the storage buckets from migration 5 exist.
--     No policies are dropped or altered.
-- ============================================================

-- Helper: Create policy only if it does not already exist
-- Usage: PERFORM storage.create_safe_policy('name', 'stmt');
-- where stmt is the full CREATE POLICY statement without the
-- leading "CREATE POLICY <name> ON" part.

-- ============================================================
-- estimation-pdfs — Private bucket
-- Policies: SELECT, INSERT, UPDATE, DELETE for authenticated
--           users (email recipients access via signed URLs)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Allow read estimation-pdfs'
  ) THEN
    CREATE POLICY "Allow read estimation-pdfs"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'estimation-pdfs');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Allow insert estimation-pdfs'
  ) THEN
    CREATE POLICY "Allow insert estimation-pdfs"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'estimation-pdfs');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Allow update estimation-pdfs'
  ) THEN
    CREATE POLICY "Allow update estimation-pdfs"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'estimation-pdfs');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Allow delete estimation-pdfs'
  ) THEN
    CREATE POLICY "Allow delete estimation-pdfs"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'estimation-pdfs');
  END IF;
END $$;

-- ============================================================
-- message-media — Public bucket
-- Policies: SELECT (public), INSERT (service_role + approved
--           users), UPDATE (owner), DELETE (owner)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Public read message media'
  ) THEN
    CREATE POLICY "Public read message media"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'message-media');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Service role write message media'
  ) THEN
    CREATE POLICY "Service role write message media"
    ON storage.objects FOR INSERT
    TO service_role
    WITH CHECK (bucket_id = 'message-media');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Approved users write message media'
  ) THEN
    CREATE POLICY "Approved users write message media"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'message-media' AND current_user_approved());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Allow update message-media'
  ) THEN
    CREATE POLICY "Allow update message-media"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'message-media');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Allow delete message-media'
  ) THEN
    CREATE POLICY "Allow delete message-media"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'message-media');
  END IF;
END $$;

-- ============================================================
-- estimation-request-photos — Public bucket
-- Policies: SELECT (public), INSERT (public), UPDATE, DELETE
-- ============================================================
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Allow insert estimation-request-photos'
  ) THEN
    CREATE POLICY "Allow insert estimation-request-photos"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'estimation-request-photos');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Allow update estimation-request-photos'
  ) THEN
    CREATE POLICY "Allow update estimation-request-photos"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'estimation-request-photos');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Allow delete estimation-request-photos'
  ) THEN
    CREATE POLICY "Allow delete estimation-request-photos"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'estimation-request-photos');
  END IF;
END $$;

-- ============================================================
-- company-assets — Public bucket
-- Policies: SELECT (public), INSERT, UPDATE, DELETE
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Public read access for company assets'
  ) THEN
    CREATE POLICY "Public read access for company assets"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'company-assets');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Allow upload to company assets'
  ) THEN
    CREATE POLICY "Allow upload to company assets"
    ON storage.objects FOR INSERT
    TO public
    WITH CHECK (bucket_id = 'company-assets');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Allow update company assets'
  ) THEN
    CREATE POLICY "Allow update company assets"
    ON storage.objects FOR UPDATE
    TO public
    USING (bucket_id = 'company-assets');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Allow delete company assets'
  ) THEN
    CREATE POLICY "Allow delete company assets"
    ON storage.objects FOR DELETE
    TO public
    USING (bucket_id = 'company-assets');
  END IF;
END $$;

-- ============================================================
-- job-photos — Public bucket (NEW)
-- Policies: SELECT (public), INSERT, UPDATE, DELETE
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Public read job-photos'
  ) THEN
    CREATE POLICY "Public read job-photos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'job-photos');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Allow insert job-photos'
  ) THEN
    CREATE POLICY "Allow insert job-photos"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'job-photos');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Allow update job-photos'
  ) THEN
    CREATE POLICY "Allow update job-photos"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'job-photos');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Allow delete job-photos'
  ) THEN
    CREATE POLICY "Allow delete job-photos"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'job-photos');
  END IF;
END $$;

-- ============================================================
-- Verification query (run after migration):
--   SELECT schemaname, tablename, policyname, permissive
--   FROM pg_policies
--   WHERE schemaname = 'storage' AND tablename = 'objects'
--   ORDER BY policyname;
-- ============================================================
