-- ============================================================
-- Migration 8/8: RLS Policies (safe, non-destructive)
-- ============================================================
-- This migration creates Row Level Security policies for all
-- application tables. Each policy is wrapped in a DO block that
-- checks pg_policies before creating, ensuring idempotency.
--
-- Access model:
--   - Core business tables: "Approved users full access" using
--     current_user_approved() for all operations (SELECT, INSERT,
--     UPDATE, DELETE). This matches the project's no-auth model
--     where any authenticated and email-approved user can access
--     all data.
--   - Admin tables (user_roles, approved_emails, etc.): Separate
--     policies for admin vs. read-only access where applicable.
--
-- ⚠️  Assumes RLS is enabled (migration 7) and utility functions
--     exist (migration 3). No policies are dropped.
-- ============================================================

-- ============================================================
-- Core business tables — Approved users full access
-- ============================================================

-- customers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'customers'
      AND policyname = 'Approved users full access on customers'
  ) THEN
    CREATE POLICY "Approved users full access on customers"
    ON "public"."customers"
    FOR ALL
    TO authenticated
    USING (current_user_approved())
    WITH CHECK (current_user_approved());
  END IF;
END $$;

-- jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'jobs'
      AND policyname = 'Approved users full access on jobs'
  ) THEN
    CREATE POLICY "Approved users full access on jobs"
    ON "public"."jobs"
    FOR ALL
    TO authenticated
    USING (current_user_approved())
    WITH CHECK (current_user_approved());
  END IF;
END $$;

-- employees
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'employees'
      AND policyname = 'Approved users full access on employees'
  ) THEN
    CREATE POLICY "Approved users full access on employees"
    ON "public"."employees"
    FOR ALL
    TO authenticated
    USING (current_user_approved())
    WITH CHECK (current_user_approved());
  END IF;
END $$;

-- employee_jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'employee_jobs'
      AND policyname = 'Approved users full access on employee_jobs'
  ) THEN
    CREATE POLICY "Approved users full access on employee_jobs"
    ON "public"."employee_jobs"
    FOR ALL
    TO authenticated
    USING (current_user_approved())
    WITH CHECK (current_user_approved());
  END IF;
END $$;

-- invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invoices'
      AND policyname = 'Approved users full access on invoices'
  ) THEN
    CREATE POLICY "Approved users full access on invoices"
    ON "public"."invoices"
    FOR ALL
    TO authenticated
    USING (current_user_approved())
    WITH CHECK (current_user_approved());
  END IF;
END $$;

-- expenses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'expenses'
      AND policyname = 'Approved users full access on expenses'
  ) THEN
    CREATE POLICY "Approved users full access on expenses"
    ON "public"."expenses"
    FOR ALL
    TO authenticated
    USING (current_user_approved())
    WITH CHECK (current_user_approved());
  END IF;
END $$;

-- estimations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'estimations'
      AND policyname = 'Approved users full access on estimations'
  ) THEN
    CREATE POLICY "Approved users full access on estimations"
    ON "public"."estimations"
    FOR ALL
    TO authenticated
    USING (current_user_approved())
    WITH CHECK (current_user_approved());
  END IF;
END $$;

-- estimation_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'estimation_requests'
      AND policyname = 'Approved users full access on estimation_requests'
  ) THEN
    CREATE POLICY "Approved users full access on estimation_requests"
    ON "public"."estimation_requests"
    FOR ALL
    TO authenticated
    USING (current_user_approved())
    WITH CHECK (current_user_approved());
  END IF;
END $$;

-- parameters
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'parameters'
      AND policyname = 'Approved users full access on parameters'
  ) THEN
    CREATE POLICY "Approved users full access on parameters"
    ON "public"."parameters"
    FOR ALL
    TO authenticated
    USING (current_user_approved())
    WITH CHECK (current_user_approved());
  END IF;
END $$;

-- reminders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reminders'
      AND policyname = 'Approved users full access on reminders'
  ) THEN
    CREATE POLICY "Approved users full access on reminders"
    ON "public"."reminders"
    FOR ALL
    TO authenticated
    USING (current_user_approved())
    WITH CHECK (current_user_approved());
  END IF;
END $$;

-- messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'messages'
      AND policyname = 'Approved users full access on messages'
  ) THEN
    CREATE POLICY "Approved users full access on messages"
    ON "public"."messages"
    FOR ALL
    TO authenticated
    USING (current_user_approved())
    WITH CHECK (current_user_approved());
  END IF;
END $$;

-- blocked_numbers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blocked_numbers'
      AND policyname = 'Approved users full access on blocked_numbers'
  ) THEN
    CREATE POLICY "Approved users full access on blocked_numbers"
    ON "public"."blocked_numbers"
    FOR ALL
    TO authenticated
    USING (current_user_approved())
    WITH CHECK (current_user_approved());
  END IF;
END $$;

-- ============================================================
-- Auth/role management tables — granular policies
-- ============================================================

