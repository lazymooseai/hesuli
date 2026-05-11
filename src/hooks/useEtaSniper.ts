// =============================================================================
// src/hooks/useEtaSniper.ts  v3
// radiusKm-parametri lisatty GPS-sadesuodatusta varten
// =============================================================================

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { EtaSniperResponse } from '@/lib/etaSniper'

export interface UseEtaSniperOptions {
  currentLat?:    number
  currentLon?:    number
  travelMinutes?: number
  useOsrm?:       boolean
  radiusKm?:      number   // Haku-sade km, oletus 10
  enabled?:       boolean
}

async function fetchEtaSniper(opts: UseEtaSniperOptions): Promise<EtaSniperResponse> {
  const { data, error } = await supabase.functions.invoke<EtaSniperResponse>(
    'eta-sniper',
    {
      body: {
        current_lat:    opts.currentLat,
        current_lon:    opts.currentLon,
        travel_minutes: opts.travelMinutes,
        use_osrm:       opts.useOsrm ?? false,
        radius_km:      opts.radiusKm ?? 10,
      },
    },
  )
  if (error) throw new Error(`ETA-Sniper Edge Function -virhe: ${error.message ?? 'tuntematon virhe'}`)
  if (!data)  throw new Error('ETA-Sniper palautti tyhjan vastauksen')
  return data
}

export function useEtaSniper(
  opts: UseEtaSniperOptions = {},
): UseQueryResult<EtaSniperResponse, Error> {
  return useQuery<EtaSniperResponse, Error>({
    queryKey:            ['etaSniper', opts.currentLat, opts.currentLon, opts.radiusKm],
    queryFn:             () => fetchEtaSniper(opts),
    refetchInterval:     3 * 60 * 1000,
    staleTime:           2 * 60 * 1000,
    retry:               2,
    retryDelay:          (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    refetchOnWindowFocus: true,
    refetchOnReconnect:  true,
    enabled:             opts.enabled !== false,
  })
}
