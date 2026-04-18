
-- 1. Roles enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'member');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Approved emails / domains / settings
CREATE TABLE public.approved_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.approved_emails ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.approved_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.approved_domains ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  require_login boolean NOT NULL DEFAULT true,
  google_signin_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_settings (require_login, google_signin_enabled) VALUES (true, true);

-- 3. Security definer functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_email_approved(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.approved_emails WHERE lower(email) = lower(_email))
    OR EXISTS (
      SELECT 1 FROM public.approved_domains
      WHERE lower(split_part(_email, '@', 2)) = lower(domain)
    )
$$;

CREATE OR REPLACE FUNCTION public.current_user_approved()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
      AND public.is_email_approved(u.email)
  )
$$;

-- 4. Trigger: on signup, if email is in approved_emails as admin, grant admin role; otherwise grant member if approved
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin_email boolean;
  is_approved boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.approved_emails
    WHERE lower(email) = lower(NEW.email) AND is_admin = true
  ) INTO is_admin_email;

  SELECT public.is_email_approved(NEW.email) INTO is_approved;

  IF is_admin_email THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  ELSIF is_approved THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- 5. Seed admin
INSERT INTO public.approved_emails (email, is_admin) VALUES ('btdbtd260@gmail.com', true)
ON CONFLICT (email) DO UPDATE SET is_admin = true;

-- 6. RLS policies for new tables
-- user_roles: users see their own roles; admins manage all
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- approved_emails / domains / app_settings: admin only
CREATE POLICY "Admins manage approved emails" ON public.approved_emails FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Approved users read approved emails" ON public.approved_emails FOR SELECT TO authenticated
  USING (public.current_user_approved());

CREATE POLICY "Admins manage approved domains" ON public.approved_domains FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Approved users read approved domains" ON public.approved_domains FOR SELECT TO authenticated
  USING (public.current_user_approved());

CREATE POLICY "Admins manage app settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Approved users read app settings" ON public.app_settings FOR SELECT TO authenticated
  USING (public.current_user_approved());

-- 7. Tighten RLS on existing tables: drop permissive policies, only approved authenticated users
DROP POLICY IF EXISTS "Allow all access to customers" ON public.customers;
DROP POLICY IF EXISTS "Allow all access to estimations" ON public.estimations;
DROP POLICY IF EXISTS "Allow all access to jobs" ON public.jobs;
DROP POLICY IF EXISTS "Allow all access to invoices" ON public.invoices;
DROP POLICY IF EXISTS "Allow all access to expenses" ON public.expenses;
DROP POLICY IF EXISTS "Allow all access to employees" ON public.employees;
DROP POLICY IF EXISTS "Allow all access to employee_jobs" ON public.employee_jobs;
DROP POLICY IF EXISTS "Allow all access to reminders" ON public.reminders;
DROP POLICY IF EXISTS "Allow all access to parameters" ON public.parameters;

CREATE POLICY "Approved users full access" ON public.customers FOR ALL TO authenticated
  USING (public.current_user_approved()) WITH CHECK (public.current_user_approved());
CREATE POLICY "Approved users full access" ON public.estimations FOR ALL TO authenticated
  USING (public.current_user_approved()) WITH CHECK (public.current_user_approved());
CREATE POLICY "Approved users full access" ON public.jobs FOR ALL TO authenticated
  USING (public.current_user_approved()) WITH CHECK (public.current_user_approved());
CREATE POLICY "Approved users full access" ON public.invoices FOR ALL TO authenticated
  USING (public.current_user_approved()) WITH CHECK (public.current_user_approved());
CREATE POLICY "Approved users full access" ON public.expenses FOR ALL TO authenticated
  USING (public.current_user_approved()) WITH CHECK (public.current_user_approved());
CREATE POLICY "Approved users full access" ON public.employees FOR ALL TO authenticated
  USING (public.current_user_approved()) WITH CHECK (public.current_user_approved());
CREATE POLICY "Approved users full access" ON public.employee_jobs FOR ALL TO authenticated
  USING (public.current_user_approved()) WITH CHECK (public.current_user_approved());
CREATE POLICY "Approved users full access" ON public.reminders FOR ALL TO authenticated
  USING (public.current_user_approved()) WITH CHECK (public.current_user_approved());
CREATE POLICY "Approved users full access" ON public.parameters FOR ALL TO authenticated
  USING (public.current_user_approved()) WITH CHECK (public.current_user_approved());
