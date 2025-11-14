-- Create storage bucket for CTP reports
INSERT INTO storage.buckets (id, name, public)
VALUES ('ctp-reports', 'ctp-reports', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the bucket
CREATE POLICY "Authenticated users can upload reports"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'ctp-reports');

CREATE POLICY "Anyone can view reports"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'ctp-reports');