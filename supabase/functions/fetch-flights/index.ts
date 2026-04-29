/**
 * fetch-flights
 *
 * Hakee Helsinki-Vantaan (HEL) saapuvat lennot Finavian virallisesta APIsta.
 * Vaatii FINAVIA_API_KEY-secretin (header: app_key).
 *
 * Suodattaa: vain seuraavat 2 tuntia, ei peruttuja eika laskeutuneita.
 * Cache: 60s muistissa.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FINAVIA_URL = "https://apigw.finavia.fi/flights/public/v0/flights/arr/HEL";
const WINDOW_MS = 2 * 60 * 60 * 1000;
const HELSINKI_TIMEZONE = "Europe/Helsinki";
const CACHE_TTL_MS = 60 * 1000;

let cache: { data: unknown; expires: number } | null = null;

interface FlightOut {
  id: string;
  flightNumber: string;
  airline: string;
  origin: string;
  originCode: string;
  scheduledTime: string;
  estimatedTime: string;
  delayMinutes: number;
  terminal?: string;
  gate?: string;
  belt?: string;
  status: string;
  demandTag: string;
  demandLevel: "red" | "amber" | "green";
}

const LONG_HAUL_CITIES = new Set([
  "new york", "newark", "jfk", "ewr", "los angeles", "lax", "chicago", "ord",
  "miami", "mia", "dallas", "dfw", "atlanta", "atl", "boston", "bos",
  "san francisco", "sfo", "toronto", "yyz", "montreal", "yul",
  "tokyo", "tokio", "hnd", "nrt", "osaka", "kix", "seoul", "soul", "icn",
  "beijing", "peking", "pek", "shanghai", "pvg", "hong kong", "hkg",
  "bangkok", "bkk", "singapore", "sin", "delhi", "del", "mumbai", "bom",
  "dubai", "dxb", "doha", "doh", "abu dhabi", "auh", "riyadh", "ruh",
  "tel aviv", "tlv", "johannesburg", "jnb", "cairo", "cai",
  "sao paulo", "gru", "buenos aires", "eze",
  "sydney", "syd", "melbourne", "mel", "auckland", "akl",
]);

const MAJOR_EU_HUBS = new Set([
  "london", "lontoo", "lhr", "lgw", "stn", "paris", "pariisi", "cdg", "ory",
  "frankfurt", "fra", "amsterdam", "ams", "madrid", "mad", "rome", "rooma", "fco",
  "munich", "münchen", "muc", "zurich", "zürich", "zrh", "vienna", "wien", "vie",
  "copenhagen", "kööpenhamina", "cph", "stockholm", "tukholma", "arn",
  "oslo", "osl", "brussels", "bryssel", "bru", "dublin", "dub",
  "warsaw", "varsova", "waw", "istanbul", "ist",
]);

function classifyDemand(
  originLower: string,
  delayMin: number,
  hour: number,
): { tag: string; level: "red" | "amber" | "green" } {
  const isLong = [...LONG_HAUL_CITIES].some((c) => originLower.includes(c));
  if (isLong) return { tag: "KAUKOLENTO", level: "red" };
  if (delayMin >= 30) return { tag: `VIIVE +${delayMin}min`, level: "red" };
  const isHub = [...MAJOR_EU_HUBS].some((c) => originLower.includes(c));
  if (isHub && (hour >= 16 || hour <= 9)) return { tag: "RUSH HUB", level: "red" };
  if (isHub) return { tag: "EU-HUB", level: "amber" };
  if (delayMin >= 10) return { tag: `+${delayMin} min`, level: "amber" };
  return { tag: "AIKATAULUSSA", level: "green" };
}

function getHelsinkiHour(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: HELSINKI_TIMEZONE, hour: "2-digit", hour12: false,
  }).formatToParts(date);
  return Number(parts.find((p) => p.type === "hour")?.value ?? "0");
}

function fmtTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: HELSINKI_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h}:${m}`;
}

/** Parsi yksinkertainen XML => taulukko flight-objekteja. */
function parseFinaviaXml(xml: string): Record<string, string>[] {
  const flights: Record<string, string>[] = [];
  const flightRegex = /<flight\b[^>]*>([\s\S]*?)<\/flight>/gi;
  let match;
  while ((match = flightRegex.exec(xml)) !== null) {
    const inner = match[1];
    const obj: Record<string, string> = {};
    const fieldRe = /<([a-zA-Z0-9_]+)>([\s\S]*?)<\/\1>/g;
    let f;
    while ((f = fieldRe.exec(inner)) !== null) {
      obj[f[1].toLowerCase()] = f[2].trim();
    }
    flights.push(obj);
  }
  return flights;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("FINAVIA_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          flights: [],
          count: 0,
          source: "Finavia",
          error: "FINAVIA_API_KEY puuttuu",
          timestamp: new Date().toISOString(),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (cache && cache.expires > Date.now()) {
      return new Response(JSON.stringify(cache.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "HIT" },
      });
    }

    const r = await fetch(FINAVIA_URL, {
      headers: {
        "app_key": apiKey,
        "Accept": "application/xml",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!r.ok) {
      const body = await r.text();
      console.error(`Finavia ${r.status}:`, body.slice(0, 300));
      return new Response(
        JSON.stringify({
          flights: [],
          count: 0,
          source: "Finavia",
          error: `Finavia palautti ${r.status}`,
          timestamp: new Date().toISOString(),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const xml = await r.text();
    const raw = parseFinaviaXml(xml);
    console.log(`Finavia: ${raw.length} flightia XMLssa`);

    const now = new Date();
    const cutoff = now.getTime() + WINDOW_MS;
    const flights: FlightOut[] = [];

    const RECENT_LANDED_MS = 30 * 60 * 1000; // näytä viim. 30 min laskeutuneet
    for (const f of raw) {
      const status = (f.prm ?? "").toUpperCase();
      const statusFi = (f.prt_f ?? "").toLowerCase();
      if (status === "CXX" || statusFi.includes("peruttu")) continue;

      const isLanded = status === "LAN" || statusFi.includes("laskeutunut");

      // Ajat: sdt = scheduled, est_d / pest_d = estimated, act_d = actual
      const scheduledIso = f.sdt;
      const estimatedIso = f.act_d || f.est_d || f.pest_d || f.sdt;
      if (!scheduledIso) continue;

      const schedDate = new Date(scheduledIso);
      const estDate = new Date(estimatedIso);
      if (isNaN(schedDate.getTime()) || isNaN(estDate.getTime())) continue;

      const arrivalMs = estDate.getTime();
      // Aikaikkuna: laskeutuneet 30 min taakse, muut 5 min taakse → 2 h eteen
      const minMs = isLanded
        ? now.getTime() - RECENT_LANDED_MS
        : now.getTime() - 5 * 60 * 1000;
      if (arrivalMs < minMs) continue;
      if (arrivalMs > cutoff) continue;

      const delay = Math.round((estDate.getTime() - schedDate.getTime()) / 60000);
      const hour = getHelsinkiHour(estDate);

      const originCode = (f.route_1 ?? "").toUpperCase();
      const originName = f.route_n_fi_1 || f.route_1 || "Tuntematon";
      const originLower = `${originName} ${originCode}`.toLowerCase();
      const { tag, level } = classifyDemand(originLower, Math.max(0, delay), hour);

      const flightNumber = (f.fltnr ?? "").toUpperCase();

      flights.push({
        id: `${flightNumber}-${scheduledIso}`,
        flightNumber,
        airline: flightNumber.slice(0, 2),
        origin: originName,
        originCode,
        scheduledTime: fmtTime(scheduledIso),
        estimatedTime: fmtTime(estimatedIso),
        delayMinutes: Math.max(0, delay),
        terminal: f.termid || undefined,
        gate: f.gate || undefined,
        belt: f.bltarea || undefined,
        status: f.prt_f || f.prm || "",
        demandTag: isLanded ? "LASKEUTUNUT" : tag,
        demandLevel: isLanded ? "amber" : level,
      });
    }

    // Jarjesta: tulevat ensin (ajan mukaan), sitten juuri laskeutuneet (uusin ensin)
    flights.sort((a, b) => {
      const aLanded = a.demandTag === "LASKEUTUNUT";
      const bLanded = b.demandTag === "LASKEUTUNUT";
      if (aLanded !== bLanded) return aLanded ? 1 : -1;
      if (aLanded && bLanded) return b.estimatedTime.localeCompare(a.estimatedTime);
      if (a.demandLevel === "red" && b.demandLevel !== "red") return -1;
      if (b.demandLevel === "red" && a.demandLevel !== "red") return 1;
      return a.estimatedTime.localeCompare(b.estimatedTime);
    });

    const payload = {
      flights,
      count: flights.length,
      source: "Finavia",
      timestamp: new Date().toISOString(),
    };

    cache = { data: payload, expires: Date.now() + CACHE_TTL_MS };

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "MISS" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("fetch-flights virhe:", msg);
    return new Response(JSON.stringify({
      flights: [], count: 0, source: "Finavia", error: msg,
      timestamp: new Date().toISOString(),
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
