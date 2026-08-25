DROP POLICY IF EXISTS "complaint_attachments_client_insert" ON public.complaint_attachments;

CREATE POLICY "complaint_attachments_client_insert"
ON public.complaint_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND is_client_portal_user()
  AND EXISTS (
    SELECT 1 FROM public.complaints c
    WHERE c.id = complaint_attachments.complaint_id
      AND c.client_id = current_user_client_id()
  )
  AND (
    SELECT count(*) FROM public.complaint_attachments a
    WHERE a.complaint_id = complaint_attachments.complaint_id
  ) < 5
);