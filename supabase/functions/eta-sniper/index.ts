// =============================================================================
// supabase/functions/eta-sniper/index.ts
// ETA-Sniper: laskee parhaat tolpat nykysijainnista historiadatan perusteella
// =============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// --- Tolppakokoelma (kovakoodattu, kattaa Helsingin keskeiset tolpat) -------
interface Tolppa { id: number; name: string; lat: number; lon: number; zone: string }
const TOLPAT: Tolppa[] = [
  { id: 14, name: 'Rautatientori', lat: 60.1709, lon: 24.9419, zone: 'Helsinki keskusta' },
  { id: 37, name: 'Asema-aukio / Eliel', lat: 60.1718, lon: 24.9396, zone: 'Helsinki keskusta' },
  { id: 6,  name: 'Aleksanterinkatu / Säätytalo', lat: 60.1707, lon: 24.9525, zone: 'Helsinki keskusta' },
  { id: 59, name: 'Kamppi / Narinkkatori', lat: 60.1690, lon: 24.9320, zone: 'Helsinki keskusta' },
  { id: 21, name: 'Erottaja / Savoy', lat: 60.1660, lon: 24.9437, zone: 'Helsinki keskusta' },
  { id: 4,  name: 'Kämp / Pohjoisesplanadi', lat: 60.1683, lon: 24.9450, zone: 'Helsinki keskusta' },
  { id: 17, name: 'Bulevardi / G Livelab', lat: 60.1663, lon: 24.9392, zone: 'Helsinki keskusta' },
  { id: 96, name: 'Simonkenttä / Klubi', lat: 60.1696, lon: 24.9347, zone: 'Helsinki keskusta' },
  { id: 35, name: 'Lasipalatsi / Presidentti', lat: 60.1707, lon: 24.9301, zone: 'Helsinki keskusta' },
  { id: 41, name: 'Museokatu / Eduskunta', lat: 60.1738, lon: 24.9298, zone: 'Helsinki keskusta' },
  { id: 39, name: 'Musiikkitalo / Eliel', lat: 60.1742, lon: 24.9370, zone: 'Helsinki keskusta' },
  { id: 19, name: 'Finlandia-talo', lat: 60.1760, lon: 24.9389, zone: 'Helsinki keskusta' },
  { id: 18, name: 'Kaupunginteatteri / HKT', lat: 60.1846, lon: 24.9532, zone: 'Helsinki keskusta' },
  { id: 26, name: 'Kallio / Sturenkatu', lat: 60.1842, lon: 24.9508, zone: 'Helsinki keskusta' },
  { id: 25, name: 'Kalasatama / Redi', lat: 60.1872, lon: 24.9787, zone: 'Helsinki itä' },
  { id: 45, name: 'Töölöntori', lat: 60.1820, lon: 24.9210, zone: 'Helsinki keskusta' },
  { id: 52, name: 'Ooppera / Itä-Töölö', lat: 60.1827, lon: 24.9270, zone: 'Helsinki keskusta' },
  { id: 79, name: 'Veikkausareena', lat: 60.2061, lon: 24.9293, zone: 'Helsinki pohjoinen' },
  { id: 11, name: 'Ruoholahti / Kaapeli', lat: 60.1639, lon: 24.9150, zone: 'Helsinki länsi' },
  { id: 101, name: 'Länsiterminaali', lat: 60.1542, lon: 24.9203, zone: 'Helsinki länsi' },
  { id: 102, name: 'Olympiaterminaali', lat: 60.1620, lon: 24.9540, zone: 'Helsinki keskusta' },
  { id: 103, name: 'Katajanokka', lat: 60.1664, lon: 24.9690, zone: 'Helsinki keskusta' },
  { id: 104, name: 'Pasila / Tripla', lat: 60.1989, lon: 24.9335, zone: 'Helsinki pohjoinen' },
  { id: 105, name: 'Hakaniemi', lat: 60.1789, lon: 24.9518, zone: 'Helsinki keskusta' },
  { id: 44, name: 'Malmitalo', lat: 60.2503, lon: 25.0094, zone: 'Helsinki pohjoinen' },
]

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getSpeedKmh(hour: number): number {
  if (hour < 6)  return 45
  if (hour < 9)  return 26
  if (hour < 16) return 36
  if (hour < 19) return 20
  if (hour < 23) return 33
  return 46
}

function calcTravelMinutes(fromLat: number, fromLon: number, toLat: number, toLon: number, hour: number): number {
  const dist = haversineKm(fromLat, fromLon, toLat, toLon) * 1.35
  const speed = getSpeedKmh(hour)
  const min = (dist / speed) * 60
  const isRush = (hour >= 7 && hour < 9) || (hour >= 16 && hour < 19)
  return Math.ceil(isRush ? Math.max(min, (dist / (speed * 0.85)) * 60) : min)
}

