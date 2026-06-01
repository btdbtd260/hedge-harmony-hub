-- ============================================================
-- Migration 4/4: Missing Columns (safe, non-destructive)
-- ============================================================
-- This migration adds columns that were introduced in later
-- migrations but may be missing if the project was created
-- from an older snapshot or a partial migration.
--
-- ALL statements use ALTER TABLE ... ADD COLUMN IF NOT EXISTS
-- to ensure idempotency. No columns are dropped or altered.
-- No tables are created or dropped.
--
-- ⚠️  This migration assumes the tables already exist.
--     If a table does not exist, this migration will fail
--     and must be applied after the base schema is in place.
-- ============================================================

-- ============================================================
-- customers: billing info (JSONB) for invoice PDF generation
-- ============================================================
ALTER TABLE "public"."customers" ADD COLUMN IF NOT EXISTS "billing_info" jsonb;

-- ============================================================
-- employees: admin flag
-- ============================================================
ALTER TABLE "public"."employees" ADD COLUMN IF NOT EXISTS "is_admin" boolean NOT NULL DEFAULT false;

-- ============================================================
-- employee_jobs: presence tracking
-- ============================================================
ALTER TABLE "public"."employee_jobs" ADD COLUMN IF NOT EXISTS "is_present" boolean NOT NULL DEFAULT true;

-- ============================================================
-- jobs: financial and duration tracking columns
-- ============================================================
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "tip" numeric NOT NULL DEFAULT 0;
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "pauses" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "total_pause_minutes" integer NOT NULL DEFAULT 0;
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "estimated_duration_minutes" integer;
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "duration_variance_minutes" integer;

-- ============================================================
-- parameters: pricing and display configuration
-- ============================================================
ALTER TABLE "public"."parameters" ADD COLUMN IF NOT EXISTS "two_sides_multiplier" numeric NOT NULL DEFAULT 1.5;
ALTER TABLE "public"."parameters" ADD COLUMN IF NOT EXISTS "company_website" text NOT NULL DEFAULT '';
ALTER TABLE "public"."parameters" ADD COLUMN IF NOT EXISTS "company_logo_url" text DEFAULT '';
ALTER TABLE "public"."parameters" ADD COLUMN IF NOT EXISTS "price_per_foot_restoration" numeric NOT NULL DEFAULT 8;
ALTER TABLE "public"."parameters" ADD COLUMN IF NOT EXISTS "rounding_enabled" boolean NOT NULL DEFAULT true;
ALTER TABLE "public"."parameters" ADD COLUMN IF NOT EXISTS "rounding_multiple" integer NOT NULL DEFAULT 5;

-- ============================================================
-- estimations: additional measurement fields
-- ============================================================
ALTER TABLE "public"."estimations" ADD COLUMN IF NOT EXISTS "back_left_length" numeric NOT NULL DEFAULT 0;
ALTER TABLE "public"."estimations" ADD COLUMN IF NOT EXISTS "back_right_length" numeric NOT NULL DEFAULT 0;
ALTER TABLE "public"."estimations" ADD COLUMN IF NOT EXISTS "height_back_left" numeric NOT NULL DEFAULT 0;
ALTER TABLE "public"."estimations" ADD COLUMN IF NOT EXISTS "height_back_right" numeric NOT NULL DEFAULT 0;

-- ============================================================
-- estimation_requests: photos and seen_at
-- ============================================================
ALTER TABLE "public"."estimation_requests" ADD COLUMN IF NOT EXISTS "photos" text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE "public"."estimation_requests" ADD COLUMN IF NOT EXISTS "seen_at" timestamp with time zone;

-- ============================================================
-- email_send_state: rate-limit and queue configuration
-- (added after initial CREATE TABLE as backfill)
-- ============================================================
ALTER TABLE IF EXISTS "public"."email_send_state" ADD COLUMN IF NOT EXISTS "batch_size" integer NOT NULL DEFAULT 10;
ALTER TABLE IF EXISTS "public"."email_send_state" ADD COLUMN IF NOT EXISTS "send_delay_ms" integer NOT NULL DEFAULT 200;
ALTER TABLE IF EXISTS "public"."email_send_state" ADD COLUMN IF NOT EXISTS "auth_email_ttl_minutes" integer NOT NULL DEFAULT 15;
ALTER TABLE IF EXISTS "public"."email_send_state" ADD COLUMN IF NOT EXISTS "transactional_email_ttl_minutes" integer NOT NULL DEFAULT 60;

-- ============================================================
-- Verification query (run after migration):
--   SELECT table_name, column_name, is_nullable, data_type
--   FROM information_schema.columns
--   WHERE table_schema = 'public'
--   ORDER BY table_name, ordinal_position;
-- ============================================================
