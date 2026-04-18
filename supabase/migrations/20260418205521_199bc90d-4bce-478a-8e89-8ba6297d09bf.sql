ALTER TABLE public.parameters
  ADD COLUMN IF NOT EXISTS two_sides_multiplier numeric NOT NULL DEFAULT 1.5,
  ADD COLUMN IF NOT EXISTS company_website text NOT NULL DEFAULT '';