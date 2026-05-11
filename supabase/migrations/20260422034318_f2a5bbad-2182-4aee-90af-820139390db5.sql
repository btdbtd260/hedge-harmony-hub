
-- Table messages
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body TEXT NOT NULL DEFAULT '',
  media_urls TEXT[] NOT NULL DEFAULT '{}',
  from_number TEXT NOT NULL DEFAULT '',
  to_number TEXT NOT NULL DEFAULT '',
  twilio_sid TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_client_id ON public.messages(client_id);
CREATE INDEX idx_messages_read ON public.messages(read) WHERE read = false;
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users full access on messages"
ON public.messages
FOR ALL
TO authenticated
USING (current_user_approved())
WITH CHECK (current_user_approved());

-- Realtime
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Storage bucket pour MMS
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-media', 'message-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read message media"
ON storage.objects FOR SELECT
USING (bucket_id = 'message-media');

CREATE POLICY "Service role write message media"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'message-media');

CREATE POLICY "Approved users write message media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'message-media' AND current_user_approved());
