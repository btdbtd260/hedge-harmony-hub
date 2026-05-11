
-- Add back_left_length and back_right_length columns to estimations
ALTER TABLE public.estimations ADD COLUMN back_left_length numeric NOT NULL DEFAULT 0;
ALTER TABLE public.estimations ADD COLUMN back_right_length numeric NOT NULL DEFAULT 0;

-- Add company_logo_url to parameters
ALTER TABLE public.parameters ADD COLUMN company_logo_url text DEFAULT '';

-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public) VALUES ('company-assets', 'company-assets', true);

-- Allow public read access to company-assets bucket
CREATE POLICY "Public read access for company assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company-assets');

-- Allow public upload to company-assets bucket
CREATE POLICY "Allow upload to company assets"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'company-assets');

-- Allow public update to company-assets bucket
CREATE POLICY "Allow update company assets"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'company-assets');

-- Allow public delete from company-assets bucket
CREATE POLICY "Allow delete company assets"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'company-assets');
