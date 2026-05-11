ALTER TABLE public.parameters
  ADD COLUMN IF NOT EXISTS rounding_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS rounding_multiple integer NOT NULL DEFAULT 5;