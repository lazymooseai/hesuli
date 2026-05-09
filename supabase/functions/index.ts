// =============================================================================
// eta-sniper/index.ts  --  Supabase Edge Function (Deno)
// Helsinki Pulse | ETA-Sniper v1.0
// =============================================================================
// Yksi kutsu asiakkaalta -> saa saatiedot, laskee Delta-t jokaiselle tolpalle,
// kutsuu get_eta_sniper_targets RPC:ta ja palauttaa rikastetun vastauksen.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// ----------------------------------------------------------------------------
// Tyypit
// ----------------------------------------------------------------------------
interface EtaSniperRequest {
  current_lat?: number
  current_lon?: number
  travel_minutes?: number    // Jos annettu, ohittaa Haversine-laskennan
  use_osrm?: boolean         // Yritetaanko OSRM:aa ennen Haversine-fallbackia
}

interface TolppaRow {
  id: number
  name: string
  lat: number
  lon: number
  zone: string
}

interface RpcTarget {
  tolppa_id: number
  tolppa_name: string
  lat: number
  lon: number
  zone: string
  arrival_time: string
  travel_minutes: number
  trip_count_hist: number
  avg_fare_hist: number
  eur_h_gross: number
  eur_h_net: number
  rank_prob: number
  verdict: string
  weather_mult: number
}

// ----------------------------------------------------------------------------
// Haversine + Helsinki-nopeusvektorit
// ----------------------------------------------------------------------------
const TOPOLOGY_FACTOR = 1.35   // Katuverkon kiertokerroin yksisuuntaisilla kaduilla

function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
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
  if (hour < 6)  return 45   // 00-06 yoliikenne
  if (hour < 9)  return 26   // 06-09 aamuruuhka
  if (hour < 16) return 36   // 09-16 paivaajot
  if (hour < 19) return 20   // 16-19 iltaruuhka (pahin)
  if (hour < 23) return 33   // 19-23 ilta
  return 46                  // 23-24 yomyoha
}

function calcTravelMinutes(
  fromLat: number, fromLon: number,
  toLat: number,   toLon: number,
  hour: number,
): number {
  const distKm = haversineKm(fromLat, fromLon, toLat, toLon) * TOPOLOGY_FACTOR
  const speed  = getSpeedKmh(hour)
  const min    = (distKm / speed) * 60
  // Ruuhkakorjaus: ota konservatiivisempi arvio, jottei myohastyta
  const isRush = (hour >= 7 && hour < 9) || (hour >= 16 && hour < 19)
  if (isRush) {
    const conservativeMin = (distKm / (speed * 0.85)) * 60
    return Math.ceil(Math.max(min, conservativeMin))
  }
  return Math.ceil(min)
}

// ----------------------------------------------------------------------------
// Saakerroin (Open-Meteo WMO-koodit)
// ----------------------------------------------------------------------------
function calcWeatherMult(
  weatherCode: number,
  windSpeed:   number,
  precipitation: number,
): number {
  if (precipitation >= 10 || weatherCode >= 85) return 1.5  // Rankka lumisade
  if (precipitation >= 5  || weatherCode >= 71) return 1.4  // Lumisade
  if (precipitation >= 2.5 || weatherCode >= 51) return 1.3 // Rankka sade
  if (precipitation >= 0.5 || weatherCode >= 45) return 1.2 // Sade
  if (weatherCode >= 1    || windSpeed > 10)    return 1.1  // Pilvinen/tuulinen
  return 1.0
}

