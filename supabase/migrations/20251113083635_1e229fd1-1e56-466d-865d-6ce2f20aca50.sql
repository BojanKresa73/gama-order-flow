-- Create partial unique index on PIB (only when not empty)
CREATE UNIQUE INDEX idx_clients_pib_unique 
ON public.clients (pib) 
WHERE pib IS NOT NULL AND LENGTH(TRIM(pib)) > 0;