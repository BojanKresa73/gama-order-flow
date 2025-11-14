-- Add cover_sheets and lamination_sheets columns to digital_jobs
ALTER TABLE digital_jobs 
ADD COLUMN IF NOT EXISTS cover_sheets integer,
ADD COLUMN IF NOT EXISTS lamination_sheets integer;