// ----------------------------------------------------------------------------
// Paafunktio
// ----------------------------------------------------------------------------
Deno.serve(async (req: Request): Promise<Response> => {
  // OPTIONS-esikysely (CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // -- Luetaan pyyntotiedot --------------------------------------------------
    const body: EtaSniperRequest = await req.json().catch(() => ({}))
    const {
      current_lat  = 60.1699,   // Oletuslokaatio: Rautatieasema
      current_lon  = 24.9384,
      travel_minutes,
      use_osrm     = false,
    } = body

    // Helsingin-ajan tunti Delta-t-nopeuslaskentaa varten
    const helsinkiHour = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Europe/Helsinki' }),
    ).getHours()

    // -- Saatiedot (Open-Meteo) -----------------------------------------------
    let weatherMult = 1.0
    try {
      const weatherUrl =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${current_lat}&longitude=${current_lon}` +
        `&current=weather_code,wind_speed_10m,precipitation` +
        `&timezone=Europe%2FHelsinki`
      const wResp = await fetch(weatherUrl, {
        signal: AbortSignal.timeout(4000),
      })
      if (wResp.ok) {
        const wData = await wResp.json()
        const c = wData?.current ?? {}
        weatherMult = calcWeatherMult(
          c.weather_code   ?? 0,
          c.wind_speed_10m ?? 0,
          c.precipitation  ?? 0,
        )
      }
    } catch {
      // Saadatan haku epaonnistui, kaytetaan neutraalia kerrointa
    }

    // -- Tolppalista matka-aikojen laskemiseksi --------------------------------
    const { data: tolppas, error: tolppaErr } = await supabase
      .from('tolppa_locations')
      .select('id, name, lat, lon, zone')

    if (tolppaErr) throw new Error(`Tolppa-haku epaonnistui: ${tolppaErr.message}`)

    // -- Delta-t jokaiselle tolpalle ------------------------------------------
    const travelMap: Map<number, number> = new Map()

    if (travel_minutes !== undefined) {
      // Kiintea matka-aika annettu -> kaikkien tolppien matka-aika on sama
      for (const tl of (tolppas ?? []) as TolppaRow[]) {
        travelMap.set(tl.id, travel_minutes)
      }
    } else {
      // Lasketaan Haversine + yritetaan OSRM vain jos use_osrm = true
      await Promise.all(
        ((tolppas ?? []) as TolppaRow[]).map(async (tl) => {
          let min = calcTravelMinutes(
            current_lat, current_lon, tl.lat, tl.lon, helsinkiHour,
          )

          if (use_osrm) {
            try {
              const osrmUrl =
                `https://router.project-osrm.org/route/v1/driving/` +
                `${current_lon},${current_lat};${tl.lon},${tl.lat}` +
                `?overview=false`
              const oResp = await fetch(osrmUrl, {
                signal: AbortSignal.timeout(3000),
              })
              if (oResp.ok) {
                const oData = await oResp.json()
                const osrmMin = (oData?.routes?.[0]?.duration ?? 0) / 60
                if (osrmMin > 0) {
                  const isRush =
                    (helsinkiHour >= 7 && helsinkiHour < 9) ||
                    (helsinkiHour >= 16 && helsinkiHour < 19)
                  min = isRush ? Math.max(osrmMin, min) : osrmMin
                }
              }
            } catch {
              // OSRM epaonnistui -> Haversine jo laskettu
            }
          }

          travelMap.set(tl.id, Math.ceil(min))
        }),
      )
    }

    // -- Mediaani matka-aika RPC-kutsuun (tolppakohtaiset pisteet lasketaan
    //    tietokannassa; per-tolppa-tieto rikastetaan alla) ---------------------
    const allMins = Array.from(travelMap.values())
    const sortedMins = [...allMins].sort((a, b) => a - b)
    const medianMin = sortedMins.length > 0
      ? sortedMins[Math.floor(sortedMins.length / 2)]
      : 15

    const FUEL_COST_EUR_H = 2.5

    // -- RPC-kutsu ------------------------------------------------------------
    const { data: targets, error: rpcErr } = await supabase.rpc(
      'get_eta_sniper_targets',
      {
        p_travel_minutes: medianMin,
        p_weather_mult:   weatherMult,
        p_fuel_cost_eur:  FUEL_COST_EUR_H,
      },
    )

    if (rpcErr) throw new Error(`RPC-kutsu epaonnistui: ${rpcErr.message}`)

    // -- Rikastetaan vastaus tolppakohtaisilla matka-ajoilla ------------------
    const enriched = ((targets ?? []) as RpcTarget[]).map((t) => ({
      ...t,
      travel_minutes: travelMap.get(t.tolppa_id) ?? medianMin,
      weather_mult:   weatherMult,
    }))

    return new Response(
      JSON.stringify({
        data: enriched,
        meta: {
          weather_mult: weatherMult,
          generated_at: new Date().toISOString(),
          source_lat:   current_lat,
          source_lon:   current_lon,
        },
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Tuntematon virhe'
    return new Response(
      JSON.stringify({ error: msg }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
