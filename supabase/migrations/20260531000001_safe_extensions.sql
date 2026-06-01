-- ============================================================
-- Migration 1/4: Extensions (safe, non-destructive)
-- ============================================================
-- This migration enables PostgreSQL extensions required by the
-- Hedge Harmony Hub application. All CREATE EXTENSION statements
-- use IF NOT EXISTS to ensure idempotency.
--
-- ⚠️  DO NOT run this on Supabase cloud directly without testing
--     in a local environment first.
--
-- Required extensions:
--   pgcrypto       — gen_random_uuid(), cryptographic functions
--   pg_net         — HTTP requests from Edge Functions
--   pg_cron        — Scheduled job runner
--   supabase_vault — Encrypted secrets storage
--   pgmq           — Message queue for email processing
-- ============================================================

-- pgcrypto: provides gen_random_uuid() used by all tables
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- pg_net: allows Edge Functions to make HTTP requests
CREATE EXTENSION IF NOT EXISTS "pg_net" SCHEMA "extensions";

-- pg_cron: scheduled job runner (e.g., email queue processing)
-- Uses DO block for additional safety on managed Supabase projects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    CREATE EXTENSION IF NOT EXISTS "pg_cron";
  END IF;
END $$;

-- supabase_vault: encrypted secrets storage for API keys
CREATE EXTENSION IF NOT EXISTS "supabase_vault";

-- pgmq: lightweight message queue for email processing
CREATE EXTENSION IF NOT EXISTS "pgmq";

-- ============================================================
-- Notes:
-- - pg_cron uses a DO block wrapper because its behavior
--   differs when installed in managed Supabase projects.
-- - All other extensions use the standard IF NOT EXISTS form.
-- - No extensions are dropped or recreated.
-- ============================================================
