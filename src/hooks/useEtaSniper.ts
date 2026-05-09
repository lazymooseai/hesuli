// =============================================================================
// src/hooks/useEtaSniper.ts
// Helsinki Pulse | ETA-Sniper React-hook (TanStack Query v5)
// =============================================================================
// Ennen kuin tama toimii: npm install @tanstack/react-query
// Kietaise sovelluksen juuri QueryClientProviderilla (ks. README.md).
// =============================================================================

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { EtaSniperResponse } from '@/lib/etaSniper'

// ----------------------------------------------------------------------------
// Parametrit
// ----------------------------------------------------------------------------
export interface UseEtaSniperOptions {
  /** Nykyinen GPS-leveys (haetaan useGeolocation-hookista) */
  currentLat?: number
  /** Nykyinen GPS-pituus */
  currentLon?: number
  /** Jos annettu, ohittaa Haversine-laskennan kaikille tolpille */
  travelMinutes?: number
  /** Yritetaanko OSRM-reititinta Haversine-fallbackin sijaan */
  useOsrm?: boolean
  /** Estetaanko haku (esim. kun GPS ei ole valmis) */
  enabled?: boolean
}

// ----------------------------------------------------------------------------
// Hakufunktio (kutsutaan React Queryn kautta)
// ----------------------------------------------------------------------------
async function fetchEtaSniper(
  opts: UseEtaSniperOptions,
): Promise<EtaSniperResponse> {
  const { data, error } = await supabase.functions.invoke<EtaSniperResponse>(
    'eta-sniper',
    {
      body: {
        current_lat:    opts.currentLat,
        current_lon:    opts.currentLon,
        travel_minutes: opts.travelMinutes,
        use_osrm:       opts.useOsrm ?? false,
      },
    },
  )

  if (error) {
    throw new Error(
      `ETA-Sniper Edge Function -virhe: ${error.message ?? 'tuntematon virhe'}`,
    )
  }
  if (!data) {
    throw new Error('ETA-Sniper palautti tyhjan vastauksen')
  }
  return data
}

// ----------------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------------
export function useEtaSniper(
  opts: UseEtaSniperOptions = {},
): UseQueryResult<EtaSniperResponse, Error> {
  const queryKey = [
    'etaSniper',
    opts.currentLat,
    opts.currentLon,
    opts.travelMinutes,
    opts.useOsrm,
  ] as const

  return useQuery<EtaSniperResponse, Error>({
    queryKey,
    queryFn: () => fetchEtaSniper(opts),

    // Paivita 3 minuutin valein -- sopiva ETA-tietojen paivitystahtiin
    refetchInterval: 3 * 60 * 1000,

    // Data on tuore 2 minuuttia ennen uudelleenhaun harkitsemista
    staleTime: 2 * 60 * 1000,

    // Yrita uudelleen 2 kertaa verkkohairioiden varalta
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),

    // Hae uusi data kun sovellusikkuna palaa etualalle
    refetchOnWindowFocus: true,

    // Hae myos kun verkko palautuu offline-tilasta
    refetchOnReconnect: true,

    // Estetaanko haku kunnes GPS-koordinaatit ovat saatavilla
    enabled:
      opts.enabled !== false &&
      (opts.currentLat === undefined || opts.currentLon === undefined
        ? true                          // Salli haku ilman koordinaatteja (oletuslokaatio)
        : true),
  })
}
