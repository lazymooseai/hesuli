import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function haversineKm(lat1, lon1, lat2, lon2) {
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

function getSpeedKmh(hour) {
  if (hour < 6)  return 45
  if (hour < 9)  return 26
  if (hour < 16) return 36
  if (hour < 19) return 20
  if (hour < 23) return 33
  return 46
}

function calcTravelMinutes(fromLat, fromLon, toLat, toLon, hour) {
  const dist = haversineKm(fromLat, fromLon, toLat, toLon) * 1.35
  const speed = getSpeedKmh(hour)
  const min = (dist / speed) * 60
  const isRush = (hour >= 7 && hour < 9) || (hour >= 16 && hour < 19)
  return Math.ceil(isRush ? Math.max(min, (dist / (speed * 0.85)) * 60) : min)
}

function calcWeatherMult(weatherCode, windSpeed, precipitation) {
  if (precipitation >= 10 || weatherCode >= 85) return 1.5
  if (precipitation >= 5  || weatherCode >= 71) return 1.4
  if (precipitation >= 2.5 || weatherCode >= 51) return 1.3
  if (precipitation >= 0.5 || weatherCode >= 45) return 1.2
  if (weatherCode >= 1    || windSpeed > 10)    return 1.1
  return 1.0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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
      use_osrm = false,
    } = body

    const helsinkiHour = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Europe/Helsinki' }),
    ).getHours()

    let weatherMult = 1.0
    try {
      const wResp = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${current_lat}&longitude=${current_lon}&current=weather_code,wind_speed_10m,precipitation&timezone=Europe%2FHelsinki`,
        { signal: AbortSignal.timeout(4000) },
      )
      if (wResp.ok) {
        const wData = await wResp.json()
        const c = wData?.current ?? {}
        weatherMult = calcWeatherMult(
          c.weather_code ?? 0,
          c.wind_speed_10m ?? 0,
          c.precipitation ?? 0,
        )
      }
    } catch (_) {}

    const { data: tolppas, error: tolppaErr } = await supabase
      .from('tolppa_locations')
      .select('id, name, lat, lon, zone')

    if (tolppaErr) throw new Error(`Tolppa-haku epaonnistui: ${tolppaErr.message}`)

    const travelMap = new Map()

    for (const tl of (tolppas ?? [])) {
      const min = travel_minutes !== undefined
        ? travel_minutes
        : calcTravelMinutes(current_lat, current_lon, tl.lat, tl.lon, helsinkiHour)
      travelMap.set(tl.id, Math.ceil(min))
    }

    const allMins = Array.from(travelMap.values())
    const sorted = [...allMins].sort((a, b) => a - b)
    const medianMin = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 15

    const FUEL_COST = 2.5

    const { data: targets, error: rpcErr } = await supabase.rpc(
      'get_eta_sniper_targets',
      {
        p_travel_minutes: medianMin,
        p_weather_mult: weatherMult,
        p_fuel_cost_eur: FUEL_COST,
      },
    )

    if (rpcErr) throw new Error(`RPC-kutsu epaonnistui: ${rpcErr.message}`)

    const enriched = (targets ?? []).map((t) => ({
      ...t,
      travel_minutes: travelMap.get(t.tolppa_id) ?? medianMin,
      weather_mult: weatherMult,
    }))

    return new Response(
      JSON.stringify({
        data: enriched,
        meta: {
          weather_mult: weatherMult,
          generated_at: new Date().toISOString(),
          source_lat: current_lat,
          source_lon: current_lon,
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
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
