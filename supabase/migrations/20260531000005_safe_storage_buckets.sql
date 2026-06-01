-- ============================================================
-- Migration 5/8: Storage Buckets (safe, non-destructive)
-- ============================================================
-- This migration creates Supabase Storage buckets required by
-- the Hedge Harmony Hub application. All INSERT statements use
-- ON CONFLICT (id) DO NOTHING to ensure idempotency.
--
-- Buckets created:
--   1. estimation-pdfs          (private) — PDF estimation documents
--   2. message-media            (public)  — MMS/media attachments
--   3. estimation-request-photos (public) — External form photo uploads
--   4. company-assets           (public)  — Company logos, branding assets
--   5. job-photos               (public)  — Job site photos
--
-- ⚠️  This migration ONLY creates buckets. Policies are created
--     in migration 6 (safe_storage_policies.sql).
-- ============================================================

-- 1. estimation-pdfs — Private bucket for estimation PDFs
--    Used with signed URLs for secure email delivery.
INSERT INTO storage.buckets (id, name, public)
VALUES ('estimation-pdfs', 'estimation-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- 2. message-media — Public bucket for SMS/MMS media attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-media', 'message-media', true)
ON CONFLICT (id) DO NOTHING;

-- 3. estimation-request-photos — Public bucket for external
--    estimation request form photo uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('estimation-request-photos', 'estimation-request-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 4. company-assets — Public bucket for company logos, branding
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

-- 5. job-photos — Public bucket for job site photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-photos', 'job-photos', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Verification query (run after migration):
--   SELECT id, name, public FROM storage.buckets
--   WHERE id IN ('estimation-pdfs', 'message-media',
--                'estimation-request-photos', 'company-assets',
--                'job-photos')
--   ORDER BY name;
-- ============================================================
