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
];

function isNoise(name: string, venue: string): boolean {
  const txt = `${name} ${venue}`;
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

function endsInMinutes(endIso?: string, startIso?: string): number {
  if (endIso) {
    return Math.max(0, Math.round((new Date(endIso).getTime() - Date.now()) / 60000));
  }
  if (startIso) {
    return Math.max(0, Math.round((new Date(startIso).getTime() + 2.5 * 3600_000 - Date.now()) / 60000));
  }
  return 0;
}

/**
 * Hae LinkedEvents-tapahtumat (kulttuuri + muut). Aikaikkuna: nyt - 7 pv eteen.
 * Suodattaa duplikaatit (super_event_type=recurring) ja "kohinan" (kirjastojumpat).
 */
export async function fetchLinkedEvents(): Promise<EventInfo[]> {
  const now = new Date();
  const startMin = new Date(now.getTime() - 30 * 60_000); // -30 min: jo alkaneet kayvat
  const end = new Date(now);
  end.setDate(end.getDate() + 7);
  end.setHours(23, 59, 59, 999);

  // Yhdistetty haku: kulttuuri + viihde-keywordit. yso-koodit:
  //   p360 = kulttuuritapahtumat, p1808 = konsertit, p13084 = teatteri,
  //   p11185 = ooppera, p2625 = musiikki, p20421 = festivaalit
  const params = new URLSearchParams({
    start: startMin.toISOString(),
    end: end.toISOString(),
    include: "location,keywords",
    page_size: "100",
    language: "fi",
    sort: "start_time",
    keyword: "yso:p360,yso:p1808,yso:p13084,yso:p11185,yso:p20421",
  });

  let raw: LinkedEvent[] = [];
  try {
    const res = await fetch(`https://api.hel.fi/linkedevents/v1/event/?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.warn("LinkedEvents culture haku epaonnistui:", res.status);
      return [];
    }
    const json = (await res.json()) as LinkedResponse;
    raw = json.data ?? [];
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
    if (startMs > end.getTime()) continue;
    if (startMs < startMin.getTime()) continue;

    const name = pickName(ev.name).trim();
    if (!name) continue;
    const venue = venueName(ev.location).trim();

    if (isNoise(name, venue)) continue;

    // Dedupe: sama nimi + alkamispaiva
    const dayKey = new Date(ev.start_time).toISOString().slice(0, 10);
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
      startTime: fmtTime(ev.start_time),
      startIso: ev.start_time,
      endTime: fmtTime(ev.end_time),
      capacity,
      availabilityNote: pickName(ev.short_description as { fi?: string }) || undefined,
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
