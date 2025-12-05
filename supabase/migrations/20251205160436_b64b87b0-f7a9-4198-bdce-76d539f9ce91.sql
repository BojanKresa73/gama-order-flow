-- Add obim column to digital_jobs table (sheets per copy, default 1)
ALTER TABLE public.digital_jobs ADD COLUMN IF NOT EXISTS obim integer NOT NULL DEFAULT 1;