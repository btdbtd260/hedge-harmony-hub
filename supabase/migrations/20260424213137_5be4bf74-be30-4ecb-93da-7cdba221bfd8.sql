CREATE OR REPLACE FUNCTION public.delete_job_cascade(_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _estimation_id uuid;
BEGIN
  -- Only approved users can perform cascade deletions
  IF NOT public.current_user_approved() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Lookup linked estimation BEFORE deleting the job
  SELECT estimation_id INTO _estimation_id
    FROM public.jobs
   WHERE id = _job_id;

  -- 1) Remove employee assignments (recalc trigger guard already handles recursion)
  DELETE FROM public.employee_jobs WHERE job_id = _job_id;

  -- 2) Remove ALL invoices for this job (draft + unpaid + paid).
  --    This is what removes the job's financial impact, since Finance
  --    revenue is computed dynamically from invoices.status = 'paid'.
  DELETE FROM public.invoices WHERE job_id = _job_id;

  -- 3) Delete the job itself
  DELETE FROM public.jobs WHERE id = _job_id;

  -- 4) Delete the linked estimation from history (if any)
  IF _estimation_id IS NOT NULL THEN
    DELETE FROM public.estimations WHERE id = _estimation_id;
  END IF;
END;
$function$;