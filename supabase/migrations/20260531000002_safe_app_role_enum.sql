-- ============================================================
-- Migration 2/4: app_role ENUM (safe, non-destructive)
-- ============================================================
-- This migration creates the app_role enum type used by the
-- user_roles table for role-based authorization.
--
-- Values: 'admin', 'member'
--
-- The DO block with EXCEPTION handler ensures idempotency:
-- if the type already exists, the creation is silently skipped.
--
-- ⚠️  No DROP TYPE is used — this is purely additive.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role'
  ) THEN
    CREATE TYPE "public"."app_role" AS ENUM ('admin', 'member');
  END IF;
END $$;

-- ============================================================
-- Verification query (run after migration):
--   SELECT enum_range(NULL::public.app_role);
-- Expected: {admin,member}
-- ============================================================
