-- Add price_per_foot_restoration column to parameters
ALTER TABLE public.parameters
ADD COLUMN IF NOT EXISTS price_per_foot_restoration numeric NOT NULL DEFAULT 8;

-- Migrate any legacy cut_type = 'custom' rows back to a real cut type (trim by default)
-- so the new rule "cut_type is always one of {trim, levelling, restoration}" holds.
UPDATE public.estimations SET cut_type = 'trim' WHERE cut_type = 'custom';
UPDATE public.jobs        SET cut_type = 'trim' WHERE cut_type = 'custom';