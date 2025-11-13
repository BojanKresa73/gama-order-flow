-- Add client status and segment fields
ALTER TABLE public.clients
ADD COLUMN is_vip boolean DEFAULT false NOT NULL,
ADD COLUMN is_blocked boolean DEFAULT false NOT NULL,
ADD COLUMN segment text DEFAULT 'novi' NOT NULL;

-- Add check constraint for segment values
ALTER TABLE public.clients
ADD CONSTRAINT clients_segment_check 
CHECK (segment IN ('novi', 'redovan', 'premium'));