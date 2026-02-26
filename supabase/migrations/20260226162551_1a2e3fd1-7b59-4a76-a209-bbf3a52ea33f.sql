-- Create a public bucket for newsletter assets
INSERT INTO storage.buckets (id, name, public) VALUES ('newsletter-assets', 'newsletter-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow superuser to upload
CREATE POLICY "Superuser can upload newsletter assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'newsletter-assets' AND has_role(auth.uid(), 'superuser'::app_role));

-- Allow superuser to manage
CREATE POLICY "Superuser can manage newsletter assets"
ON storage.objects FOR ALL
USING (bucket_id = 'newsletter-assets' AND has_role(auth.uid(), 'superuser'::app_role));

-- Public read access
CREATE POLICY "Newsletter assets are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'newsletter-assets');