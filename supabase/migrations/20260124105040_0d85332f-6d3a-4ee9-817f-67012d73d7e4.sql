-- Add pieces_count column to digital_jobs for manual entry of pieces per copy
ALTER TABLE public.digital_jobs 
ADD COLUMN pieces_count integer NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.digital_jobs.pieces_count IS 'Number of pieces (flyers, cards, etc.) imposed per copy. Used to calculate price per piece.';