-- Create email-archive storage bucket for temporary PDF storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'email-archive',
  'email-archive',
  false,
  10485760, -- 10 MB limit
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to email-archive bucket
CREATE POLICY "Authenticated users can upload PDFs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'email-archive' 
  AND auth.uid() IS NOT NULL
);

-- Allow authenticated users to read their own uploaded PDFs
CREATE POLICY "Authenticated users can read email archive PDFs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'email-archive'
  AND auth.uid() IS NOT NULL
);