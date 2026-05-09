// =============================================================================
// src/lib/etaSniper.ts
// Helsinki Pulse | ETA-Sniper ydinkirjasto
// =============================================================================

// ----------------------------------------------------------------------------
// Tyypit
// ----------------------------------------------------------------------------
export type Verdict = 'OPTIMAALINEN' | 'KOHTALAINEN' | 'RISKI'

export interface TolppaTarget {
  tolppa_id:       number
  tolppa_name:     string
  lat:             number
  lon:             number
  zone:            string
  arrival_time:    string     // ISO 8601 timestamptz
  travel_minutes:  number
  trip_count_hist: number
  avg_fare_hist:   number
  eur_h_gross:     number
  eur_h_net:       number
  rank_prob:       number     // 0.0 - 1.0
  verdict:         Verdict
  weather_mult:    number     // 1.0 - 1.5
}

export interface EtaSniperMeta {
  weather_mult: number
  generated_at: string
  source_lat?:  number
  source_lon?:  number
}

export interface EtaSniperResponse {
  data: TolppaTarget[]
  meta: EtaSniperMeta
}

// ----------------------------------------------------------------------------
// Helsinki-nopeusvektorit (kaytetaan myos client-side previewing)
// ----------------------------------------------------------------------------
export const HELSINKI_SPEEDS: Array<{ fromH: number; toH: number; kmh: number }> = [
  { fromH: 0,  toH: 6,  kmh: 45 },
  { fromH: 6,  toH: 9,  kmh: 26 },
  { fromH: 9,  toH: 16, kmh: 36 },
  { fromH: 16, toH: 19, kmh: 20 },
  { fromH: 19, toH: 23, kmh: 33 },
  { fromH: 23, toH: 24, kmh: 46 },
]

export const TOPOLOGY_FACTOR = 1.35

export function getSpeedKmh(hour: number): number {
  const entry = HELSINKI_SPEEDS.find((s) => hour >= s.fromH && hour < s.toH)
  return entry?.kmh ?? 36
}

// Haversine-kaava linnuntie-etaisyydelle
export function haversineKm(
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

// Paikallinen Delta-t ilman verkkokutsua (offline-varmuus)
export function calcTravelMinutesLocal(
  fromLat: number, fromLon: number,
  toLat:   number, toLon:   number,
  hour?:   number,
): number {
  const h     = hour ?? new Date().getHours()
  const dist  = haversineKm(fromLat, fromLon, toLat, toLon) * TOPOLOGY_FACTOR
  const speed = getSpeedKmh(h)
  const min   = (dist / speed) * 60
  const isRush = (h >= 7 && h < 9) || (h >= 16 && h < 19)
  return Math.ceil(isRush ? Math.max(min, (dist / (speed * 0.85)) * 60) : min)
}

// ----------------------------------------------------------------------------
// UI-apufunktiot
// ----------------------------------------------------------------------------
export function getVerdictColor(verdict: Verdict): string {
  switch (verdict) {
    case 'OPTIMAALINEN': return '#22c55e'   // vihrea
    case 'KOHTALAINEN':  return '#f59e0b'   // amber
    case 'RISKI':        return '#ef4444'   // punainen
    default:             return '#6b7280'
  }
}

export function getVerdictBgClass(verdict: Verdict): string {
  switch (verdict) {
    case 'OPTIMAALINEN': return 'border-green-500 bg-green-950'
    case 'KOHTALAINEN':  return 'border-amber-500 bg-amber-950'
    case 'RISKI':        return 'border-red-500 bg-red-950'
    default:             return 'border-gray-600 bg-gray-900'
  }
}

export function getVerdictBadgeClass(verdict: Verdict): string {
  switch (verdict) {
    case 'OPTIMAALINEN': return 'bg-green-500 text-black'
    case 'KOHTALAINEN':  return 'bg-amber-500 text-black'
    case 'RISKI':        return 'bg-red-600 text-white'
    default:             return 'bg-gray-600 text-white'
  }
}

export function formatArrivalTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('fi-FI', {
    hour:   '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Helsinki',
  })
}

export function formatEurH(value: number): string {
  return `${value.toFixed(0)} EUR/h`
}

export function formatRankProb(value: number): string {
  return `${Math.round(value * 100)} %`
}

// Saakerroin selitystekstina
export function weatherMultLabel(mult: number): string {
  if (mult >= 1.5) return 'Rankka lumisade (+50 %)'
  if (mult >= 1.4) return 'Lumisade (+40 %)'
  if (mult >= 1.3) return 'Rankka sade (+30 %)'
  if (mult >= 1.2) return 'Sade (+20 %)'
  if (mult >= 1.1) return 'Pilvinen/tuulinen (+10 %)'
  return 'Normaali saa'
}
