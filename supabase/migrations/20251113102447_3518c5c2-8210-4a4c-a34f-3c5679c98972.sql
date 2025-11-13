-- Create storage bucket for delivery notes
INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-notes', 'delivery-notes', true);

-- Create RLS policies for delivery notes bucket
CREATE POLICY "Authenticated users can view delivery notes"
ON storage.objects FOR SELECT
USING (bucket_id = 'delivery-notes' AND auth.uid() IS NOT NULL);

CREATE POLICY "System can insert delivery notes"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'delivery-notes' AND auth.uid() IS NOT NULL);

-- Add pdf_path column to delivery_notes table
ALTER TABLE delivery_notes ADD COLUMN pdf_path TEXT;