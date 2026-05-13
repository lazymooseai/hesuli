/**
 * linkedEvents.ts
 *
 * Hakee Helsingin julkiset tapahtumat suoraan LinkedEvents APIsta
 * (api.hel.fi). Tama korvaa puuttuvan scrape-events-pipelinen niin etta
 * Sapina-valilehti nayttaa kulttuuri-, muut- ja urheilutapahtumat heti.
 *
 * Suodatetaan ammatillisen kokoluokan tapahtumat:
 * - viikonloppukurssit / "kirjastojumpat" pois
 * - vain ne joissa on selkea start_time tanaan tai 7 paivan ikkunassa
 * - duplikaatit (recurring sub_events) ohitetaan paatason avulla
 */

import { EventInfo } from "./types";
import { isLowTaxiDemandEvent } from "./eventDemandFilters";
import { supabase } from "@/integrations/supabase/client";

interface LinkedLocation {
  name?: { fi?: string; sv?: string; en?: string };
  street_address?: { fi?: string };
}

interface LinkedKeyword {
  id?: string;
  "@id"?: string;
  name?: { fi?: string; en?: string };
}

interface LinkedEvent {
  id: string;
  name?: { fi?: string; sv?: string; en?: string };
  short_description?: { fi?: string };
  start_time?: string;
  end_time?: string;
  location?: LinkedLocation;
  keywords?: LinkedKeyword[];
  super_event?: unknown;
  super_event_type?: string | null;
  maximum_attendee_capacity?: number;
  info_url?: { fi?: string };
}

interface LinkedResponse {
  data: LinkedEvent[];
}

const VENUE_CAPACITY: Record<string, number> = {
  "kansallisooppera": 1350,
  "suomen kansallisooppera": 1350,
  "ooppera": 1350,
  "musiikkitalo": 1700,
  "helsingin kaupunginteatteri": 1120,
  "suuri näyttämö": 1120,
  "studio pasila": 320,
  "arena-näyttämö": 500,
  "kansallisteatteri": 880,
  "tanssin talo": 700,
  "savoy": 700,
  "tavastia": 700,
  "g livelab": 250,
  "kulttuuritalo": 1500,
  "messukeskus": 12000,
  "helsinki halli": 15500,
  "veikkaus arena": 15500,
  "olympiastadion": 36000,
  "bolt arena": 10770,
  "nordis": 16000,
  "helsingin jäähalli": 8200,
  "urheilun ja liikunnan kulttuurikeskus": 1000,
  "kaisaniemi": 5000,
};

const TARGET_TEXT_QUERIES = [
  "Helsingin Kaupunginteatteri",
  "Arena-näyttämö",
  "Hildur",
  "Suomen kansallisooppera",
  "Suomen kansallisooppera ja -baletti",
  "Kansallisooppera",
  "Ooppera",
  "Musiikkitalo",
  "Helsingin Jäähalli",
  "G Livelab",
  "G Live Lab",
  "On the Rocks",
];

const KEYWORD_QUERY = [
  "yso:p360",   // kulttuuritapahtumat
  "yso:p1808",  // konsertit
  "yso:p13084", // teatteri
  "yso:p11185", // ooppera
  "yso:p2625",  // musiikki
  "yso:p20421", // festivaalit
  "yso:p965",   // urheilu
  "yso:p916",   // jääkiekko
  "yso:p6915",  // jalkapallo
].join(",");

function pickName(t?: { fi?: string; sv?: string; en?: string }): string {
  return t?.fi || t?.sv || t?.en || "";
}

function venueName(loc?: LinkedLocation): string {
  return pickName(loc?.name) || pickName(loc?.street_address as { fi?: string }) || "Helsinki";
}

function venueCapacity(venue: string): number | undefined {
  const v = venue.toLowerCase();
  for (const [key, cap] of Object.entries(VENUE_CAPACITY)) {
    if (v.includes(key)) return cap;
  }
  return undefined;
}

/** Heuristiikka: suodata pieni hyvinvointi/lasten/yhdistystoiminta pois */
const NOISE_PATTERNS = [
  /jumppaa?\b/i,
  /kirjasto/i,
  /leikkipuisto/i,
  /perhekerho/i,
  /vauva/i,
  /lukupiiri/i,
  /käsityö/i,
  /askartelu/i,
  /senior/i,
  /ikäänty/i,
  /eläkeläi/i,
  /opasta(va|us)/i,
  /palvelukeskus/i,
  /kerho\b/i,
  /neuvonta/i,
  /klinikka/i,
  /digiopastus/i,
  /ilmaispäivä/i,
  /päättynyt/i,
  // Pienet museonäyttelyt joilla ei ole taksikysyntää (vaikka venue isolta kuulostaa)
  /tahdon tarina/i,
  /urheilumuseo/i,
  /näyttely/i,
  /nayttely/i,
];

