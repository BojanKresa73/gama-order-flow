-- Add type column to email_log table
ALTER TABLE public.email_log 
ADD COLUMN type text CHECK (type IN ('archive', 'client'));