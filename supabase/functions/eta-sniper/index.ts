// =============================================================================
// supabase/functions/eta-sniper/index.ts  v3
// GPS-sijaintiin perustuva sadesuodatus (radius_km)
// =============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Tolppa { id: number; name: string; lat: number; lon: number; zone: string }

const TOLPAT: Tolppa[] = [
  { id: 14,  name: 'Rautatientori',               lat: 60.1709, lon: 24.9419, zone: 'Helsinki keskusta' },
  { id: 37,  name: 'Asema-aukio / Eliel',         lat: 60.1718, lon: 24.9396, zone: 'Helsinki keskusta' },
  { id: 6,   name: 'Aleksanterinkatu / Saatytalo', lat: 60.1707, lon: 24.9525, zone: 'Helsinki keskusta' },
  { id: 59,  name: 'Kamppi / Narinkkatori',       lat: 60.1690, lon: 24.9320, zone: 'Helsinki keskusta' },
  { id: 21,  name: 'Erottaja / Savoy',            lat: 60.1660, lon: 24.9437, zone: 'Helsinki keskusta' },
  { id: 4,   name: 'Kamp / Pohjoisesplanadi',     lat: 60.1683, lon: 24.9450, zone: 'Helsinki keskusta' },
  { id: 17,  name: 'Bulevardi / G Livelab',       lat: 60.1663, lon: 24.9392, zone: 'Helsinki keskusta' },
  { id: 96,  name: 'Simonkentta / Klubi',         lat: 60.1696, lon: 24.9347, zone: 'Helsinki keskusta' },
  { id: 35,  name: 'Lasipalatsi / Presidentti',   lat: 60.1707, lon: 24.9301, zone: 'Helsinki keskusta' },
  { id: 41,  name: 'Museokatu / Eduskunta',       lat: 60.1738, lon: 24.9298, zone: 'Helsinki keskusta' },
  { id: 39,  name: 'Musiikkitalo / Eliel',        lat: 60.1742, lon: 24.9370, zone: 'Helsinki keskusta' },
  { id: 19,  name: 'Finlandia-talo',              lat: 60.1760, lon: 24.9389, zone: 'Helsinki keskusta' },
  { id: 18,  name: 'Kaupunginteatteri / HKT',     lat: 60.1846, lon: 24.9532, zone: 'Helsinki keskusta' },
  { id: 26,  name: 'Kallio / Sturenkatu',         lat: 60.1842, lon: 24.9508, zone: 'Helsinki keskusta' },
  { id: 25,  name: 'Kalasatama / Redi',           lat: 60.1872, lon: 24.9787, zone: 'Helsinki ita' },
  { id: 45,  name: 'Toolontori',                  lat: 60.1820, lon: 24.9210, zone: 'Helsinki keskusta' },
  { id: 52,  name: 'Ooppera / Ita-Toolo',         lat: 60.1827, lon: 24.9270, zone: 'Helsinki keskusta' },
  { id: 79,  name: 'Veikkausareena',              lat: 60.2061, lon: 24.9293, zone: 'Helsinki pohjoinen' },
  { id: 11,  name: 'Ruoholahti / Kaapeli',        lat: 60.1639, lon: 24.9150, zone: 'Helsinki lansi' },
  { id: 101, name: 'Lansiterminaali',             lat: 60.1542, lon: 24.9203, zone: 'Helsinki lansi' },
  { id: 102, name: 'Olympiaterminaali',           lat: 60.1620, lon: 24.9540, zone: 'Helsinki keskusta' },
  { id: 103, name: 'Katajanokka',                 lat: 60.1664, lon: 24.9690, zone: 'Helsinki keskusta' },
  { id: 104, name: 'Pasila / Tripla',             lat: 60.1989, lon: 24.9335, zone: 'Helsinki pohjoinen' },
  { id: 105, name: 'Hakaniemi',                   lat: 60.1789, lon: 24.9518, zone: 'Helsinki keskusta' },
  { id: 44,  name: 'Malmitalo',                   lat: 60.2503, lon: 25.0094, zone: 'Helsinki pohjoinen' },
  { id: 92,  name: 'Lentokentta T2',              lat: 60.3172, lon: 24.9633, zone: 'Vantaa' },
  { id: 93,  name: 'Tikkurila asema',             lat: 60.2937, lon: 25.0440, zone: 'Vantaa' },
  { id: 94,  name: 'Leppaavaara asema',           lat: 60.2194, lon: 24.8118, zone: 'Espoo' },
  { id: 95,  name: 'Keilaniemi',                  lat: 60.1849, lon: 24.8205, zone: 'Espoo' },
  { id: 106, name: 'Itakeskus',                   lat: 60.2100, lon: 25.0780, zone: 'Helsinki ita' },
  { id: 107, name: 'Herttoniemi asema',           lat: 60.2063, lon: 25.0280, zone: 'Helsinki ita' },
  { id: 108, name: 'Vuosaari satama',             lat: 60.2090, lon: 25.1429, zone: 'Helsinki ita' },
  { id: 109, name: 'Mellunmaki',                  lat: 60.2360, lon: 25.1157, zone: 'Helsinki ita' },
]

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2
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

