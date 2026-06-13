-- ============================================================
-- Lipunmyynnin ja tapahtumien automaattiseuranta (pg_cron)
--
-- Aikataulut:
--   scrape-events          2 h valein  (uudet tapahtumat sisaan)
--   enrich-event-tickets   1 h valein  (lipunmyynti; funktio itse
--                          priorisoi <6h paassa alkavat "kuumat"
--                          tapahtumat ja tarkistaa muut 6h valein)
--   fetch-harbor-pax       30 min valein (laivojen matkustajamaarat)
--
-- Vaatimukset:
--   - pg_cron ja pg_net -laajennukset (Supabase: Dashboard ->
--     Database -> Extensions -> enable "pg_cron" ja "pg_net")
--   - Korvaa YOUR_PROJECT_REF ja YOUR_ANON_KEY omillasi ennen ajoa
--     (Dashboard -> Settings -> API)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Poista vanhat ajastukset jos olemassa (idempotentti uudelleenajo)
DO $$
BEGIN
  PERFORM cron.unschedule('hesuli-scrape-events');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('hesuli-enrich-tickets');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('hesuli-harbor-pax');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 1. Tapahtumahaku: 2 h valein
SELECT cron.schedule(
  'hesuli-scrape-events',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/scrape-events',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_ANON_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 2. Lipunmyynnin seuranta: 1 h valein
--    Funktio priorisoi itse: <6h paassa alkavat tarkistetaan joka
--    ajolla (1h staleness), kaukaisemmat vasta 6h valein.
SELECT cron.schedule(
  'hesuli-enrich-tickets',
  '15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/enrich-event-tickets',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_ANON_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 3. Laivojen matkustajamaarat: 30 min valein
SELECT cron.schedule(
  'hesuli-harbor-pax',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/fetch-harbor-pax',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_ANON_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Tarkista ajastukset:
--   SELECT jobname, schedule, active FROM cron.job;
