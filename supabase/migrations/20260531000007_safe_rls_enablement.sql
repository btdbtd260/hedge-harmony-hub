-- ============================================================
-- Migration 7/8: RLS Enablement (safe, non-destructive)
-- ============================================================
-- This migration enables Row Level Security on all application
-- tables. ALTER TABLE ... ENABLE ROW LEVEL SECURITY is
-- idempotent — running it multiple times has no side effects.
--
-- ⚠️  This migration only ENABLES RLS. The actual policies
--     are created in migration 8 (safe_rls_policies.sql).
--
-- Tables covered (20 total):
--   customers, jobs, employees, employee_jobs, invoices,
--   expenses, estimations, estimation_requests, parameters,
--   reminders, user_roles, approved_emails, approved_domains,
--   app_settings, messages, blocked_numbers, email_send_log,
--   email_send_state, suppressed_emails, email_unsubscribe_tokens
-- ============================================================

-- Core business tables
ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."employee_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."estimations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."estimation_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."parameters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."reminders" ENABLE ROW LEVEL SECURITY;

-- Auth/role management tables
ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."approved_emails" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."approved_domains" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;

-- Communication tables
ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."blocked_numbers" ENABLE ROW LEVEL SECURITY;

-- Email infrastructure tables
ALTER TABLE "public"."email_send_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."email_send_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."suppressed_emails" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."email_unsubscribe_tokens" ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Verification query (run after migration):
--   SELECT relname, relhasrules, relrowsecurity
--   FROM pg_class
--   WHERE relrowsecurity = true
--     AND relnamespace = 'public'::regnamespace
--   ORDER BY relname;
-- ============================================================