function calcWeatherMult(weatherCode: number, windSpeed: number, precipitation: number): number {
  if (precipitation >= 10 || weatherCode >= 85) return 1.5
  if (precipitation >= 5  || weatherCode >= 71) return 1.4
  if (precipitation >= 2.5 || weatherCode >= 51) return 1.3
  if (precipitation >= 0.5 || weatherCode >= 45) return 1.2
  if (weatherCode >= 1    || windSpeed > 10)    return 1.1
  return 1.0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const body = await req.json().catch(() => ({}))
    const { current_lat = 60.1699, current_lon = 24.9384, travel_minutes } = body

    const now = new Date()
    const helsinkiNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Helsinki' }))
    const hour = helsinkiNow.getHours()
    const dow = ((helsinkiNow.getDay() + 6) % 7) + 1 // ISO 1..7

    // Sää (best-effort)
    let weatherMult = 1.0
    try {
      const wResp = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${current_lat}&longitude=${current_lon}&current=weather_code,wind_speed_10m,precipitation&timezone=Europe%2FHelsinki`,
        { signal: AbortSignal.timeout(4000) },
      )
      if (wResp.ok) {
        const w = await wResp.json()
        const c = w?.current ?? {}
        weatherMult = calcWeatherMult(c.weather_code ?? 0, c.wind_speed_10m ?? 0, c.precipitation ?? 0)
      }
    } catch (_) {}

    // Historiadata (taxi_trips) — sama tunti, weekend/weekday match, viimeiset 90 pv
    const isWeekend = dow >= 6
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    let trips: Array<{ start_lat: number | null; start_lon: number | null; fare_eur: number | null; duration_min: number | null }> = []
    try {
      const { data } = await supabase
        .from('taxi_trips')
        .select('start_lat, start_lon, fare_eur, duration_min')
        .eq('hour_of_day', hour)
        .eq('is_weekend', isWeekend)
        .gte('start_time', since)
        .not('start_lat', 'is', null)
        .limit(2000)
      trips = data ?? []
    } catch (_) {}

    const FUEL_COST = 2.5
    const RADIUS_KM = 0.6

    const targets = TOLPAT.map((tl) => {
      const tMin = travel_minutes !== undefined
        ? Math.ceil(travel_minutes)
        : calcTravelMinutes(current_lat, current_lon, tl.lat, tl.lon, hour)

      // Etsi tolpan lähellä alkaneet historiakyydit
      const nearby = trips.filter((t) =>
        t.start_lat != null && t.start_lon != null &&
        haversineKm(t.start_lat!, t.start_lon!, tl.lat, tl.lon) <= RADIUS_KM
      )
      const tripCount = nearby.length
      const avgFare = tripCount > 0
        ? nearby.reduce((s, t) => s + Number(t.fare_eur ?? 0), 0) / tripCount
        : 0
      const avgDur = tripCount > 0
        ? nearby.reduce((s, t) => s + Number(t.duration_min ?? 12), 0) / tripCount
        : 12

      // Tolppatodennäköisyys: skaalataan 0..1 logaritmisesti
      const rankProb = Math.min(1, Math.log10(1 + tripCount) / 1.5)

      // Tuntiansio (brutto): oletetaan että saat avgFare per kyyti, kyyti kestää avgDur min
      // ja että odottelu = tMin/2. Tämä on karkea heuristiikka.
      const cycleMin = Math.max(15, tMin + avgDur + 5)
      const eurHGross = tripCount > 0 ? (avgFare * 60) / cycleMin * weatherMult : 0
      const eurHNet = Math.max(0, eurHGross - FUEL_COST * (tMin / 60) * 30)

      let verdict: 'OPTIMAALINEN' | 'KOHTALAINEN' | 'RISKI' = 'RISKI'
      if (eurHNet >= 45 && rankProb >= 0.5) verdict = 'OPTIMAALINEN'
      else if (eurHNet >= 25 || rankProb >= 0.3) verdict = 'KOHTALAINEN'

      const arrivalTime = new Date(Date.now() + tMin * 60 * 1000).toISOString()

      return {
        tolppa_id: tl.id,
        tolppa_name: tl.name,
        lat: tl.lat,
        lon: tl.lon,
        zone: tl.zone,
        arrival_time: arrivalTime,
        travel_minutes: tMin,
        trip_count_hist: tripCount,
        avg_fare_hist: Math.round(avgFare * 100) / 100,
        eur_h_gross: Math.round(eurHGross),
        eur_h_net: Math.round(eurHNet),
        rank_prob: Math.round(rankProb * 100) / 100,
        verdict,
        weather_mult: weatherMult,
      }
    })

    // Jos historiaa ei ole lainkaan, näytetään lähimmät tolpat järjestyksessä
    const hasHistory = targets.some((t) => t.trip_count_hist > 0)
    targets.sort((a, b) => hasHistory
      ? (b.eur_h_net - a.eur_h_net) || (a.travel_minutes - b.travel_minutes)
      : (a.travel_minutes - b.travel_minutes))

    return new Response(
      JSON.stringify({
        data: targets.slice(0, 8),
        meta: {
          weather_mult: weatherMult,
          generated_at: new Date().toISOString(),
          source_lat: current_lat,
          source_lon: current_lon,
          history_trips_in_window: trips.length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Tuntematon virhe'
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
