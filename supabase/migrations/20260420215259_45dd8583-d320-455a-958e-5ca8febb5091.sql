-- Helper to maintain updated_at if not present
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.estimation_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL DEFAULT '',
  client_phone TEXT NOT NULL DEFAULT '',
  client_email TEXT NOT NULL DEFAULT '',
  client_address TEXT NOT NULL DEFAULT '',
  requested_date DATE NOT NULL,
  requested_time TEXT,
  notes TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'external_site',
  status TEXT NOT NULL DEFAULT 'pending',
  hidden BOOLEAN NOT NULL DEFAULT false,
  external_ref TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.estimation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users full access"
ON public.estimation_requests
FOR ALL
TO authenticated
USING (current_user_approved())
WITH CHECK (current_user_approved());

CREATE INDEX idx_estimation_requests_date ON public.estimation_requests(requested_date) WHERE hidden = false;

CREATE TRIGGER trg_estimation_requests_updated_at
BEFORE UPDATE ON public.estimation_requests
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();