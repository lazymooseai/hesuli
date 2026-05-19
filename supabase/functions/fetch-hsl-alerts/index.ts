/**
 * fetch-hsl-alerts/index.ts
 *
 * HSL liikennehairiohaku. Kayttaa HSL:n julkista GTFS-Realtime
 * service-alerts protobuf-feedia (ei vaadi subscription-keyta toisin kuin
 * Digitransit GraphQL).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import GtfsRealtimeBindings from "npm:gtfs-realtime-bindings@1.1.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ParsedAlert {
  id: string;
  alertHeaderText: string;
  alertDescriptionText: string;
  alertSeverityLevel: string;
  effectiveStartDate: number;
  effectiveEndDate: number;
}

function pickTranslation(t: any): string {
  if (!t?.translation?.length) return "";
  const fi = t.translation.find((x: any) => x.language === "fi");
  const en = t.translation.find((x: any) => x.language === "en");
  return (fi ?? en ?? t.translation[0])?.text ?? "";
}

const SEVERITY_MAP: Record<number, string> = {
  1: "UNKNOWN_SEVERITY",
  2: "INFO",
  3: "WARNING",
  4: "SEVERE",
};

async function fetchHslGtfsAlerts(): Promise<ParsedAlert[]> {
  const res = await fetch(
    "https://realtime.hsl.fi/realtime/service-alerts/v2/hsl",
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(`HSL GTFS-RT error: ${res.status}`);

  const buf = new Uint8Array(await res.arrayBuffer());
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buf);

  const out: ParsedAlert[] = [];
  for (let i = 0; i < (feed.entity?.length ?? 0); i++) {
    const e: any = feed.entity[i];
    const a = e.alert;
    if (!a) continue;

    const header = pickTranslation(a.headerText);
    const desc = pickTranslation(a.descriptionText);
    if (!header && !desc) continue;

    const period = a.activePeriod?.[0];
    const start = Number(period?.start ?? 0);
    const end = Number(period?.end ?? 0);

    out.push({
      id: e.id || `hsl-${i}`,
      alertHeaderText: header || "HSL-hairio",
      alertDescriptionText: desc,
      alertSeverityLevel: SEVERITY_MAP[a.severityLevel ?? 0] || "WARNING",
      effectiveStartDate: start,
      effectiveEndDate: end,
    });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let alerts: ParsedAlert[] = [];
    try {
      alerts = await fetchHslGtfsAlerts();
      console.log(`HSL GTFS-RT: ${alerts.length} hairioita`);
    } catch (e) {
      console.warn("HSL GTFS-RT epaonnistui:", e instanceof Error ? e.message : e);
    }

    const now = Math.floor(Date.now() / 1000);
    const activeAlerts = alerts.filter(
      (a) => !a.effectiveEndDate || a.effectiveEndDate > now
    );

    return new Response(
      JSON.stringify({
        alerts: activeAlerts,
        source: "hsl-gtfs-rt",
        count: activeAlerts.length,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("HSL alerts proxy error:", err);
    return new Response(
      JSON.stringify({
        alerts: [],
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
