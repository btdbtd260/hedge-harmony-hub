-- ============================================================
-- Migration: Add company_number column to parameters table
-- ============================================================
-- This migration adds a company_number text field to the
-- parameters table for storing the NEQ / company registration
-- number. It appears on invoices and estimations.
-- ============================================================

ALTER TABLE "public"."parameters"
  ADD COLUMN IF NOT EXISTS "company_number" text NOT NULL DEFAULT '';