const IMPORTANT_PATTERNS = [
  /helsingin kaupunginteatteri/i,
  /\bhkt\b/i,
  /suuri näyttämö/i,
  /suomen kansallisooppera/i,
  /suomen kansallisooppera ja -baletti/i,
  /kansallisooppera/i,
  /\booppera\b/i,
  /musiikkitalo/i,
  /g livelab/i,
  /on the rocks/i,
  /tavastia/i,
  /kulttuuritalo/i,
  /bolt arena/i,
  /olympiastadion/i,
  /helsingin jäähalli/i,
];

function isImportantVenue(name: string, venue: string): boolean {
  const txt = `${name} ${venue}`;
  return IMPORTANT_PATTERNS.some((re) => re.test(txt));
}

function isNoise(name: string, venue: string): boolean {
  const txt = `${name} ${venue}`;
  // Hard block: nama suodatetaan AINA pois, vaikka venue olisi "tarkea"
  if (isLowTaxiDemandEvent(name, venue)) return true;
  if (isImportantVenue(name, venue)) return false;
  return NOISE_PATTERNS.some((re) => re.test(txt));
}

/**
 * Pisteyta tapahtuma kuljettajan kannalta (kysyntalogiikka).
 * Suuri venue + nimessa konsertti/show -> red.
 */
function classify(name: string, venue: string, capacity?: number): {
  level: "red" | "amber" | "green";
  tag: string;
} {
  const nameLower = name.toLowerCase();
  const isMajorShow = /konsertti|festival|festivaali|tour|kiertue|show|live|musikaali|ooppera|opera|baletti/i.test(
    nameLower,
  );
  if (capacity && capacity >= 5000) return { level: "red", tag: "ISO TAPAHTUMA" };
  if (capacity && capacity >= 1500 && isMajorShow) return { level: "red", tag: "KONSERTTI" };
  if (isMajorShow) return { level: "amber", tag: "PREMIUM" };
  if (capacity && capacity >= 800) return { level: "amber", tag: "TEATTERI" };
  return { level: "green", tag: "TAPAHTUMA" };
}

