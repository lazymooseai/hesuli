// =============================================================================
// supabase/functions/eta-sniper/index.ts  v4
// Koko PKS-alue, metro- ja juna-asemat, jarjestys matka-ajan mukaan
// =============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Tolppa {
  id: number; name: string; lat: number; lon: number
  zone: string; isStation?: boolean
}

// Kattava PKS-tolppalista: keskusta + asemat + metro + itä + länsi + espoo + vantaa
const TOLPAT: Tolppa[] = [
  // === KESKUSTA ===
  { id: 14,  name: 'Rautatientori',              lat: 60.1709, lon: 24.9419, zone: 'Helsinki keskusta' },
  { id: 37,  name: 'Asema-aukio / Eliel',        lat: 60.1718, lon: 24.9396, zone: 'Helsinki keskusta' },
  { id: 6,   name: 'Aleksanterinkatu',           lat: 60.1707, lon: 24.9525, zone: 'Helsinki keskusta' },
  { id: 59,  name: 'Kamppi / Narinkkatori',      lat: 60.1690, lon: 24.9320, zone: 'Helsinki keskusta' },
  { id: 21,  name: 'Erottaja / Savoy',           lat: 60.1660, lon: 24.9437, zone: 'Helsinki keskusta' },
  { id: 4,   name: 'Kamp / Pohjoisesplanadi',    lat: 60.1683, lon: 24.9450, zone: 'Helsinki keskusta' },
  { id: 17,  name: 'Bulevardi / G Livelab',      lat: 60.1663, lon: 24.9392, zone: 'Helsinki keskusta' },
  { id: 96,  name: 'Simonkentta / Klubi',        lat: 60.1696, lon: 24.9347, zone: 'Helsinki keskusta' },
  { id: 35,  name: 'Lasipalatsi / Presidentti',  lat: 60.1707, lon: 24.9301, zone: 'Helsinki keskusta' },
  { id: 41,  name: 'Museokatu / Eduskunta',      lat: 60.1738, lon: 24.9298, zone: 'Helsinki keskusta' },
  { id: 39,  name: 'Musiikkitalo',               lat: 60.1758, lon: 24.9355, zone: 'Helsinki keskusta' },
  { id: 19,  name: 'Finlandia-talo',             lat: 60.1760, lon: 24.9389, zone: 'Helsinki keskusta' },
  { id: 45,  name: 'Toolontori',                 lat: 60.1820, lon: 24.9210, zone: 'Helsinki keskusta' },
  { id: 52,  name: 'Ooppera / Olympiastadion',   lat: 60.1827, lon: 24.9270, zone: 'Helsinki keskusta' },
  { id: 26,  name: 'Kallio / Sturenkatu',        lat: 60.1842, lon: 24.9508, zone: 'Helsinki keskusta' },
  { id: 18,  name: 'Kaupunginteatteri / HKT',    lat: 60.1846, lon: 24.9532, zone: 'Helsinki keskusta' },
  { id: 105, name: 'Hakaniemi',                  lat: 60.1789, lon: 24.9518, zone: 'Helsinki keskusta' },
  { id: 102, name: 'Olympiaterminaali / P1',     lat: 60.1620, lon: 24.9540, zone: 'Helsinki keskusta' },
  { id: 103, name: 'Katajanokka / P2',           lat: 60.1664, lon: 24.9690, zone: 'Helsinki keskusta' },

  // === JUNA-ASEMAT (hairiotilanteiden varalta) ===
  { id: 200, name: 'Pasila asema',               lat: 60.1989, lon: 24.9335, zone: 'Helsinki pohjoinen', isStation: true },
  { id: 201, name: 'Ilmala asema',               lat: 60.2143, lon: 24.9207, zone: 'Helsinki pohjoinen', isStation: true },
  { id: 202, name: 'Kaapyla asema',              lat: 60.2153, lon: 24.9520, zone: 'Helsinki pohjoinen', isStation: true },
  { id: 203, name: 'Oulunkyla asema',            lat: 60.2293, lon: 24.9678, zone: 'Helsinki pohjoinen', isStation: true },
  { id: 204, name: 'Pukinmaki asema',            lat: 60.2396, lon: 24.9927, zone: 'Helsinki pohjoinen', isStation: true },
  { id: 205, name: 'Malmi asema',                lat: 60.2510, lon: 25.0090, zone: 'Helsinki pohjoinen', isStation: true },
  { id: 206, name: 'Tapanila asema',             lat: 60.2650, lon: 25.0220, zone: 'Helsinki pohjoinen', isStation: true },
  { id: 207, name: 'Tikkurila asema',            lat: 60.2925, lon: 25.0440, zone: 'Vantaa',            isStation: true },
  { id: 208, name: 'Kerava asema',               lat: 60.4034, lon: 25.1040, zone: 'Vantaa',            isStation: true },
  { id: 209, name: 'Pitajanmaki asema',          lat: 60.2148, lon: 24.8540, zone: 'Helsinki länsi',    isStation: true },
  { id: 210, name: 'Myyrmaki asema',             lat: 60.2614, lon: 24.8543, zone: 'Vantaa',            isStation: true },
  { id: 211, name: 'Leppavaara asema',           lat: 60.2189, lon: 24.8131, zone: 'Espoo',             isStation: true },
  { id: 212, name: 'Kauniainen asema',           lat: 60.2097, lon: 24.7296, zone: 'Espoo',             isStation: true },
  { id: 213, name: 'Espoo asema',                lat: 60.2055, lon: 24.6559, zone: 'Espoo',             isStation: true },
  { id: 214, name: 'Kirkkonummi asema',          lat: 60.1195, lon: 24.4359, zone: 'Espoo',             isStation: true },

  // === METRO-ASEMAT (hairiotilanteiden varalta) ===
  { id: 300, name: 'Hakaniemi metro',            lat: 60.1789, lon: 24.9518, zone: 'Helsinki keskusta', isStation: true },
  { id: 301, name: 'Sörnäinen metro',            lat: 60.1866, lon: 24.9662, zone: 'Helsinki keskusta', isStation: true },
  { id: 302, name: 'Kallio / Kurvi metro',       lat: 60.1897, lon: 24.9589, zone: 'Helsinki keskusta', isStation: true },
  { id: 303, name: 'Kalasatama metro',           lat: 60.1872, lon: 24.9787, zone: 'Helsinki itä',      isStation: true },
  { id: 304, name: 'Kulosaari metro',            lat: 60.1893, lon: 25.0045, zone: 'Helsinki itä',      isStation: true },
  { id: 305, name: 'Herttoniemi metro',          lat: 60.1929, lon: 25.0354, zone: 'Helsinki itä',      isStation: true },
  { id: 306, name: 'Siilitie metro',             lat: 60.2043, lon: 25.0545, zone: 'Helsinki itä',      isStation: true },
  { id: 307, name: 'Itakeskus metro',            lat: 60.2103, lon: 25.0807, zone: 'Helsinki itä',      isStation: true },
  { id: 308, name: 'Myllypuro metro',            lat: 60.2233, lon: 25.0750, zone: 'Helsinki itä',      isStation: true },
  { id: 309, name: 'Kontula metro',              lat: 60.2336, lon: 25.0920, zone: 'Helsinki itä',      isStation: true },
  { id: 310, name: 'Mellunmaki metro',           lat: 60.2335, lon: 25.1140, zone: 'Helsinki itä',      isStation: true },
  { id: 311, name: 'Vuosaari metro',             lat: 60.2113, lon: 25.1450, zone: 'Helsinki itä',      isStation: true },
  { id: 312, name: 'Lauttasaari metro',          lat: 60.1597, lon: 24.8784, zone: 'Helsinki länsi',    isStation: true },
  { id: 313, name: 'Koivusaari metro',           lat: 60.1677, lon: 24.8548, zone: 'Helsinki länsi',    isStation: true },
  { id: 314, name: 'Keilaniemi metro',           lat: 60.1758, lon: 24.8290, zone: 'Espoo',             isStation: true },
  { id: 315, name: 'Tapiola metro',              lat: 60.1755, lon: 24.8047, zone: 'Espoo',             isStation: true },
  { id: 316, name: 'Urheilupuisto metro',        lat: 60.1741, lon: 24.7820, zone: 'Espoo',             isStation: true },
  { id: 317, name: 'Niittykumpu metro',          lat: 60.1700, lon: 24.7700, zone: 'Espoo',             isStation: true },
  { id: 318, name: 'Matinkyla metro',            lat: 60.1606, lon: 24.7383, zone: 'Espoo',             isStation: true },
  { id: 319, name: 'Kivenlahti metro',           lat: 60.1500, lon: 24.6500, zone: 'Espoo',             isStation: true },

  // === LÄNSITERMINAALI / SATAMAT ===
  { id: 101, name: 'Lansiterminaali / P3',       lat: 60.1542, lon: 24.9203, zone: 'Helsinki länsi' },

  // === HELSINKI POHJOINEN ===
  { id: 79,  name: 'Veikkausareena',             lat: 60.2061, lon: 24.9293, zone: 'Helsinki pohjoinen' },
  { id: 11,  name: 'Ruoholahti / Kaapeli',       lat: 60.1639, lon: 24.9150, zone: 'Helsinki länsi' },

  // === ESPOO ===
  { id: 400, name: 'Tapiola keskus',             lat: 60.1755, lon: 24.8047, zone: 'Espoo' },
  { id: 401, name: 'Keilaniemi torni',           lat: 60.1758, lon: 24.8290, zone: 'Espoo' },
  { id: 402, name: 'Iso Omena / Matinkyla',      lat: 60.1606, lon: 24.7383, zone: 'Espoo' },
  { id: 403, name: 'Sello / Leppavaara',         lat: 60.2189, lon: 24.8131, zone: 'Espoo' },
  { id: 404, name: 'Otaniemi / Aalto',           lat: 60.1844, lon: 24.8260, zone: 'Espoo' },

  // === VANTAA ===
  { id: 500, name: 'Lentokentta T2',             lat: 60.3172, lon: 24.9633, zone: 'Lentoasema' },
  { id: 501, name: 'Lentokentta T1',             lat: 60.3147, lon: 24.9580, zone: 'Lentoasema' },
  { id: 502, name: 'Jumbo / Flamingo',           lat: 60.2880, lon: 25.0370, zone: 'Vantaa' },
  { id: 503, name: 'Aviapolis',                  lat: 60.2960, lon: 24.9550, zone: 'Vantaa' },
  { id: 504, name: 'Myyrmanni / Myyrmaki',       lat: 60.2614, lon: 24.8543, zone: 'Vantaa' },
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
  toLat: number, toLon: number, hour: number,
): number {
  const dist = haversineKm(fromLat, fromLon, toLat, toLon) * 1.35
  const speed = getSpeedKmh(hour)
  const min = (dist / speed) * 60
  const isRush = (hour >= 7 && hour < 9) || (hour >= 16 && hour < 19)
  return Math.ceil(isRush ? Math.max(min, (dist / (speed * 0.85)) * 60) : min)
}

function calcWeatherMult(code: number, wind: number, precip: number): number {
  if (precip >= 10 || code >= 85) return 1.5
  if (precip >= 5  || code >= 71) return 1.4
  if (precip >= 2.5 || code >= 51) return 1.3
  if (precip >= 0.5 || code >= 45) return 1.2
  if (code >= 1    || wind > 10)   return 1.1
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
    const HIST_RADIUS = 1.2  // km tolpan ymparilla historiadataa varten

    const targets = TOLPAT.map((tl) => {
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

      // rank_prob: logaritminen 0..0.90
      const rankProb = Math.min(0.90, Math.log10(1 + tripCount) / 1.5)

      // Tuntiansio: fare / ((kesto + 20 min) / 60)
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
        is_station: tl.isStation ?? false,
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

    // Jarjesta: verdict -> eur_h_net -> matka-aika
    const vo: Record<string, number> = { OPTIMAALINEN: 1, KOHTALAINEN: 2, RISKI: 3 }
    targets.sort((a, b) => {
      const vd = vo[a.verdict] - vo[b.verdict]
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
          history_trips_in_window: trips.length,
          total_tolpat: TOLPAT.length,
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
