-- 1. Ajout des colonnes
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS tip numeric NOT NULL DEFAULT 0;

ALTER TABLE public.employee_jobs
  ADD COLUMN IF NOT EXISTS is_present boolean NOT NULL DEFAULT true;

-- 2. Création des 3 admins (idempotent par nom)
INSERT INTO public.employees (name, hourly_rate, active, is_admin)
SELECT v.name, 0, true, true
FROM (VALUES
  ('Alexandre Charlebois'),
  ('Félix Drolet'),
  ('Charles-Antoine Boutin')
) AS v(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.employees e WHERE lower(e.name) = lower(v.name)
);

-- 3. Verrou : on ne peut pas changer is_admin après création,
--    ni désactiver/supprimer un admin
CREATE OR REPLACE FUNCTION public.protect_admin_employees()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.is_admin IS DISTINCT FROM NEW.is_admin THEN
      RAISE EXCEPTION 'Le statut admin d''un employé ne peut pas être modifié';
    END IF;
    IF OLD.is_admin = true AND NEW.active = false THEN
      RAISE EXCEPTION 'Un employé admin ne peut pas être désactivé';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.is_admin = true THEN
      RAISE EXCEPTION 'Un employé admin ne peut pas être supprimé';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_admin_employees_upd ON public.employees;
CREATE TRIGGER trg_protect_admin_employees_upd
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.protect_admin_employees();

DROP TRIGGER IF EXISTS trg_protect_admin_employees_del ON public.employees;
CREATE TRIGGER trg_protect_admin_employees_del
  BEFORE DELETE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.protect_admin_employees();

-- 4. Recalcul automatique des paies de tous les employés d'une job
--    Logique :
--      total_job = invoice.amount (ou estimated_profit si pas encore facturé) + jobs.tip
--      employés normaux présents : pay = hours_worked * hourly_rate
--      reste = total_job - somme(paies normaux présents)
--      admins présents : reste / nb_admins_présents (chacun)
--      absents (is_present=false) : pay=0, hours=0
CREATE OR REPLACE FUNCTION public.recalc_job_pays(_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _tip numeric := 0;
  _job_total numeric := 0;
  _normal_total numeric := 0;
  _admin_count int := 0;
  _admin_share numeric := 0;
  _remainder numeric := 0;
BEGIN
  SELECT COALESCE(j.tip, 0) INTO _tip FROM public.jobs j WHERE j.id = _job_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Total de la job : facture si existe, sinon estimated_profit
  SELECT COALESCE(
    (SELECT i.amount FROM public.invoices i
       WHERE i.job_id = _job_id ORDER BY i.issued_at DESC LIMIT 1),
    (SELECT j.estimated_profit FROM public.jobs j WHERE j.id = _job_id),
    0
  ) INTO _job_total;

  _job_total := _job_total + _tip;

  -- Forcer absents à 0
  UPDATE public.employee_jobs ej
     SET hours_worked = 0, calculated_pay = 0
   WHERE ej.job_id = _job_id AND ej.is_present = false;

  -- Payer les employés normaux présents
  UPDATE public.employee_jobs ej
     SET calculated_pay = ROUND(ej.hours_worked * e.hourly_rate, 2)
    FROM public.employees e
   WHERE ej.job_id = _job_id
     AND ej.employee_id = e.id
     AND ej.is_present = true
     AND e.is_admin = false;

  -- Total payé aux normaux présents
  SELECT COALESCE(SUM(ej.calculated_pay), 0) INTO _normal_total
    FROM public.employee_jobs ej
    JOIN public.employees e ON e.id = ej.employee_id
   WHERE ej.job_id = _job_id AND ej.is_present = true AND e.is_admin = false;

  -- Compter les admins présents
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

  -- Payer les admins présents
  UPDATE public.employee_jobs ej
     SET calculated_pay = _admin_share
    FROM public.employees e
   WHERE ej.job_id = _job_id
     AND ej.employee_id = e.id
     AND ej.is_present = true
     AND e.is_admin = true;
END;
$$;

-- 5. Triggers de recalcul
CREATE OR REPLACE FUNCTION public.trg_recalc_on_employee_jobs()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalc_job_pays(COALESCE(NEW.job_id, OLD.job_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_employee_jobs_recalc ON public.employee_jobs;
CREATE TRIGGER trg_employee_jobs_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.employee_jobs
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_on_employee_jobs();

CREATE OR REPLACE FUNCTION public.trg_recalc_on_jobs()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
       OLD.tip IS DISTINCT FROM NEW.tip
    OR OLD.estimated_profit IS DISTINCT FROM NEW.estimated_profit
  ) THEN
    PERFORM public.recalc_job_pays(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jobs_recalc ON public.jobs;
CREATE TRIGGER trg_jobs_recalc
  AFTER UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_on_jobs();

CREATE OR REPLACE FUNCTION public.trg_recalc_on_invoices()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalc_job_pays(COALESCE(NEW.job_id, OLD.job_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_recalc ON public.invoices;
CREATE TRIGGER trg_invoices_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_on_invoices();