function calcTravelMinutes(
  fromLat: number, fromLon: number,
  toLat: number, toLon: number,
  hour: number,
): number {
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
    const {
      current_lat  = 60.1699,
      current_lon  = 24.9384,
      travel_minutes,
      radius_km    = 10,       // Haku-sade km -- tolpat taman sateen sisalla
    } = body

    const now = new Date()
    const helsinkiNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Helsinki' }))
    const hour = helsinkiNow.getHours()
    const isWeekend = helsinkiNow.getDay() === 0 || helsinkiNow.getDay() === 6

    // Saatiedot
    let weatherMult = 1.0
    try {
      const wResp = await fetch(
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${current_lat}&longitude=${current_lon}` +
        `&current=weather_code,wind_speed_10m,precipitation` +
        `&timezone=Europe%2FHelsinki`,
        { signal: AbortSignal.timeout(4000) },
      )
      if (wResp.ok) {
        const w = await wResp.json()
        const c = w?.current ?? {}
        weatherMult = calcWeatherMult(c.weather_code ?? 0, c.wind_speed_10m ?? 0, c.precipitation ?? 0)
      }
    } catch (_) {}

    // Suodata tolpat sateen mukaan
    const tolpatInRadius = TOLPAT.filter(
      (tl) => haversineKm(current_lat, current_lon, tl.lat, tl.lon) <= radius_km,
    )

    // Jos radius ei kata yhtaan tolppaa, laajennetaan 25 km:iin automaattisesti
    const activeTolpat = tolpatInRadius.length >= 2
      ? tolpatInRadius
      : TOLPAT.filter((tl) => haversineKm(current_lat, current_lon, tl.lat, tl.lon) <= 25)

    // Historiadata start_time-pohjaisesti
    const hourLow  = (hour + 23) % 24
    const hourHigh = (hour + 1) % 24

    interface TripRow {
      start_lat: number | null; start_lon: number | null
      fare_eur: number | null; duration_min: number | null; start_time: string | null
    }
    let trips: TripRow[] = []
    try {
      const { data } = await supabase
        .from('taxi_trips')
        .select('start_lat, start_lon, fare_eur, duration_min, start_time')
        .not('start_lat', 'is', null)
        .not('start_time', 'is', null)
        .gt('fare_eur', 0)
        .gt('duration_min', 0)
        .limit(8000)
      if (data) {
        trips = data.filter((t) => {
          if (!t.start_time) return false
          const d = new Date(t.start_time)
          const h = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Helsinki' })).getHours()
          const isWe = d.getDay() === 0 || d.getDay() === 6
          const inWindow = hourLow <= hourHigh
            ? h >= hourLow && h <= hourHigh
            : h >= hourLow || h <= hourHigh
          return inWindow && isWe === isWeekend
        })
      }
    } catch (_) {}

    const FUEL_COST  = 2.5
    const HIST_RADIUS = 1.0

    const targets = activeTolpat.map((tl) => {
      const distFromDriver = haversineKm(current_lat, current_lon, tl.lat, tl.lon)
      const tMin = travel_minutes !== undefined
        ? Math.ceil(travel_minutes)
        : calcTravelMinutes(current_lat, current_lon, tl.lat, tl.lon, hour)

      const nearby = trips.filter(
        (t) => t.start_lat != null && t.start_lon != null &&
          haversineKm(t.start_lat!, t.start_lon!, tl.lat, tl.lon) <= HIST_RADIUS,
      )
      const tripCount = nearby.length
      const avgFare = tripCount > 0
        ? nearby.reduce((s, t) => s + Number(t.fare_eur ?? 0), 0) / tripCount : 0
      const avgDur = tripCount > 0
        ? nearby.reduce((s, t) => s + Number(t.duration_min ?? 15), 0) / tripCount : 15

      // rank_prob logaritminen 0..0.90
      const rankProb = Math.min(0.90, Math.log10(1 + tripCount) / 1.5)

      // Tuntiansio: fare / ((kesto + 20 min odotus) / 60)
      const cycleHours = (avgDur + 20.0) / 60.0
      const eurHGross = tripCount > 0
        ? Math.round((avgFare / cycleHours) * weatherMult) : 0
      const eurHNet = Math.max(0, eurHGross - FUEL_COST)

      let verdict: 'OPTIMAALINEN' | 'KOHTALAINEN' | 'RISKI' = 'RISKI'
      if (rankProb >= 0.55 && eurHNet >= 45) verdict = 'OPTIMAALINEN'
      else if (rankProb >= 0.30 || eurHNet >= 30) verdict = 'KOHTALAINEN'

      return {
        tolppa_id: tl.id,
        tolppa_name: tl.name,
        lat: tl.lat, lon: tl.lon, zone: tl.zone,
        arrival_time: new Date(Date.now() + tMin * 60 * 1000).toISOString(),
        travel_minutes: tMin,
        dist_from_driver_km: Math.round(distFromDriver * 10) / 10,
        trip_count_hist: tripCount,
        avg_fare_hist: Math.round(avgFare * 100) / 100,
        eur_h_gross: eurHGross,
        eur_h_net: eurHNet,
        rank_prob: Math.round(rankProb * 100) / 100,
        verdict,
        weather_mult: weatherMult,
      }
    })

    const verdictOrder: Record<string, number> = { OPTIMAALINEN: 1, KOHTALAINEN: 2, RISKI: 3 }
    targets.sort((a, b) => {
      const vd = verdictOrder[a.verdict] - verdictOrder[b.verdict]
      if (vd !== 0) return vd
      const ed = b.eur_h_net - a.eur_h_net
      if (Math.abs(ed) > 2) return ed
      return a.travel_minutes - b.travel_minutes
    })

    return new Response(
      JSON.stringify({
        data: targets.slice(0, 8),
        meta: {
          weather_mult: weatherMult,
          generated_at: new Date().toISOString(),
          source_lat: current_lat,
          source_lon: current_lon,
          radius_km,
          tolpat_in_radius: activeTolpat.length,
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
