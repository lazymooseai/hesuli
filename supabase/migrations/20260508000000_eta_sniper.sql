-- =============================================================================
-- ETA-SNIPER MIGRATION v1.0
-- Helsinki Pulse | lazymooseai/helsinki-pulse-45cabf7a
-- =============================================================================
-- Lisaa taxi_trips-tauluun uudet sarakkeet, luo tolppa_locations-taulu,
-- nakyymat trip_heatmap ja same_day_history seka RPC-funktio
-- get_eta_sniper_targets. Triggerifunktio classify_taxi_trip luokittelee
-- uudet ajot automaattisesti.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. Uudet sarakkeet olemassa olevaan taxi_trips-tauluun
-- ----------------------------------------------------------------------------
ALTER TABLE public.taxi_trips
    ADD COLUMN IF NOT EXISTS ride_source TEXT DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS pickup_zone TEXT;

-- Lisaa check-rajoite ride_source-sarakkeelle
ALTER TABLE public.taxi_trips
    DROP CONSTRAINT IF EXISTS taxi_trips_ride_source_check;
ALTER TABLE public.taxi_trips
    ADD CONSTRAINT taxi_trips_ride_source_check
    CHECK (ride_source IN ('rank', 'app', 'phone', 'unknown'));

-- Indeksi nopeuttaa hakuja viikonpaivan ja tunnin mukaan
CREATE INDEX IF NOT EXISTS idx_taxi_trips_dow_hour
    ON public.taxi_trips (day_of_week, hour_of_day);

CREATE INDEX IF NOT EXISTS idx_taxi_trips_pickup_zone
    ON public.taxi_trips (pickup_zone);

