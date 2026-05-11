-- Table des numéros bloqués
CREATE TABLE public.blocked_numbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  phone_normalized TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unicité sur la forme normalisée (10 derniers chiffres)
CREATE UNIQUE INDEX blocked_numbers_phone_normalized_key
  ON public.blocked_numbers (phone_normalized);

ALTER TABLE public.blocked_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users full access on blocked_numbers"
ON public.blocked_numbers
FOR ALL
TO authenticated
USING (current_user_approved())
WITH CHECK (current_user_approved());

CREATE TRIGGER blocked_numbers_set_updated_at
BEFORE UPDATE ON public.blocked_numbers
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();