/**
 * fetch-train-bulletins/index.ts
 *
 * Proxy Fintrafficin passenger-information/active -endpointille.
 * Palauttaa aktiiviset junatiedotteet (suomeksi) suodatettuna
 * vain niihin, jotka koskevat Helsinkiin saapuvia junia.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Bulletin {
  id: string;
  trainNumber?: number;
  trainDepartureDate?: string;
  stations?: string[];
  startValidity?: string;
  endValidity?: string;
  video?: { text?: { fi?: string; en?: string } };
  audio?: { text?: { fi?: string } };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const res = await fetch(
      "https://rata.digitraffic.fi/api/v1/passenger-information/active",
      {
        headers: {
          "Digitraffic-User": "HelsinkiTaxiPulse/1.0",
          "Accept-Encoding": "gzip",
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) throw new Error(`Fintraffic ${res.status}`);
    const all: Bulletin[] = await res.json();

    const now = Date.now();
    const items = all
      .filter((b) => {
        // Voimassa nyt
        if (b.startValidity && new Date(b.startValidity).getTime() > now) return false;
        if (b.endValidity && new Date(b.endValidity).getTime() < now) return false;
        // Koskettaa Helsinkiä (HKI/PSL/TKL) tai pääradan/itäradan asemia
        const st = b.stations ?? [];
        return st.some((s) =>
          ["HKI", "PSL", "TKL", "KE", "JP", "RI", "HL", "TPE", "LH", "KV"].includes(s)
        );
      })
      .map((b) => ({
        id: b.id,
        trainNumber: b.trainNumber,
        stations: b.stations ?? [],
        text:
          b.video?.text?.fi ||
          b.audio?.text?.fi ||
          b.video?.text?.en ||
          "",
        endValidity: b.endValidity,
      }))
      .filter((b) => b.text.length > 0);

    // Deduplikoi sama teksti (VR julkaisee usein saman tiedotteen jokaiselle
    // junalle erikseen). Pidetään tekstistä yksi rivi ja kerätään junanumerot.
    const byText = new Map<string, { id: string; trainNumber?: number; stations: string[]; text: string; endValidity?: string; trainNumbers: number[] }>();
    for (const it of items) {
      const ex = byText.get(it.text);
      if (ex) {
        if (it.trainNumber) ex.trainNumbers.push(it.trainNumber);
      } else {
        byText.set(it.text, { ...it, trainNumbers: it.trainNumber ? [it.trainNumber] : [] });
      }
    }
    const deduped = Array.from(byText.values()).slice(0, 10).map((b) => ({
      id: b.id,
      trainNumber: b.trainNumbers.length === 1 ? b.trainNumbers[0] : undefined,
      trainNumbers: b.trainNumbers,
      stations: b.stations,
      text: b.text,
      endValidity: b.endValidity,
    }));

    return new Response(
      JSON.stringify({ bulletins: deduped, count: deduped.length, timestamp: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("train-bulletins error:", err);
    return new Response(
      JSON.stringify({ bulletins: [], error: err instanceof Error ? err.message : String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});