-- ----------------------------------------------------------------------------
-- 2. tolppa_locations: 31 Helsingin taksitolppaa
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tolppa_locations (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    lat             DOUBLE PRECISION NOT NULL,
    lon             DOUBLE PRECISION NOT NULL,
    zone            TEXT NOT NULL,
    district        TEXT,
    rank_freq_estimate NUMERIC(3,2) NOT NULL DEFAULT 0.60,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Estaa duplikaatit
CREATE UNIQUE INDEX IF NOT EXISTS idx_tolppa_name
    ON public.tolppa_locations (name);

-- Tyhjennetaan ja ladataan tuore data (idempotent)
TRUNCATE public.tolppa_locations RESTART IDENTITY;

INSERT INTO public.tolppa_locations (name, lat, lon, zone, district, rank_freq_estimate) VALUES
-- KESKUSTA
('Rautatieasema',            60.1710,  24.9413, 'keskusta', 'Keskusta',     0.82),
('Kampin terminaali',        60.1688,  24.9315, 'keskusta', 'Kamppi',       0.78),
('Kauppatori',               60.1674,  24.9526, 'keskusta', 'Etelaesplanadi', 0.75),
('Erottaja',                 60.1648,  24.9440, 'keskusta', 'Punavuori',    0.70),
('Senaatintori',             60.1694,  24.9525, 'keskusta', 'Kruununhaka',  0.68),
('Mannerheimintie / Sokos',  60.1699,  24.9381, 'keskusta', 'Keskusta',     0.80),
('Hakaniemi',                60.1784,  24.9497, 'pohjoinen','Hakaniemi',    0.72),
-- POHJOINEN HELSINKI
('Pasila asema',             60.1989,  24.9338, 'pohjoinen','Pasila',       0.76),
('Kaapelitehdas / Ruoholahti', 60.1600, 24.9100, 'lansi',  'Ruoholahti',   0.58),
('Oulunkyla asema',          60.2346,  24.9677, 'pohjoinen','Oulunkyla',    0.55),
('Malmi asema',              60.2507,  25.0077, 'pohjoinen','Malmi',        0.60),
('Pukinmaki asema',          60.2396,  24.9927, 'pohjoinen','Pukinmaki',    0.52),
('Kaapyla',                  60.2125,  24.9452, 'pohjoinen','Kaapyla',      0.50),
-- ITA-HELSINKI
('Kalasatama',               60.1870,  24.9741, 'ita',      'Kalasatama',   0.62),
('Herttoniemi asema',        60.2063,  25.0280, 'ita',      'Herttoniemi',  0.65),
('Itakeskus',                60.2100,  25.0780, 'ita',      'Itakeskus',    0.72),
('Mellunmaki',               60.2360,  25.1157, 'ita',      'Mellunmaki',   0.48),
('Vuosaari satama',          60.2090,  25.1429, 'ita',      'Vuosaari',     0.70),
-- LANSI-HELSINKI
('Lauttasaari',              60.1611,  24.8861, 'lansi',    'Lauttasaari',  0.58),
('Pitajanmaki asema',        60.2148,  24.8540, 'lansi',    'Pitajanmaki',  0.55),
('Kannelmaki',               60.2296,  24.8704, 'lansi',    'Kannelmaki',   0.50),
('Haaga',                    60.2248,  24.8948, 'lansi',    'Haaga',        0.52),
('Munkkiniemi',              60.2022,  24.8809, 'lansi',    'Munkkiniemi',  0.55),
-- ESPOO
('Leppaavaara asema',        60.2194,  24.8118, 'espoo',    'Leppaavaara',  0.65),
('Keilaniemi',               60.1849,  24.8205, 'espoo',    'Keilaniemi',   0.70),
('Tapiola',                  60.1781,  24.8028, 'espoo',    'Tapiola',      0.65),
('Matinkyla / Iso Omena',    60.1611,  24.7344, 'espoo',    'Matinkyla',    0.60),
-- VANTAA
('Tikkurila asema',          60.2937,  25.0440, 'vantaa',   'Tikkurila',    0.68),
('Myyrmaki asema',           60.2639,  24.8540, 'vantaa',   'Myyrmaki',     0.58),
('Aviapolis',                60.2937,  24.9800, 'vantaa',   'Aviapolis',    0.62),
('Lentokenttä T2',           60.3172,  24.9633, 'vantaa',   'Helsinki-Vantaa', 0.88);

-- RLS: tolppa_locations luetaan julkisesti, kirjoitetaan vain service-rolella
ALTER TABLE public.tolppa_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tolppa_select_all ON public.tolppa_locations;
CREATE POLICY tolppa_select_all ON public.tolppa_locations
    FOR SELECT USING (true);

-- ----------------------------------------------------------------------------
-- 3. Nakyyma: trip_heatmap
--    Viikonpaiva x tunti -matriisi (eur_per_hour, trip_count, rank_pct)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.trip_heatmap AS
SELECT
    t.day_of_week,
    t.hour_of_day,
    t.pickup_zone,
    COUNT(*)                                                        AS trip_count,
    ROUND(AVG(t.fare_eur)::NUMERIC, 2)                             AS avg_fare,
    CASE
        WHEN AVG(t.duration_min) > 0
        THEN ROUND((AVG(t.fare_eur) / (AVG(t.duration_min) / 60.0))::NUMERIC, 2)
        ELSE 0
    END                                                             AS eur_per_hour,
    ROUND(
        (COUNT(*) FILTER (WHERE t.ride_source = 'rank') * 1.0
        / NULLIF(COUNT(*), 0))::NUMERIC,
    2)                                                              AS rank_pct
FROM public.taxi_trips t
WHERE t.pickup_zone IS NOT NULL
  AND t.duration_min > 0
  AND t.fare_eur     > 0
GROUP BY t.day_of_week, t.hour_of_day, t.pickup_zone;

-- ----------------------------------------------------------------------------
-- 4. Nakyyma: same_day_history
--    Vertaa kuluvaa paivaa aiempiin vuosiin
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.same_day_history AS
SELECT
    t.day_of_week,
    t.hour_of_day,
    t.pickup_zone,
    EXTRACT(YEAR FROM t.start_time)::INT                           AS year_num,
    COUNT(*)                                                        AS trip_count,
    ROUND(AVG(t.fare_eur)::NUMERIC, 2)                             AS avg_fare,
    CASE
        WHEN AVG(t.duration_min) > 0
        THEN ROUND((AVG(t.fare_eur) / (AVG(t.duration_min) / 60.0))::NUMERIC, 2)
        ELSE 0
    END                                                             AS eur_per_hour
FROM public.taxi_trips t
WHERE t.start_time    IS NOT NULL
  AND t.duration_min  > 0
  AND t.fare_eur      > 0
GROUP BY t.day_of_week, t.hour_of_day, t.pickup_zone,
         EXTRACT(YEAR FROM t.start_time);

-- ----------------------------------------------------------------------------
-- 5. RPC-funktio: get_eta_sniper_targets
--    Palauttaa max 4 kohdetta paremmuusjarjestyksessa.
--    Parametrit:
--      p_travel_minutes  INT      -- arvioitu matka-aika minuuteissa
--      p_weather_mult    NUMERIC  -- saakerroin (1.0..1.5)
--      p_fuel_cost_eur   NUMERIC  -- polttoainekustannus EUR/h (esim. 2.5)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_eta_sniper_targets(
    p_travel_minutes  INT     DEFAULT 15,
    p_weather_mult    NUMERIC DEFAULT 1.0,
    p_fuel_cost_eur   NUMERIC DEFAULT 2.5
)
RETURNS TABLE (
    tolppa_id       INT,
    tolppa_name     TEXT,
    lat             DOUBLE PRECISION,
    lon             DOUBLE PRECISION,
    zone            TEXT,
    arrival_time    TIMESTAMPTZ,
    travel_minutes  INT,
    trip_count_hist INT,
    avg_fare_hist   NUMERIC,
    eur_h_gross     NUMERIC,
    eur_h_net       NUMERIC,
    rank_prob       NUMERIC,
    verdict         TEXT,
    weather_mult    NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_target_time   TIMESTAMPTZ;
    v_target_dow    INT;
    v_target_hour   INT;
BEGIN
    -- Lasketaan saapumishetki ja poimitaan DOW + tunti
    v_target_time := NOW() AT TIME ZONE 'Europe/Helsinki'
                     + (p_travel_minutes || ' minutes')::INTERVAL;
    v_target_dow  := EXTRACT(DOW  FROM v_target_time)::INT;
    v_target_hour := EXTRACT(HOUR FROM v_target_time)::INT;

    RETURN QUERY
    WITH historical AS (
        -- Historiallinen kysyntä kohdealueella DOW x Hour -matriisista
        SELECT
            t.pickup_zone,
            COUNT(*)                                                   AS trip_count,
            AVG(t.fare_eur)                                            AS avg_fare,
            CASE
                WHEN AVG(t.duration_min) > 0
                THEN AVG(t.fare_eur) / (AVG(t.duration_min) / 60.0)
                ELSE 0.0
            END                                                        AS raw_eur_h,
            COUNT(*) FILTER (WHERE t.ride_source = 'rank') * 1.0
                / NULLIF(COUNT(*), 0)                                  AS rank_pct
        FROM public.taxi_trips t
        WHERE t.day_of_week  = v_target_dow
          AND t.hour_of_day  = v_target_hour
          AND t.pickup_zone  IS NOT NULL
          AND t.duration_min > 0
          AND t.fare_eur     > 0
        GROUP BY t.pickup_zone
        HAVING COUNT(*) >= 3
    ),
    scored AS (
        SELECT
            tl.id::INT                                                  AS tolppa_id,
            tl.name                                                     AS tolppa_name,
            tl.lat,
            tl.lon,
            tl.zone,
            v_target_time                                               AS arrival_time,
            p_travel_minutes                                            AS travel_minutes,
            COALESCE(h.trip_count, 0)::INT                             AS trip_count_hist,
            ROUND(COALESCE(h.avg_fare,  0)::NUMERIC, 2)               AS avg_fare_hist,
            ROUND((COALESCE(h.raw_eur_h, 0) * p_weather_mult)::NUMERIC, 2)
                                                                        AS eur_h_gross,
            ROUND((COALESCE(h.raw_eur_h, 0) * p_weather_mult
                   - p_fuel_cost_eur)::NUMERIC, 2)                     AS eur_h_net,
            ROUND(COALESCE(h.rank_pct, tl.rank_freq_estimate)::NUMERIC, 2)
                                                                        AS rank_prob,
            p_weather_mult                                              AS weather_mult
        FROM public.tolppa_locations tl
        LEFT JOIN historical h ON h.pickup_zone = tl.zone
    ),
    verdicted AS (
        SELECT
            *,
            CASE
                WHEN rank_prob >= 0.75 AND eur_h_net >= 35 THEN 'OPTIMAALINEN'
                WHEN rank_prob >= 0.50 OR  eur_h_net >= 28 THEN 'KOHTALAINEN'
                ELSE                                             'RISKI'
            END AS verdict
        FROM scored
    )
    SELECT
        v.tolppa_id,
        v.tolppa_name,
        v.lat,
        v.lon,
        v.zone,
        v.arrival_time,
        v.travel_minutes,
        v.trip_count_hist,
        v.avg_fare_hist,
        v.eur_h_gross,
        v.eur_h_net,
        v.rank_prob,
        v.verdict,
        v.weather_mult
    FROM verdicted v
    ORDER BY
        CASE v.verdict
            WHEN 'OPTIMAALINEN' THEN 1
            WHEN 'KOHTALAINEN'  THEN 2
            ELSE                     3
        END,
        v.eur_h_net DESC
    LIMIT 4;
END;
$$;

-- Anna anon + authenticated -rooleille oikeus kutsua funktiota
GRANT EXECUTE ON FUNCTION public.get_eta_sniper_targets(INT, NUMERIC, NUMERIC)
    TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. Triggeri: classify_taxi_trip
--    Luokittelee uuden ajon automaattisesti pickup_zone ja ride_source
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.classify_taxi_trip()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_zone TEXT;
BEGIN
    -- Maaraa pickup_zone koordinaateista lahimman tolpan vyohykkeen mukaan
    IF NEW.start_lat IS NOT NULL AND NEW.start_lon IS NOT NULL THEN
        SELECT tl.zone INTO v_zone
        FROM public.tolppa_locations tl
        ORDER BY
            SQRT(POWER(tl.lat - NEW.start_lat, 2)
               + POWER(tl.lon - NEW.start_lon, 2))
        LIMIT 1;
        NEW.pickup_zone := COALESCE(v_zone, 'tuntematon');
    END IF;

    -- Oletusarvo ride_source-sarakkeelle
    IF NEW.ride_source IS NULL THEN
        NEW.ride_source := 'unknown';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_classify_taxi_trip ON public.taxi_trips;
CREATE TRIGGER trg_classify_taxi_trip
    BEFORE INSERT OR UPDATE OF start_lat, start_lon
    ON public.taxi_trips
    FOR EACH ROW
    EXECUTE FUNCTION public.classify_taxi_trip();

-- ----------------------------------------------------------------------------
-- 7. Retroaktiivinen luokittelu (aja kerran olemassa olevalle datalle)
-- ----------------------------------------------------------------------------
-- HUOM: Tama saattaa olla hidas isoilla tauluilla.
-- Aja erillisena jos taxi_trips sisaltaa yli 50 000 riviä.
UPDATE public.taxi_trips t
SET pickup_zone = (
    SELECT tl.zone
    FROM public.tolppa_locations tl
    ORDER BY
        SQRT(POWER(tl.lat - t.start_lat, 2)
           + POWER(tl.lon - t.start_lon, 2))
    LIMIT 1
)
WHERE t.pickup_zone IS NULL
  AND t.start_lat IS NOT NULL
  AND t.start_lon IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 8. Testikysely (poista kommentti ajamista varten)
-- ----------------------------------------------------------------------------
-- SELECT * FROM public.get_eta_sniper_targets(15, 1.2, 2.5);
-- SELECT pickup_zone, ride_source, COUNT(*) FROM public.taxi_trips
--     GROUP BY pickup_zone, ride_source ORDER BY 3 DESC;
