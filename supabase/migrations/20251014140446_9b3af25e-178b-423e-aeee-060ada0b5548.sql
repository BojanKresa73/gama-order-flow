-- Add status column to file_entries table
ALTER TABLE public.file_entries 
ADD COLUMN status text NOT NULL DEFAULT 'open';

-- Add check constraint for valid status values
ALTER TABLE public.file_entries
ADD CONSTRAINT file_entries_status_check 
CHECK (status IN ('open', 'closed'));

-- Add index for better query performance
CREATE INDEX idx_file_entries_status ON public.file_entries(status);