-- user_roles: admins manage, users view own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_roles'
      AND policyname = 'Users view own roles'
  ) THEN
    CREATE POLICY "Users view own roles"
    ON "public"."user_roles"
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_roles'
      AND policyname = 'Admins manage roles'
  ) THEN
    CREATE POLICY "Admins manage roles"
    ON "public"."user_roles"
    FOR ALL
    TO authenticated
    USING (has_role(auth.uid(), 'admin'::public.app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;

-- approved_emails: admins manage, approved users read
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'approved_emails'
      AND policyname = 'Admins manage approved emails'
  ) THEN
    CREATE POLICY "Admins manage approved emails"
    ON "public"."approved_emails"
    FOR ALL
    TO authenticated
    USING (has_role(auth.uid(), 'admin'::public.app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'approved_emails'
      AND policyname = 'Approved users read approved emails'
  ) THEN
    CREATE POLICY "Approved users read approved emails"
    ON "public"."approved_emails"
    FOR SELECT
    TO authenticated
    USING (current_user_approved());
  END IF;
END $$;

-- approved_domains: admins manage, approved users read
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'approved_domains'
      AND policyname = 'Admins manage approved domains'
  ) THEN
    CREATE POLICY "Admins manage approved domains"
    ON "public"."approved_domains"
    FOR ALL
    TO authenticated
    USING (has_role(auth.uid(), 'admin'::public.app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'approved_domains'
      AND policyname = 'Approved users read approved domains'
  ) THEN
    CREATE POLICY "Approved users read approved domains"
    ON "public"."approved_domains"
    FOR SELECT
    TO authenticated
    USING (current_user_approved());
  END IF;
END $$;

-- app_settings: admins manage, approved users read
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_settings'
      AND policyname = 'Admins manage app settings'
  ) THEN
    CREATE POLICY "Admins manage app settings"
    ON "public"."app_settings"
    FOR ALL
    TO authenticated
    USING (has_role(auth.uid(), 'admin'::public.app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_settings'
      AND policyname = 'Approved users read app settings'
  ) THEN
    CREATE POLICY "Approved users read app settings"
    ON "public"."app_settings"
    FOR SELECT
    TO authenticated
    USING (current_user_approved());
  END IF;
END $$;

-- ============================================================
-- Email infrastructure tables — service role policies
-- ============================================================

-- email_send_log
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'email_send_log'
      AND policyname = 'Service role can read send log'
  ) THEN
    CREATE POLICY "Service role can read send log"
    ON "public"."email_send_log"
    FOR SELECT
    TO service_role
    USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'email_send_log'
      AND policyname = 'Service role can insert send log'
  ) THEN
    CREATE POLICY "Service role can insert send log"
    ON "public"."email_send_log"
    FOR INSERT
    TO service_role
    WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'email_send_log'
      AND policyname = 'Service role can update send log'
  ) THEN
    CREATE POLICY "Service role can update send log"
    ON "public"."email_send_log"
    FOR UPDATE
    TO service_role
    USING (true);
  END IF;
END $$;

-- email_send_state
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'email_send_state'
      AND policyname = 'Service role can manage send state'
  ) THEN
    CREATE POLICY "Service role can manage send state"
    ON "public"."email_send_state"
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- suppressed_emails
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'suppressed_emails'
      AND policyname = 'Service role can read suppressed emails'
  ) THEN
    CREATE POLICY "Service role can read suppressed emails"
    ON "public"."suppressed_emails"
    FOR SELECT
    TO service_role
    USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'suppressed_emails'
      AND policyname = 'Service role can insert suppressed emails'
  ) THEN
    CREATE POLICY "Service role can insert suppressed emails"
    ON "public"."suppressed_emails"
    FOR INSERT
    TO service_role
    WITH CHECK (true);
  END IF;
END $$;

-- email_unsubscribe_tokens
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'email_unsubscribe_tokens'
      AND policyname = 'Service role can read tokens'
  ) THEN
    CREATE POLICY "Service role can read tokens"
    ON "public"."email_unsubscribe_tokens"
    FOR SELECT
    TO service_role
    USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'email_unsubscribe_tokens'
      AND policyname = 'Service role can insert tokens'
  ) THEN
    CREATE POLICY "Service role can insert tokens"
    ON "public"."email_unsubscribe_tokens"
    FOR INSERT
    TO service_role
    WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'email_unsubscribe_tokens'
      AND policyname = 'Service role can mark tokens as used'
  ) THEN
    CREATE POLICY "Service role can mark tokens as used"
    ON "public"."email_unsubscribe_tokens"
    FOR UPDATE
    TO service_role
    USING (true);
  END IF;
END $$;

-- ============================================================
-- Verification query (run after migration):
--   SELECT schemaname, tablename, policyname, permissive, roles
--   FROM pg_policies
--   WHERE schemaname = 'public'
--   ORDER BY tablename, policyname;
-- ============================================================
