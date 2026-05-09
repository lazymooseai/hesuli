// =============================================================================
// src/components/EtaSniperCard.tsx
// Helsinki Pulse | ETA-Sniper UI-kortti
// Estetiikka: industrial/utilitarian dark -- taktiinen operaatiopaanely
// =============================================================================

import React from 'react'
import { useEtaSniper, type UseEtaSniperOptions } from '@/hooks/useEtaSniper'
import {
  getVerdictBgClass,
  getVerdictBadgeClass,
  formatArrivalTime,
  formatEurH,
  formatRankProb,
  weatherMultLabel,
  type TolppaTarget,
  type Verdict,
} from '@/lib/etaSniper'

// ----------------------------------------------------------------------------
// Yksittainen kohderivi
// ----------------------------------------------------------------------------
interface TargetRowProps {
  target: TolppaTarget
  rank:   number
}

function TargetRow({ target, rank }: TargetRowProps) {
  const bgCls    = getVerdictBgClass(target.verdict as Verdict)
  const badgeCls = getVerdictBadgeClass(target.verdict as Verdict)

  return (
    <div
      className={`border-l-2 pl-3 pr-2 py-2.5 mb-2 rounded-r-sm ${bgCls}`}
      style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}
    >
      {/* Otsikkorivi */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-xs font-bold text-white tracking-widest uppercase">
          #{rank}&nbsp;&nbsp;{target.tolppa_name}
        </span>
        <span
          className={`text-xs font-black px-2 py-0.5 rounded-sm tracking-wider
                      shrink-0 ${badgeCls}`}
        >
          {target.verdict}
        </span>
      </div>

      {/* Tietorivilohko */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
        {/* Saapuminen */}
        <div className="text-gray-400">
          Saapuminen&nbsp;
          <span className="text-white font-semibold">
            ~{formatArrivalTime(target.arrival_time)}
          </span>
          <span className="text-gray-500 ml-1">
            ({target.travel_minutes}&nbsp;min)
          </span>
        </div>

        {/* Nettotuntiansio */}
        <div className="text-gray-400">
          Netto&nbsp;
          <span className="text-green-400 font-bold">
            {formatEurH(target.eur_h_net)}
          </span>
        </div>

        {/* Historia */}
        {target.trip_count_hist > 0 && (
          <div className="text-gray-500 col-span-2">
            Hist.&nbsp;{target.trip_count_hist}&nbsp;kyytiä&nbsp;|&nbsp;
            Tolppa&nbsp;
            <span className="text-amber-400 font-semibold">
              {formatRankProb(target.rank_prob)}
            </span>
            &nbsp;|&nbsp;Brutto&nbsp;
            <span className="text-gray-300">{formatEurH(target.eur_h_gross)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------
// Saakerroinhallitus
// ----------------------------------------------------------------------------
function WeatherBar({ mult }: { mult: number }) {
  if (mult <= 1.0) return null
  const colorCls =
    mult >= 1.4 ? 'bg-blue-700 text-blue-100'
    : mult >= 1.2 ? 'bg-blue-800 text-blue-200'
    : 'bg-gray-700 text-gray-300'
  return (
    <div
      className={`text-xs px-2 py-1 mb-2 rounded-sm ${colorCls}`}
      style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}
    >
      SAA x{mult.toFixed(1)}{' - '}{weatherMultLabel(mult)}
    </div>
  )
}

// ----------------------------------------------------------------------------
// Paakorttikomponentti
// ----------------------------------------------------------------------------
export interface EtaSniperCardProps extends UseEtaSniperOptions {
  className?: string
}

export function EtaSniperCard({
  currentLat,
  currentLon,
  travelMinutes,
  useOsrm,
  className = '',
}: EtaSniperCardProps) {
  const { data, isLoading, isError, error, dataUpdatedAt, refetch, isFetching } =
    useEtaSniper({ currentLat, currentLon, travelMinutes, useOsrm })

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('fi-FI', {
        hour: '2-digit', minute: '2-digit',
      })
    : null

  return (
    <div
      className={`rounded-md border border-gray-700 bg-gray-950 overflow-hidden
                  ${className}`}
      style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}
    >
      {/* Otsikkorivi */}
      <div
        className="flex items-center justify-between px-3 py-2
                   border-b border-gray-700 bg-gray-900"
      >
        <div className="flex items-center gap-2">
          {/* Vilkkuva indikaattoripiste */}
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full
              ${isFetching ? 'bg-amber-400 animate-pulse' : 'bg-green-500'}`}
          />
          <span className="text-xs font-black tracking-widest text-white uppercase">
            ETA-SNIPER
          </span>
        </div>

        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-xs text-gray-600">pv.&nbsp;{lastUpdate}</span>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-xs text-blue-500 hover:text-blue-300 disabled:opacity-40
                       transition-colors uppercase tracking-wide"
          >
            {isFetching ? 'Haetaan...' : 'Paivita'}
          </button>
        </div>
      </div>

      {/* Sisalto */}
      <div className="px-3 pt-2 pb-1">
        {/* Lataustila */}
        {isLoading && (
          <div className="text-center py-6 text-gray-500 text-xs tracking-widest uppercase">
            Lasketaan kohteita...
          </div>
        )}

        {/* Virhetila */}
        {isError && !isLoading && (
          <div className="py-3 text-xs border border-red-900 bg-red-950 rounded-sm px-3 mb-2">
            <div className="text-red-400 font-bold uppercase tracking-wider mb-1">
              Hakuvirhe
            </div>
            <div className="text-red-500 text-xs mb-2">
              {error?.message ?? 'Tuntematon virhe'}
            </div>
            <button
              onClick={() => refetch()}
              className="text-blue-400 underline text-xs uppercase tracking-wide"
            >
              Yrita uudelleen
            </button>
          </div>
        )}

        {/* Saakerroin */}
        {data?.meta.weather_mult !== undefined && (
          <WeatherBar mult={data.meta.weather_mult} />
        )}

        {/* Kohteet */}
        {data?.data && data.data.length > 0 && (
          <div>
            {data.data.map((target, i) => (
              <TargetRow key={target.tolppa_id} target={target} rank={i + 1} />
            ))}
          </div>
        )}

        {/* Ei dataa */}
        {data?.data && data.data.length === 0 && (
          <div className="text-center py-5 text-gray-600 text-xs tracking-widest uppercase">
            Ei historiadataa valitulle ajankohdalle
          </div>
        )}
      </div>
    </div>
  )
}

export default EtaSniperCard