function fmtTime(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function dateAtSameLocalClock(iso: string, date: Date): string {
  const src = new Date(iso);
  const d = new Date(date);
  d.setHours(src.getHours(), src.getMinutes(), 0, 0);
  return d.toISOString();
}

function todayAtSameLocalClock(iso: string, now: Date): string {
  return dateAtSameLocalClock(iso, now);
}

function endsInMinutes(endIso?: string, startIso?: string): number {
  if (endIso) {
    return Math.max(0, Math.round((new Date(endIso).getTime() - Date.now()) / 60000));
  }
  if (startIso) {
    return Math.max(0, Math.round((new Date(startIso).getTime() + 2.5 * 3600_000 - Date.now()) / 60000));
  }
  return 0;
}

async function fetchLinkedPage(params: URLSearchParams): Promise<LinkedEvent[]> {
  try {
    const res = await fetch(`https://api.hel.fi/linkedevents/v1/event/?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.warn("LinkedEvents haku epaonnistui:", res.status);
      return [];
    }
    const json = (await res.json()) as LinkedResponse;
    return json.data ?? [];
  } catch (err) {
    console.warn("LinkedEvents pyynto epaonnistui:", err);
    return [];
  }
}

async function fetchLinkedEventsViaProxy(requests: URLSearchParams[]): Promise<LinkedEvent[]> {
  const queries = requests.map((params) => Object.fromEntries(params.entries()));
  const { data, error } = await supabase.functions.invoke("fetch-linked-events", {
    body: { queries },
  });

  if (error) throw error;
  const events = (data as { data?: LinkedEvent[] } | null)?.data;
  return Array.isArray(events) ? events : [];
}

const CACHE_KEY = "linkedEventsCache.v2";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

function readCache(): EventInfo[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw) as { ts: number; data: EventInfo[] };
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(data: EventInfo[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch { /* ignore quota */ }
}

/**
 * Hae LinkedEvents-tapahtumat (kulttuuri + muut). Aikaikkuna: nyt - 7 pv eteen.
 * Suodattaa duplikaatit (super_event_type=recurring) ja "kohinan" (kirjastojumpat).
 */
export async function fetchLinkedEvents(): Promise<EventInfo[]> {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const startMin = new Date(now.getTime() - 30 * 60_000); // -30 min: jo alkaneet kayvat aikajanalla
  const end = new Date(now);
  end.setDate(end.getDate() + 7);
  end.setHours(23, 59, 59, 999);

  const baseParams = {
    start: todayStart.toISOString(),
    end: end.toISOString(),
    include: "location,keywords",
    page_size: "60",
    language: "fi",
    sort: "start_time",
  };

  const requests = [
    new URLSearchParams({ ...baseParams, keyword: KEYWORD_QUERY, page_size: "100" }),
    ...TARGET_TEXT_QUERIES.map((text) => new URLSearchParams({ ...baseParams, text })),
  ];
  const raw: LinkedEvent[] = await fetchLinkedEventsViaProxy(requests).catch(async (err) => {
    if (!(err instanceof Error && /aborted|abort/i.test(err.message))) {
      console.warn("LinkedEvents proxy epaonnistui, kokeillaan suoraa hakua:", err);
    }
    const settled = await Promise.allSettled(requests.slice(0, 4).map(fetchLinkedPage));
    return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  });
  if (raw.length === 0) {
    const cached = readCache();
    if (cached && cached.length > 0) {
      console.warn("LinkedEvents tyhja -> kaytetaan valimuistia", cached.length);
      return cached;
    }
  }

  const seenTitles = new Set<string>();
  const out: EventInfo[] = [];

  for (const ev of raw) {
    if (!ev.start_time) continue;
    if (ev.super_event_type === "recurring") continue; // skipataan paataso, alalevelit tulevat omina
    const startMs = new Date(ev.start_time).getTime();
    const endMs = ev.end_time ? new Date(ev.end_time).getTime() : startMs + 2.5 * 3600_000;
    if (startMs > end.getTime()) continue;

    const name = pickName(ev.name).trim();
    if (!name) continue;
    const venue = venueName(ev.location).trim();

    const isLongRunningImportant = endMs >= todayStart.getTime() && isImportantVenue(name, venue);
    if (startMs < startMin.getTime() && !isLongRunningImportant) continue;

    if (isNoise(name, venue)) continue;

    const startDay = new Date(startMs);
    startDay.setHours(0, 0, 0, 0);
    const isMultiDayImportant = endMs - startMs > 8 * 3600_000 && isImportantVenue(name, venue);
    const isTodayStartedEarlier = startMs < todayStart.getTime() && endMs >= todayStart.getTime();
    const displayStartIso = isTodayStartedEarlier
      ? todayAtSameLocalClock(ev.start_time, now)
      : ev.start_time;

    const displayEndIso = (() => {
      if (!ev.end_time) return ev.end_time;
      if (isTodayStartedEarlier || isMultiDayImportant) {
        return dateAtSameLocalClock(ev.end_time, new Date(displayStartIso || ev.start_time));
      }
      return ev.end_time;
    })();

    // Dedupe: sama nimi + alkamispaiva
    const dayKey = new Date(displayStartIso || ev.start_time).toISOString().slice(0, 10);
    const key = `${name.toLowerCase()}|${dayKey}|${venue.toLowerCase()}`;
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);

    const capacity = ev.maximum_attendee_capacity && ev.maximum_attendee_capacity > 0
      ? ev.maximum_attendee_capacity
      : venueCapacity(venue);

    const { level, tag } = classify(name, venue, capacity);

    out.push({
      id: ev.id,
      name,
      venue,
      endsIn: endsInMinutes(ev.end_time, ev.start_time),
      soldOut: false,
      demandTag: tag,
      demandLevel: level,
      startTime: fmtTime(displayStartIso || ev.start_time),
      startIso: displayStartIso || ev.start_time,
      endTime: fmtTime(displayEndIso),
      endIso: displayEndIso || undefined,
      capacity,
      availabilityNote: pickName(ev.short_description as { fi?: string }) || undefined,
      infoUrl: ev.info_url?.fi || undefined,
    });
  }

  // Lajittelu: red ensin, sitten alkuaika
  out.sort((a, b) => {
    if (a.demandLevel === "red" && b.demandLevel !== "red") return -1;
    if (b.demandLevel === "red" && a.demandLevel !== "red") return 1;
    return (a.startIso ?? "").localeCompare(b.startIso ?? "");
  });

  // Rajoita kohtuulliseen kokoon
  const result = out.slice(0, 60);
  if (result.length > 0) writeCache(result);
  return result;
}
