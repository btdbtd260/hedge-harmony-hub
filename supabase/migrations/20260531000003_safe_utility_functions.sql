-- ============================================================
-- Migration 3/4: Utility Functions (safe, non-destructive)
-- ============================================================
-- This migration creates or replaces PostgreSQL utility functions
-- used throughout the application.
--
-- Functions:
--   1. set_updated_at()         — Trigger function that sets updated_at = now()
--   2. is_email_approved(text)  — Checks if an email is in approved_emails or
--                                  its domain is in approved_domains
--   3. has_role(uuid, app_role) — Checks if a user has a specific role
--   4. current_user_approved()  — Returns true if the current authenticated
--                                  user's email is approved
--
-- All functions use CREATE OR REPLACE FUNCTION which is safe to
-- run multiple times. No functions are dropped.
--
-- ⚠️  These functions reference the app_role enum type which must
--     exist before running this migration (migration 2 must be
--     applied first).
-- ============================================================

-- 1. set_updated_at()
--    Generic trigger function that sets the updated_at column
--    to the current timestamp before an UPDATE operation.
CREATE OR REPLACE FUNCTION "public"."set_updated_at"()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. is_email_approved(_email text) → boolean
--    Returns true if the email is in the approved_emails table
--    OR if the email's domain is in the approved_domains table.
--    Comparison is case-insensitive.
CREATE OR REPLACE FUNCTION "public"."is_email_approved"(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM "public"."approved_emails"
      WHERE lower(email) = lower(_email)
    )
    OR EXISTS (
      SELECT 1 FROM "public"."approved_domains"
      WHERE lower(split_part(_email, '@', 2)) = lower(domain)
    )
$$;

-- 3. has_role(_user_id uuid, _role public.app_role) → boolean
--    Returns true if the user has the specified role in user_roles.
CREATE OR REPLACE FUNCTION "public"."has_role"(_user_id uuid, _role "public"."app_role")
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "public"."user_roles"
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. current_user_approved() → boolean
--    Returns true if the currently authenticated user's email
--    is approved (via is_email_approved).
CREATE OR REPLACE FUNCTION "public"."current_user_approved"()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "auth"."users" u
    WHERE u.id = auth.uid()
      AND "public"."is_email_approved"(u.email)
  )
$$;

-- ============================================================
-- Verification queries (run after migration):
--   SELECT public.set_updated_at();         -- Should return trigger info
--   SELECT public.is_email_approved('test@example.com'); -- false
--   SELECT public.has_role(auth.uid(), 'admin'::public.app_role);
--   SELECT public.current_user_approved();
-- ============================================================
