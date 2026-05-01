UPDATE public.newsletter_campaigns
SET html_body = REPLACE(
  html_body,
  'https://ytophmlfbrnhmqtwpijn.supabase.co/storage/v1/object/public/newsletter-assets/1777458560480-gow0fz.png',
  'https://ytophmlfbrnhmqtwpijn.supabase.co/storage/v1/object/public/newsletter-assets/newsletter-1maj-compressed.jpg'
)
WHERE id = 'dd1a787d-b5b4-4e73-aa27-92562bc66087';

-- Reset failed sends to pending so resume picks them up
UPDATE public.newsletter_sends
SET status = 'pending', error_msg = NULL
WHERE campaign_id = 'dd1a787d-b5b4-4e73-aa27-92562bc66087'
  AND status = 'failed';