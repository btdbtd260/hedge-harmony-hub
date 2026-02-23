
-- CUSTOMERS
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','scheduled','completed','next_year')),
  hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  active_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now())
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);

-- ESTIMATIONS
CREATE TABLE public.estimations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.customers(id),
  cut_type TEXT NOT NULL DEFAULT 'trim' CHECK (cut_type IN ('trim','levelling')),
  facade_length NUMERIC NOT NULL DEFAULT 0,
  left_length NUMERIC NOT NULL DEFAULT 0,
  right_length NUMERIC NOT NULL DEFAULT 0,
  back_length NUMERIC NOT NULL DEFAULT 0,
  height_mode TEXT NOT NULL DEFAULT 'global' CHECK (height_mode IN ('global','per_side')),
  height_global NUMERIC NOT NULL DEFAULT 4,
  height_facade NUMERIC NOT NULL DEFAULT 0,
  height_left NUMERIC NOT NULL DEFAULT 0,
  height_right NUMERIC NOT NULL DEFAULT 0,
  height_back NUMERIC NOT NULL DEFAULT 0,
  width NUMERIC NOT NULL DEFAULT 2,
  extras JSONB NOT NULL DEFAULT '[]',
  bushes_count INTEGER NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pdf_url TEXT
);

ALTER TABLE public.estimations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to estimations" ON public.estimations FOR ALL USING (true) WITH CHECK (true);

-- JOBS
CREATE TABLE public.jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.customers(id),
  estimation_id UUID REFERENCES public.estimations(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','scheduled','completed','hidden')),
  scheduled_date DATE,
  start_time TEXT,
  end_time TEXT,
  total_duration_minutes INTEGER,
  before_photos TEXT[] NOT NULL DEFAULT '{}',
  after_photos TEXT[] NOT NULL DEFAULT '{}',
  cut_type TEXT NOT NULL DEFAULT 'trim',
  measurement_snapshot JSONB NOT NULL DEFAULT '{}',
  estimated_profit NUMERIC NOT NULL DEFAULT 0,
  real_profit NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to jobs" ON public.jobs FOR ALL USING (true) WITH CHECK (true);

-- INVOICES
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id),
  client_id UUID NOT NULL REFERENCES public.customers(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','paid')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  pdf_url TEXT
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to invoices" ON public.invoices FOR ALL USING (true) WITH CHECK (true);

-- EXPENSES
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('gas','insurance','equipment','other')),
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);

-- EMPLOYEES
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  hourly_rate NUMERIC NOT NULL DEFAULT 20,
  active BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to employees" ON public.employees FOR ALL USING (true) WITH CHECK (true);

-- EMPLOYEE_JOBS
CREATE TABLE public.employee_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  job_id UUID NOT NULL REFERENCES public.jobs(id),
  hours_worked NUMERIC NOT NULL DEFAULT 0,
  calculated_pay NUMERIC NOT NULL DEFAULT 0
);

ALTER TABLE public.employee_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to employee_jobs" ON public.employee_jobs FOR ALL USING (true) WITH CHECK (true);

-- REMINDERS
CREATE TABLE public.reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'client' CHECK (type IN ('client','maintenance')),
  reference_id UUID,
  due_date DATE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_completed BOOLEAN NOT NULL DEFAULT false,
  notification_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to reminders" ON public.reminders FOR ALL USING (true) WITH CHECK (true);

-- PARAMETERS (single row config)
CREATE TABLE public.parameters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  price_per_foot_trim NUMERIC NOT NULL DEFAULT 4.5,
  price_per_foot_levelling NUMERIC NOT NULL DEFAULT 6,
  bush_price NUMERIC NOT NULL DEFAULT 40,
  height_multiplier_threshold NUMERIC NOT NULL DEFAULT 5,
  height_multiplier NUMERIC NOT NULL DEFAULT 1.5,
  width_multiplier_threshold NUMERIC NOT NULL DEFAULT 3,
  width_multiplier NUMERIC NOT NULL DEFAULT 1.3,
  company_name TEXT NOT NULL DEFAULT 'HedgePro',
  company_address TEXT NOT NULL DEFAULT '',
  company_phone TEXT NOT NULL DEFAULT '',
  company_email TEXT NOT NULL DEFAULT '',
  social_links JSONB NOT NULL DEFAULT '[]',
  maintenance_interval_days INTEGER NOT NULL DEFAULT 90,
  reminder_notification_time TEXT NOT NULL DEFAULT '08:00',
  split_rule_profit_expense NUMERIC NOT NULL DEFAULT 70,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.parameters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to parameters" ON public.parameters FOR ALL USING (true) WITH CHECK (true);

-- Insert default parameters row
INSERT INTO public.parameters (
  company_name, company_address, company_phone, company_email,
  social_links
) VALUES (
  'HedgePro', '123 Rue des Cèdres, Laval, QC', '514-555-0000', 'info@hedgepro.ca',
  '[{"platform":"Facebook","url":"https://facebook.com/hedgepro"}]'
);
