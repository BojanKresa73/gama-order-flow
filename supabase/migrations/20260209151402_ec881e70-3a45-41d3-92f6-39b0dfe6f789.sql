
ALTER TABLE public.clients ADD COLUMN notification_email_3 text;

UPDATE public.clients SET notification_email_3 = 'jelena.plavsic@birograf.rs' WHERE name ILIKE '%birograf%';
