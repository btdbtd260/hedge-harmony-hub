-- 0) Allow 'draft' as a valid invoice status
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'unpaid', 'paid'));

-- 1) Mark every existing invoice attached to a non-completed job as 'draft'
UPDATE public.invoices i
   SET status = 'draft'
  FROM public.jobs j
 WHERE i.job_id = j.id
   AND j.status <> 'completed'
   AND i.status = 'unpaid';

-- 2) Trigger: when a job becomes completed, flip its draft invoice(s) to 'unpaid'
CREATE OR REPLACE FUNCTION public.trg_publish_invoice_on_completion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    UPDATE public.invoices
       SET status = 'unpaid'
     WHERE job_id = NEW.id
       AND status = 'draft';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS publish_invoice_on_completion ON public.jobs;
CREATE TRIGGER publish_invoice_on_completion
AFTER UPDATE OF status ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.trg_publish_invoice_on_completion();