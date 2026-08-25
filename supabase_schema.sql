-- ==========================================================
-- Supabase Schema for Dog Resort Manager (הריזורט לכלב)
-- Copy and paste this into Supabase SQL Editor to set up tables
-- ==========================================================

-- 1. Bookings Table
CREATE TABLE IF NOT EXISTS public.bookings (
  id TEXT PRIMARY KEY,
  dog_name TEXT NOT NULL,
  dog_breed TEXT,
  owner_name TEXT NOT NULL,
  owner_phone TEXT NOT NULL,
  owner_email TEXT,
  service_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_price NUMERIC DEFAULT 0,
  deposit_amount NUMERIC DEFAULT 0,
  payment_status TEXT NOT NULL,
  payment_method TEXT,
  stay_status TEXT NOT NULL,
  notes TEXT,
  vaccination_valid BOOLEAN DEFAULT TRUE,
  special_diet TEXT,
  medications TEXT,
  behavior_notes TEXT,
  emergency_contact TEXT,
  dog_age_group TEXT,
  dog_gender TEXT,
  crate_trained BOOLEAN,
  dog_photo_url TEXT,
  arrival_time TEXT,
  pickup_time TEXT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Settings Table
CREATE TABLE IF NOT EXISTS public.settings (
  id TEXT PRIMARY KEY DEFAULT 'resort_config',
  resort_name TEXT,
  manager_name TEXT,
  manager_phone TEXT,
  max_capacity INT DEFAULT 12,
  default_daily_rate_boarding NUMERIC DEFAULT 180,
  default_daily_rate_training NUMERIC DEFAULT 6500,
  default_daily_rate_day_training NUMERIC DEFAULT 250,
  default_daily_rate_combined NUMERIC DEFAULT 0,
  default_daily_rate_daycare NUMERIC DEFAULT 90,
  bit_number TEXT,
  paybox_link TEXT,
  bank_details TEXT,
  auto_check_vaccination BOOLEAN DEFAULT TRUE,
  data JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  dogs JSONB DEFAULT '[]'::jsonb,
  total_visits INT DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  open_debt NUMERIC DEFAULT 0,
  is_vip BOOLEAN DEFAULT FALSE,
  last_visit DATE,
  notes TEXT,
  data JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- 5. Create Public Access Policies (Anon & Authenticated)
DROP POLICY IF EXISTS "Allow public access to bookings" ON public.bookings;
CREATE POLICY "Allow public access to bookings" ON public.bookings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access to settings" ON public.settings;
CREATE POLICY "Allow public access to settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access to customers" ON public.customers;
CREATE POLICY "Allow public access to customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);

-- 6. Enable Realtime Publications
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
