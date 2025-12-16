-- Add closed_by column to file_entries to track who closed each file
ALTER TABLE public.file_entries 
ADD COLUMN closed_by uuid REFERENCES public.profiles(id);

-- Add closed_at column for when the file entry was closed
ALTER TABLE public.file_entries 
ADD COLUMN closed_at timestamp with time zone;