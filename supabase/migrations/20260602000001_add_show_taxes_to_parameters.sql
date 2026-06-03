-- ============================================================
-- Migration: Add show_taxes column to parameters table
-- ============================================================
-- This migration adds a show_taxes boolean flag to the
-- parameters table for controlling tax display on invoices.
--
-- All statements use ALTER TABLE ... ADD COLUMN IF NOT EXISTS
-- to ensure idempotency. No columns are dropped or altered.
-- No tables are created or dropped.
-- ============================================================

ALTER TABLE "public"."parameters"
  ADD COLUMN IF NOT EXISTS "show_taxes" boolean NOT NULL DEFAULT false;
