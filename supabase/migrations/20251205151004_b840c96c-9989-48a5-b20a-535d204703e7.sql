-- Add "Specijalni" paper type
INSERT INTO public.digital_paper_types (name, display_order, is_active)
VALUES ('Specijalni', 100, true)
ON CONFLICT DO NOTHING;