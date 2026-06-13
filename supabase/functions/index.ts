/**
 * hti-bridge
 *
 * Yhdistaa hesulin Hermes HTI -agenttiin. Palauttaa hesulin koko
 * tilannekuvan kompaktina JSON:na yhdella kutsulla:
 *
 *   GET/POST /functions/v1/hti-bridge
 *   -> { events, ships_note, generated_at, source }
 *
 * Sisalto:
 *   events: tulevat 24h tapahtumat tayttoasteineen (load_factor,
 *           sold_out, availability_note, demand_level, venue, ajat)
 *
 * Suunnitteluperiaate: VAIN LUKU. Bridge ei muuta mitaan - se on
 * turvallinen rajapinta jonka Hermes (tai mika tahansa muu asiakas)
 * voi pollata. Hesuli toimii taysin ilman tata, ja Hermes toimii
 * taysin ilman hesulia (bridge-kutsun epaonnistuminen -> tyhja).
 *
 * Autentikointi: Supabase anon key riittaa (RLS sallii lukemisen).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BridgeEvent {
  name: string;
  venue: string | null;
  area: string | null;
  start_time: string;
  end_time: string | null;
  capacity: number | null;
  load_factor: number | null;     // 0..1 lipunmyyntiaste
  tickets_sold: number | null;
  sold_out: boolean;
  availability_note: string | null;
  demand_level: string | null;    // red | amber | green
  source_url: string | null;
  last_scraped_at: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(SUPABASE_URL, ANON_KEY);

  const nowIso = new Date().toISOString();
  const dayOut = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

  // Tulevat 24h tapahtumat - tayttoastedata mukana
  const { data: events, error } = await supabase
    .from('events')
    .select(
      'name, venue, area, start_time, end_time, capacity, ' +
      'load_factor, tickets_sold, sold_out, availability_note, ' +
      'demand_level, source_url, last_scraped_at',
    )
    .gte('start_time', nowIso)
    .lte('start_time', dayOut)
    .order('start_time', { ascending: true })
    .limit(40);

  if (error) {
    console.error('[hti-bridge] events error:', error);
    return new Response(
      JSON.stringify({ error: error.message, events: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const payload = {
    generated_at: nowIso,
    source: 'hesuli',
    events: (events ?? []) as BridgeEvent[],
    // Laiva-/junadatan Hermes hakee suoraan omista lahteistaan
    // (Digitraffic, Averio) - ei duplikoida tassa.
    ships_note: 'Hermes hakee laivat suoraan Averiosta (hti.schedules)',
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
    },
  });
});
