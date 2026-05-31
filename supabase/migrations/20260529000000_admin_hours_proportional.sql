-- Allow admin pay to be calculated proportionally to hours worked rather than
-- equal split. Controlled by job.measurement_snapshot->>'adminHoursActive'.
-- When true, admin pay = (hours_worked / total_admin_hours) * remainder.
-- When false or missing, keeps the existing equal-split logic.

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
  _admin_hours_active boolean := false;
  _total_admin_hours numeric := 0;
BEGIN
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

  -- Check if proportional hours mode is active
  SELECT COALESCE(
    (SELECT (j.measurement_snapshot->>'adminHoursActive')::boolean FROM public.jobs j WHERE j.id = _job_id),
    false
  ) INTO _admin_hours_active;

  IF _admin_hours_active AND _admin_count > 0 THEN
    -- Proportional mode: pay admins based on their hours
    SELECT COALESCE(SUM(ej.hours_worked), 0) INTO _total_admin_hours
      FROM public.employee_jobs ej
      JOIN public.employees e ON e.id = ej.employee_id
     WHERE ej.job_id = _job_id AND ej.is_present = true AND e.is_admin = true;

    IF _total_admin_hours > 0 THEN
      UPDATE public.employee_jobs ej
         SET calculated_pay = ROUND(
           (ej.hours_worked / _total_admin_hours) * _remainder, 2
         )
        FROM public.employees e
       WHERE ej.job_id = _job_id
         AND ej.employee_id = e.id
         AND ej.is_present = true
         AND e.is_admin = true;
    ELSE
      -- Fallback to equal split if no hours recorded
      _admin_share := ROUND(_remainder / _admin_count, 2);
      UPDATE public.employee_jobs ej
         SET calculated_pay = _admin_share
        FROM public.employees e
       WHERE ej.job_id = _job_id
         AND ej.employee_id = e.id
         AND ej.is_present = true
         AND e.is_admin = true;
    END IF;
  ELSIF _admin_count > 0 THEN
    -- Equal split mode (default)
    _admin_share := ROUND(_remainder / _admin_count, 2);
    UPDATE public.employee_jobs ej
       SET calculated_pay = _admin_share
      FROM public.employees e
     WHERE ej.job_id = _job_id
       AND ej.employee_id = e.id
       AND ej.is_present = true
       AND e.is_admin = true;
  END IF;

  PERFORM set_config('app.recalc_in_progress', 'off', true);
END;
$function$;
