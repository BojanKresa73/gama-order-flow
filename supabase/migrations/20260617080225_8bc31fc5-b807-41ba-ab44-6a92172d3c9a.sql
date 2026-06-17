
-- 1) Dodaj kolonu valid_from
ALTER TABLE public.client_plate_prices
  ADD COLUMN IF NOT EXISTS valid_from DATE NOT NULL DEFAULT '2000-01-01';

-- 2) Zameni jedinstveni indeks da uključi datum
ALTER TABLE public.client_plate_prices
  DROP CONSTRAINT IF EXISTS client_plate_prices_client_id_plate_format_id_key;

ALTER TABLE public.client_plate_prices
  ADD CONSTRAINT client_plate_prices_client_format_validfrom_key
  UNIQUE (client_id, plate_format_id, valid_from);

CREATE INDEX IF NOT EXISTS idx_client_plate_prices_lookup
  ON public.client_plate_prices (client_id, plate_format_id, valid_from DESC);

-- 3) Ubaci nove cene sa važenjem od 15.06.2026
WITH new_prices(client_name, format_name, price_eur, price_eur_mono) AS (
  VALUES
  ('Birograf Comp doo', '1050x795', 4.27::numeric, NULL::numeric),
  ('Birograf Comp doo', '1060x795', 4.27, NULL),
  ('Birograf Comp doo', '745×605', 2.69, NULL),
  ('JP Službeni glasnik d.o.o. ', '1050x795', 4.93, NULL),
  ('JP Službeni glasnik d.o.o. ', '1030×790', 4.93, NULL),
  ('Štamparija Dunav d.o.o.', '740x605', 2.7, NULL),
  ('Štamparija Dunav d.o.o.', '745×605', 2.7, NULL),
  ('Štamparija Dunav d.o.o.', '730x605', 2.7, NULL),
  ('Euro-Dream d.o.o.', '745×605', 3.53, 3.43),
  ('Euro-Dream d.o.o.', '724x615', 3.53, 3.43),
  ('Publik d.o.o.', '1040x800', 5.94, NULL),
  ('Simbol Print doo', '450x370', 2.09, NULL),
  ('Simbol Print doo', '510x400', 2.11, NULL),
  ('Simbol Print doo', '745×605', 3.25, NULL),
  ('SIMPrint doo', '745×605', 3.21, 3.01),
  ('SIMPrint doo', '740x605', 3.2, 3),
  ('SIMPrint doo', '730x605', 3.2, 3),
  ('Proof d.o.o.', '1030×790', 6.07, NULL),
  ('Proof d.o.o.', '510x400', 2.02, NULL),
  ('Proof d.o.o.', '450x370', 2, NULL),
  ('Pekograf doo', '510x400', 2.32, 2.32),
  ('Pekograf doo', '745×605', 3.26, 3.16),
  ('Bigraf Plus d.o.o.', '745×605', 3.06, NULL),
  ('Optimum doo', '1030x785', 5.97, NULL),
  ('3D Print', '745×605', 3.37, NULL),
  ('Čugura Print d.o.o.', '745×605', 4.07, NULL),
  ('Čugura Print d.o.o.', '450x370', 2.3, NULL),
  ('MG Master Graf d.o.o.', '745×605', 3.77, NULL),
  ('No-Kaci d.o.o.', '745×605', 3.67, NULL),
  ('Intra.Net Communication d.o.o.', '450x370', 2.1, NULL),
  ('Intra.Net Communication d.o.o.', '745×605', 3.17, NULL),
  ('Intra.Net Communication d.o.o.', '740x605', 3.17, NULL),
  ('Retro Print d.o.o.', '745×605', 3.77, NULL),
  ('Retro Print d.o.o.', '724x615', 3.76, NULL),
  ('Gama Digital Centar', '1030×790', 4.59, NULL),
  ('Gama Digital Centar', '745×605', 2.37, NULL),
  ('Ambalažerka - Vučković Duško PR', '1030×790', 5.99, NULL),
  ('Majorpromet d.o.o.', '450x370', 2.1, NULL),
  ('Majorpromet d.o.o.', '1030×790', 5.99, NULL),
  ('Majorpromet d.o.o.', '1060x795', 6, NULL),
  ('La Mantini d.o.o.', '745×605', 3.47, NULL),
  ('Dereta d.o.o.', '745×605', 3.57, NULL),
  ('Dereta d.o.o.', '724x615', 3.57, NULL),
  ('Dereta d.o.o.', '510x400', 2.32, NULL),
  ('SPC Izdavačka fondacija', '745×605', 3.67, NULL),
  ('SPC Izdavačka fondacija', '740x605', 3.67, NULL),
  ('Grafikum d.o.o.', '1040x800', 3, NULL),
  ('Gradina Željko Grujić PR ', '510x400', 2.12, NULL),
  ('Pozitiv print d.o.o.', '745×605', 3.77, NULL),
  ('Pozitiv print d.o.o.', '730x605', 3.77, NULL),
  ('Aleksandar Vranic PD ADM Grafika', '724x615', 3.77, NULL),
  ('AMD sistem', '1030×790', 4.84, NULL),
  ('Klik Commerce d.o.o.', '740x605', 3.77, NULL),
  ('Klik Commerce d.o.o.', '745×605', 3.77, NULL),
  ('Grafolik d.o.o.', '745×605', 2.77, NULL),
  ('Stamparija Jovšić Printing Centar', '1030×790', 4.99, NULL),
  ('Mg grafika ', '450x370', 2.3, NULL),
  ('Mg grafika ', '510x400', 2.32, NULL),
  ('Belpak d.o.o.', '740x605', 4.07, NULL),
  ('Belpak d.o.o.', '730x605', 4.07, NULL),
  ('Belpak d.o.o.', '745×605', 4.07, NULL),
  ('Tipo Štampa SR ', '510x400', 2.32, NULL),
  ('Ton Plus d.o.o.', '510x400', 2.32, NULL),
  ('Štamparija Marković-3M', '510x400', 2.32, NULL),
  ('Doubleclick Advertising d.o.o.', '450x370', 2.3, NULL),
  ('Zlamen d.o.o.', '510x400', 2.32, NULL),
  ('Grafo-M štamparija PR Srđan Đukić', '745×605', 3.77, NULL),
  ('Matija d.o.o.', '745×605', 4.47, NULL),
  ('Typoprint d.o.o.', '745×605', 3.47, NULL),
  ('Adore Chocolat d.o.o.', '450x370', 2.3, NULL)
)
INSERT INTO public.client_plate_prices (client_id, plate_format_id, price_eur, price_eur_mono, valid_from)
SELECT c.id, pf.id, np.price_eur, np.price_eur_mono, DATE '2026-06-15'
FROM new_prices np
JOIN public.clients c ON c.name = np.client_name
JOIN public.plate_formats pf ON pf.format_name = np.format_name
ON CONFLICT (client_id, plate_format_id, valid_from) DO UPDATE
  SET price_eur = EXCLUDED.price_eur,
      price_eur_mono = EXCLUDED.price_eur_mono,
      updated_at = now();
