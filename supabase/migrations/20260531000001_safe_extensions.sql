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
-- Free-tier-compatible extensions:
--   pgcrypto       — gen_random_uuid(), cryptographic functions
--   pg_net         — HTTP requests from Edge Functions
--   supabase_vault — Encrypted secrets storage
--   pgmq           — Message queue for email processing
--
-- NOTE: pg_cron is NOT included here because it is not available
-- on the Supabase Free tier. It will be added later if/when the
-- project upgrades to a paid plan. The email queue processing
-- formerly scheduled via pg_cron will be handled by an edge
-- function or external scheduler.
-- ============================================================

-- pgcrypto: provides gen_random_uuid() used by all tables
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- pg_net: allows Edge Functions to make HTTP requests
CREATE EXTENSION IF NOT EXISTS "pg_net" SCHEMA "extensions";

-- supabase_vault: encrypted secrets storage for API keys
CREATE EXTENSION IF NOT EXISTS "supabase_vault";

-- pgmq: lightweight message queue for email processing
CREATE EXTENSION IF NOT EXISTS "pgmq";

-- ============================================================
-- Notes:
-- - All extensions use the standard IF NOT EXISTS form.
-- - No extensions are dropped or recreated.
-- - pg_cron is intentionally omitted for Free tier compatibility.
-- ============================================================
