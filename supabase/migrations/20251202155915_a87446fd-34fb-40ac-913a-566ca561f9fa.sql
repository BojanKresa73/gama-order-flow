-- Add secondary notification email field to clients table
ALTER TABLE public.clients 
ADD COLUMN notification_email_2 text;