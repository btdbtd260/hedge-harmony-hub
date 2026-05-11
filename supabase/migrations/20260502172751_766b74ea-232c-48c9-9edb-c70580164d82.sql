-- Private bucket for estimation PDFs (sent via signed URL in emails)
INSERT INTO storage.buckets (id, name, public)
VALUES ('estimation-pdfs', 'estimation-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Permissive policies aligned with project's no-auth model.
-- Bucket stays private (public=false), but reads/writes are allowed via API.
-- Email recipients access PDFs via short-lived signed URLs, not direct bucket reads.
CREATE POLICY "Allow read estimation-pdfs"
ON storage.objects FOR SELECT
USING (bucket_id = 'estimation-pdfs');

CREATE POLICY "Allow insert estimation-pdfs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'estimation-pdfs');

CREATE POLICY "Allow update estimation-pdfs"
ON storage.objects FOR UPDATE
USING (bucket_id = 'estimation-pdfs');

CREATE POLICY "Allow delete estimation-pdfs"
ON storage.objects FOR DELETE
USING (bucket_id = 'estimation-pdfs');