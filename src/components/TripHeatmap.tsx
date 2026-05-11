// =============================================================================
// src/components/TripHeatmap.tsx
// Helsinki Pulse | Kyytikysyntäheatmap (Recharts)
// Nakyyma: trip_heatmap (viikonpaiva x tunti x zona)
// =============================================================================

import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

// ----------------------------------------------------------------------------
// Tyypit
// ----------------------------------------------------------------------------
interface HeatmapRow {
  day_of_week: number
  hour_of_day: number
  pickup_zone: string
  trip_count:  number
  eur_per_hour: number
  rank_pct:    number
}

interface CellData {
  dow:  number
  hour: number
  value: number   // eur_per_hour aggregoituna kaikista zonoista
  count: number
}

// ----------------------------------------------------------------------------
// Paivien ja tuntien otsikot
// ----------------------------------------------------------------------------
const DOW_LABELS = ['Su', 'Ma', 'Ti', 'Ke', 'To', 'Pe', 'La']
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  i % 3 === 0 ? `${String(i).padStart(2, '0')}:00` : '',
)

// ----------------------------------------------------------------------------
// Varitoiminto: musta -> punainen -> kulta (taksiviiva)
// ----------------------------------------------------------------------------
function eurHToColor(value: number, max: number): string {
  if (max === 0 || value === 0) return '#1f2937'
  const ratio = Math.min(value / max, 1)
  if (ratio < 0.5) {
    // Musta -> tummanpunainen
    const r = Math.round(ratio * 2 * 180)
    return `rgb(${r}, 0, 0)`
  }
  // Tummanpunainen -> amber
  const t = (ratio - 0.5) * 2
  const r = Math.round(180 + t * 75)
  const g = Math.round(t * 159)
  return `rgb(${r}, ${g}, 0)`
}

// ----------------------------------------------------------------------------
// Hakufunktio
// ----------------------------------------------------------------------------
async function fetchHeatmap(): Promise<HeatmapRow[]> {
  const { data, error } = await (supabase as any)
    .from('trip_heatmap')
    .select('day_of_week, hour_of_day, pickup_zone, trip_count, eur_per_hour, rank_pct')
    .order('day_of_week')
    .order('hour_of_day')

  if (error) throw new Error(`Heatmap-haku epaonnistui: ${error.message}`)
  return (data as HeatmapRow[]) ?? []
}

// ----------------------------------------------------------------------------
// Paakorttikomponentti
// ----------------------------------------------------------------------------
export function TripHeatmap() {
  const { data: rows, isLoading, isError, error, refetch } = useQuery<HeatmapRow[], Error>({
    queryKey: ['tripHeatmap'],
    queryFn:  fetchHeatmap,
    staleTime: 10 * 60 * 1000,   // Heatmap pysyy tuoreena 10 min
    refetchInterval: 15 * 60 * 1000,
    retry: 2,
  })

  // Muodosta 7x24 -matriisi; aggregoi kaikki zonat yhteen soluun
  const matrix = useMemo<CellData[]>(() => {
    if (!rows || rows.length === 0) return []
    const map = new Map<string, CellData>()

    for (const row of rows) {
      const key = `${row.day_of_week}-${row.hour_of_day}`
      const existing = map.get(key)
      if (existing) {
        // Paino trip_count-painotettu keskiarvo
        const totalCount = existing.count + row.trip_count
        existing.value = totalCount > 0
          ? (existing.value * existing.count + row.eur_per_hour * row.trip_count) / totalCount
          : 0
        existing.count = totalCount
      } else {
        map.set(key, {
          dow:   row.day_of_week,
          hour:  row.hour_of_day,
          value: row.eur_per_hour,
          count: row.trip_count,
        })
      }
    }
    return Array.from(map.values())
  }, [rows])

  const maxValue = useMemo(
    () => Math.max(...matrix.map((c) => c.value), 1),
    [matrix],
  )

  const CELL_W = 28
  const CELL_H = 28
  const LABEL_W = 28
  const LABEL_H = 20

  return (
    <div
      className="rounded-md border border-gray-700 bg-gray-950 overflow-hidden"
      style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}
    >
      {/* Otsikkorivi */}
      <div className="flex items-center justify-between px-3 py-2
                      border-b border-gray-700 bg-gray-900">
        <span className="text-xs font-black tracking-widest text-white uppercase">
          KYYNTIHEATMAP
        </span>
        <button
          onClick={() => refetch()}
          className="text-xs text-blue-500 hover:text-blue-300 uppercase tracking-wide"
        >
          Paivita
        </button>
      </div>

      <div className="px-3 py-2 overflow-x-auto">
        {isLoading && (
          <div className="text-center py-8 text-gray-500 text-xs tracking-widest uppercase">
            Ladataan historiadataa...
          </div>
        )}

        {isError && (
          <div className="text-red-400 text-xs py-4 text-center">
            {error?.message ?? 'Virhe ladattaessa heatmapia'}
          </div>
        )}

        {!isLoading && !isError && matrix.length === 0 && (
          <div className="text-center py-6 text-gray-600 text-xs tracking-widest uppercase">
            Ei historiadataa -- aja ensin CSV-tuonti
          </div>
        )}

        {matrix.length > 0 && (
          <div>
            {/* Tuntiotsikot */}
            <div className="flex mb-1" style={{ paddingLeft: LABEL_W }}>
              {HOUR_LABELS.map((lbl, h) => (
                <div
                  key={h}
                  className="text-center text-gray-600 overflow-hidden"
                  style={{
                    fontSize: 8,
                    width: CELL_W,
                    minWidth: CELL_W,
                    lineHeight: `${LABEL_H}px`,
                  }}
                >
                  {lbl}
                </div>
              ))}
            </div>

            {/* Rivit */}
            {DOW_LABELS.map((dowLabel, dow) => (
              <div key={dow} className="flex items-center mb-0.5">
                {/* Paivalabel */}
                <div
                  className="text-gray-500 text-center shrink-0"
                  style={{ width: LABEL_W, fontSize: 10, fontWeight: 700 }}
                >
                  {dowLabel}
                </div>

                {/* Solut */}
                {Array.from({ length: 24 }, (_, hour) => {
                  const cell = matrix.find(
                    (c) => c.dow === dow && c.hour === hour,
                  )
                  const color = cell
                    ? eurHToColor(cell.value, maxValue)
                    : '#1f2937'
                  const tooltip = cell
                    ? `${cell.value.toFixed(0)} EUR/h (${cell.count} kyytiä)`
                    : 'Ei dataa'

                  return (
                    <div
                      key={hour}
                      title={tooltip}
                      style={{
                        width: CELL_W, height: CELL_H,
                        minWidth: CELL_W,
                        backgroundColor: color,
                        marginRight: 1,
                        borderRadius: 2,
                        cursor: cell ? 'pointer' : 'default',
                      }}
                    />
                  )
                })}
              </div>
            ))}

            {/* Legenda */}
            <div className="flex items-center gap-2 mt-3">
              <span className="text-gray-600 text-xs">0 EUR/h</span>
              <div
                className="h-2 rounded-sm"
                style={{
                  width: 120,
                  background: `linear-gradient(to right,
                    #1f2937, rgb(180,0,0), rgb(255,159,0))`,
                }}
              />
              <span className="text-amber-400 text-xs font-bold">
                {maxValue.toFixed(0)} EUR/h
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TripHeatmap
