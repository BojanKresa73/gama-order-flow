-- Dodaj nove role u postojeći enum
-- Ove vrednosti moraju biti committed pre korišćenja u policyima

DO $$ BEGIN
  ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'superuser';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'operator_ctp';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Dodaj is_active u profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Dodaj closed_by u work_orders
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES auth.users(id);