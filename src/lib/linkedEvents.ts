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
  "HKT",
  "Suuri näyttämö",
  "Suomen kansallisooppera",
  "ooppera",
  "Musiikkitalo",
  "Tavastia",
  "Kulttuuritalo",
  "Savoy-teatteri",
  "Tanssin talo",
  "Bolt Arena",
  "Olympiastadion",
  "Helsingin Jäähalli",
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
  /kansallisooppera/i,
  /\booppera\b/i,
  /musiikkitalo/i,
  /tavastia/i,
  /kulttuuritalo/i,
  /bolt arena/i,
  /olympiastadion/i,
  /helsingin jäähalli/i,
];

const HARD_BLOCK_PATTERNS = [
  /tahdon tarina/i,
  /urheilumuseo/i,
];

function isImportantVenue(name: string, venue: string): boolean {
  const txt = `${name} ${venue}`;
  return IMPORTANT_PATTERNS.some((re) => re.test(txt));
}

function isNoise(name: string, venue: string): boolean {
  const txt = `${name} ${venue}`;
  // Hard block: nama suodatetaan AINA pois, vaikka venue olisi "tarkea"
  if (HARD_BLOCK_PATTERNS.some((re) => re.test(txt))) return true;
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

function todayAtSameLocalClock(iso: string, now: Date): string {
  const src = new Date(iso);
  const d = new Date(now);
  d.setHours(src.getHours(), src.getMinutes(), 0, 0);
  return d.toISOString();
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
  const res = await fetch(`https://api.hel.fi/linkedevents/v1/event/?${params}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    console.warn("LinkedEvents haku epaonnistui:", res.status);
    return [];
  }
  const json = (await res.json()) as LinkedResponse;
  return json.data ?? [];
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

  let raw: LinkedEvent[] = [];
  try {
    const requests = [
      new URLSearchParams({ ...baseParams, keyword: KEYWORD_QUERY, page_size: "100" }),
      ...TARGET_TEXT_QUERIES.map((text) => new URLSearchParams({ ...baseParams, text })),
    ];
    const pages = await Promise.all(requests.map(fetchLinkedPage));
    raw = pages.flat();
  } catch (err) {
    console.warn("LinkedEvents poikkeus:", err);
    return [];
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

    const displayStartIso = startMs < todayStart.getTime() && endMs >= todayStart.getTime()
      ? todayAtSameLocalClock(ev.start_time, now)
      : ev.start_time;

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
      endTime: fmtTime(ev.end_time),
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
  return out.slice(0, 60);
}
