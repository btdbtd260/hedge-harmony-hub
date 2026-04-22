-- Client technique pour conserver l'historique financier
INSERT INTO public.customers (id, name, address, email, phone, status, hidden)
VALUES ('00000000-0000-0000-0000-0000000d3137', 'Client supprimé', '', '', '', 'completed', true)
ON CONFLICT (id) DO NOTHING;

-- Fonction de suppression en cascade contrôlée
CREATE OR REPLACE FUNCTION public.delete_customer_cascade(_customer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _archive_id uuid := '00000000-0000-0000-0000-0000000d3137';
BEGIN
  -- Sécurité : seuls les utilisateurs approuvés peuvent appeler
  IF NOT public.current_user_approved() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Empêcher la suppression du client technique
  IF _customer_id = _archive_id THEN
    RAISE EXCEPTION 'Cannot delete the archive customer';
  END IF;

  -- 1) PRÉSERVER FINANCE : réassigner factures PAYÉES au client technique
  --    et leurs jobs (pour garder l'intégrité invoice -> job)
  UPDATE public.jobs
     SET client_id = _archive_id
   WHERE id IN (
     SELECT job_id FROM public.invoices
      WHERE client_id = _customer_id AND status = 'paid'
   );

  UPDATE public.invoices
     SET client_id = _archive_id
   WHERE client_id = _customer_id AND status = 'paid';

  -- 2) SUPPRIMER les factures non payées du client
  DELETE FROM public.invoices
   WHERE client_id = _customer_id;

  -- 3) SUPPRIMER les heures employés des jobs restants du client
  DELETE FROM public.employee_jobs
   WHERE job_id IN (SELECT id FROM public.jobs WHERE client_id = _customer_id);

  -- 4) SUPPRIMER les jobs restants (non payés) du client
  DELETE FROM public.jobs
   WHERE client_id = _customer_id;

  -- 5) SUPPRIMER les estimations du client
  DELETE FROM public.estimations
   WHERE client_id = _customer_id;

  -- 6) SUPPRIMER les rappels qui référencent ce client
  DELETE FROM public.reminders
   WHERE type = 'client' AND reference_id = _customer_id;

  -- 7) SUPPRIMER les messages liés à ce client (calendrier / messagerie)
  DELETE FROM public.messages
   WHERE client_id = _customer_id;

  -- 8) SUPPRIMER les demandes d'estimation liées (par external_ref = customer id si existant)
  DELETE FROM public.estimation_requests
   WHERE external_ref = _customer_id::text;

  -- 9) Enfin, supprimer le client
  DELETE FROM public.customers
   WHERE id = _customer_id;
END;
$$;

-- Permettre l'exécution aux utilisateurs authentifiés (la fonction vérifie current_user_approved en interne)
REVOKE ALL ON FUNCTION public.delete_customer_cascade(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_customer_cascade(uuid) TO authenticated;