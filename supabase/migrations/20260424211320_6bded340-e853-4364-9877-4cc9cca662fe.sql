-- Fix stack-depth recursion in employee_jobs payroll trigger.
--
-- Root cause: trg_employee_jobs_recalc fires on INSERT/UPDATE/DELETE on
-- employee_jobs and calls recalc_job_pays(), which itself UPDATEs
-- employee_jobs rows (to set hours_worked, calculated_pay). Each of those
-- UPDATEs re-fires the trigger, causing unbounded recursion and
-- "stack depth limit exceeded" the moment a user adds an employee to a job.
--
-- Fix: use a session-local guard (current_setting / set_config) so that
-- recalc_job_pays sets a flag while it runs, and the trigger short-circuits
-- when the flag is on. This keeps the public API of both functions
-- unchanged — callers don't need to know about the guard.

CREATE OR REPLACE FUNCTION public.recalc_job_pays(_job_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  _tip numeric := 0;
  _job_total numeric := 0;
  _normal_total numeric := 0;
  _admin_count int := 0;
  _admin_share numeric := 0;
  _remainder numeric := 0;
BEGIN
  -- Mark this session as "inside recalc" so the AFTER trigger on
  -- employee_jobs skips re-entrant calls during the UPDATEs below.
  PERFORM set_config('app.recalc_in_progress', 'on', true);

  SELECT COALESCE(j.tip, 0) INTO _tip FROM public.jobs j WHERE j.id = _job_id;
  IF NOT FOUND THEN
    PERFORM set_config('app.recalc_in_progress', 'off', true);
    RETURN;
  END IF;

  SELECT COALESCE(
    (SELECT i.amount FROM public.invoices i
       WHERE i.job_id = _job_id ORDER BY i.issued_at DESC LIMIT 1),
    (SELECT j.estimated_profit FROM public.jobs j WHERE j.id = _job_id),
    0
  ) INTO _job_total;

  _job_total := _job_total + _tip;

  UPDATE public.employee_jobs ej
     SET hours_worked = 0, calculated_pay = 0
   WHERE ej.job_id = _job_id AND ej.is_present = false;

  UPDATE public.employee_jobs ej
     SET calculated_pay = ROUND(ej.hours_worked * e.hourly_rate, 2)
    FROM public.employees e
   WHERE ej.job_id = _job_id
     AND ej.employee_id = e.id
     AND ej.is_present = true
     AND e.is_admin = false;

  SELECT COALESCE(SUM(ej.calculated_pay), 0) INTO _normal_total
    FROM public.employee_jobs ej
    JOIN public.employees e ON e.id = ej.employee_id
   WHERE ej.job_id = _job_id AND ej.is_present = true AND e.is_admin = false;

  SELECT COUNT(*) INTO _admin_count
    FROM public.employee_jobs ej
    JOIN public.employees e ON e.id = ej.employee_id
   WHERE ej.job_id = _job_id AND ej.is_present = true AND e.is_admin = true;

  _remainder := _job_total - _normal_total;
  IF _admin_count > 0 THEN
    _admin_share := ROUND(_remainder / _admin_count, 2);
  ELSE
    _admin_share := 0;
  END IF;

  UPDATE public.employee_jobs ej
     SET calculated_pay = _admin_share
    FROM public.employees e
   WHERE ej.job_id = _job_id
     AND ej.employee_id = e.id
     AND ej.is_present = true
     AND e.is_admin = true;

  -- Release guard so subsequent user-driven mutations recompute normally.
  PERFORM set_config('app.recalc_in_progress', 'off', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_recalc_on_employee_jobs()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Skip if we're already inside recalc_job_pays (prevents infinite recursion).
  IF current_setting('app.recalc_in_progress', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  PERFORM public.recalc_job_pays(COALESCE(NEW.job_id, OLD.job_id));
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_recalc_on_jobs()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('app.recalc_in_progress', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND (
       OLD.tip IS DISTINCT FROM NEW.tip
    OR OLD.estimated_profit IS DISTINCT FROM NEW.estimated_profit
  ) THEN
    PERFORM public.recalc_job_pays(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_recalc_on_invoices()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('app.recalc_in_progress', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  PERFORM public.recalc_job_pays(COALESCE(NEW.job_id, OLD.job_id));
  RETURN COALESCE(NEW, OLD);
END;
$function$;