/**
 * eventCategories.ts
 *
 * Yhdistetty aikajananakyma datalahteille: kategorisoi tapahtumat
 * neljaan kategoriaan kuljettajan kannalta:
 *   - asemat   : lennot, kaukojunat, laivat (saapumiset)
 *   - kulttuuri: ooppera, teatterit, konsertit, festivaalit
 *   - urheilu  : Liiga, jalkapallo, NHL, areenat
 *   - muut     : kaikki muu (messut, klubit, manuaaliset overridet)
 *
 * Yhdistaa myos eri datalahteet yhteen TimelineItem-tyyppiin jotta
 * UI voi renderoida ne samalla tavalla 4h aikajanaan.
 */

import type {
  EventInfo,
  FlightArrival,
  ShipArrival,
  TrainDelay,
  SportsEvent,
} from "./types";
import { profileAudience } from "./audienceProfile";
import type { PoliticalEvent } from "./politicalEvents";
import { vipBadge, categoryLabel } from "./politicalEvents";
import { findTolppaForVenue, distanceKm, type TolppaLocation } from "./tolppaLocations";

export type EventCategory = "asemat" | "kulttuuri" | "urheilu" | "politiikka" | "muut";

export interface TimelineItem {
  id: string;
  category: EventCategory;
  /** Kuljettajalle nakyva paaotsikko, esim. "AY1234 Tukholma" */
  title: string;
  /** Paikan nimi tai lisatieto */
  subtitle: string;
  /** Kellonaika HH:MM (alkamis- tai saapumisaika) */
  time: string;
  /** Aika millisekunteina kunnes tapahtuma alkaa/saapuu (negatiivinen = jo kaynnissa) */
  startMs: number;
  /** Alkuajan ISO-muoto (jos saatavilla), kayttetaan paivamaaran nayttoon */
  startIso?: string;
  level: "red" | "amber" | "green";
  /** Numeerinen "kysynta" pisteytysta varten - max 5/tab valintaan */
  weight: number;
  /** Vapaaehtoinen paatag, esim. "LOPPUUNMYYTY" */
  tag?: string;
  /** Toinen tag — taksi-/asiakassegmentin kuvaus (esim. "TAKSIYLEISO") */
  audienceTag?: string;
  /** Kohdeasiakkaiden ika-arvio "55-85" */
  audienceAge?: string;
  /** Kapasiteetti tai matkustajamaara, jos tiedossa */
  capacity?: number;
  /** Lipunmyyntiaste 0..100 (jos tiedossa), naytetaan kortilla */
  loadPct?: number;
  /** Loppumisaika HH:MM (jos tiedossa) — naytetaan "alku–loppu" muodossa */
  endTime?: string;
  /** Ulkoinen URL johon kortin klikkaus johtaa (uusi valilehti) */
  url?: string;
  /** Lähin/sopivin taksitolppa tapahtumalle (jos pystyttiin päättelemään). */
  tolppa?: TolppaLocation;
  /** Etäisyys autosta tähän tolppaan kilometreinä, jos käyttäjän GPS on tiedossa. */
  tolppaKmFromUser?: number;
  /** Alkuperainen objekti, jotta detail-paneeli toimii */
  raw: { kind: "flight" | "train" | "ship" | "event" | "sports" | "political"; data: unknown };
}

// ---------------------------------------------------------------------------
// Venue -> kategoria mappaus (kulttuuri vs urheilu vs muut)
// ---------------------------------------------------------------------------

const URHEILU_KEYS = [
  "stadion",
  "olympiastadion",
  "jaahalli",
  "jäähalli",
  "nordis",
  "veikkausarena",
  "helsinki halli",
  "hartwall",
  "bolt arena",
  "kisahalli",
  "areena",
  "arena",
  "telia 5g",
  "sonera",
  "energia areena",
];

const KULTTUURI_KEYS = [
  "ooppera",
  "kansallisooppera",
  "musiikkitalo",
  "teatteri",
  "kaupunginteatteri",
  "kansallisteatteri",
  "tanssin talo",
  "savoy",
  "kannusali",
  "finlandia",
  "kulttuuritalo",
  "tavastia",
  "korjaamo",
  "g livelab",
  "musiikkitalo",
  "alexanderinteatteri",
  "kallio-kuninkala",
];

/**
 * Sanat, jotka tapahtuman NIMESSA aina vihjaavat kulttuuriin,
 * vaikka venue olisi urheiluareena (esim. konsertti Veikkaus Arenalla).
 */
const KULTTUURI_NAME_KEYS = [
  "konsertti",
  "concert",
  "live",
  "tour",
  "kiertue",
  "festivaali",
  "festival",
  "ooppera",
  "opera",
  "ballet",
  "baletti",
  "musikaali",
  "musical",
  "sinfonia",
  "orkesteri",
  "orchestra",
  "jazz",
  "klubi",
  "club",
  "stand up",
  "stand-up",
  "comedy",
  "show",
  "näyttely",
  "naytttely",
  "teatteri",
  "näytäntö",
  "esitys",
  "duo",
  "trio",
  "quartet",
  "kvartetti",
  "band",
  "bändi",
  "chorus",
  "kuoro",
  "dj",
  "rap",
  "metal",
  "hevi",
  "rock",
  "punk",
  "pop ",
  "indie",
  "klassinen",
  "akustinen",
];

/**
 * Sanat, jotka tapahtuman NIMESSA aina vihjaavat urheiluun,
 * vaikka venue olisi yleishalli.
 */
const URHEILU_NAME_KEYS = [
  " vs ",
  " vs.",
  "ottelu",
  "match",
  "liiga",
  "league",
  "cup",
  "mestaruus",
  "championship",
  "turnaus",
  "tournament",
  "playoff",
  "pudotuspeli",
  "finaali",
  "final",
  "derby",
  "futis",
  "jalkapallo",
  "football",
  "jääkiekko",
  "kiekko",
  "hockey",
  "koripallo",
  "basket",
  "lentopallo",
  "salibandy",
  "salibändy",
  "floorball",
  "ufc",
  "boxing",
  "nyrkkeily",
  "kamppailu",
  "mma",
  "hifk",
  "hjk",
  "jokerit",
  "tappara",
  "kärpät",
  "ilves",
  "tps",
  "lukko",
  "saipa",
  "sport",
  "kalpa",
  "honka",
];

/**
 * Tarkistaa osuuko avainsana sanaan kokonaisina sanoina (rajat välimerkein),
 * jotta esim. "areena" osuu mutta "areenakatu" ei.
 */
function hasKeyword(text: string, key: string): boolean {
  if (key.includes(" ")) return text.includes(key);
  // sanaraja: alku/loppu tai ei-kirjain ympärillä
  const re = new RegExp(`(^|[^a-zåäö0-9])${key}([^a-zåäö0-9]|$)`, "i");
  return re.test(text);
}

/**
 * Luokittelee tapahtuman ENSISIJAISESTI nimen perusteella ja
 * VAIN sen jälkeen venuen perusteella. Tämä korjaa ristiriidan,
 * jossa konsertti urheiluareenalla menisi urheiluksi.
 *
 * Algoritmi:
 *   1. Jos nimi sisältää selkeän kulttuurisanan -> kulttuuri.
 *   2. Jos nimi sisältää selkeän urheilusanan -> urheilu.
 *   3. Muuten venuen mukaan (urheiluareena -> urheilu, muu -> kulttuuri/muut).
 */
export function categorizeEvent(name: string, venue: string): EventCategory {
  const n = (name || "").toLowerCase();
  const v = (venue || "").toLowerCase();

  // 1) Nimi-pohjainen tunnistus voittaa
  const nameSaysCulture = KULTTUURI_NAME_KEYS.some((k) => hasKeyword(n, k));
  const nameSaysSports = URHEILU_NAME_KEYS.some((k) => hasKeyword(n, k));

  if (nameSaysCulture && !nameSaysSports) return "kulttuuri";
  if (nameSaysSports && !nameSaysCulture) return "urheilu";

  // 2) Venue-pohjainen fallback. HUOM: monitoimiareenoille (Helsinki Halli,
  // Veikkaus Arena, Olympiastadion) ei voi luottaa pelkkaan venueen — niissa
  // on seka konsertteja etta otteluita. Jos nimessa ei ole selkeaa
  // urheilukeywordia, oletus on kulttuuri (konsertti/show).
  const isMultiUseArena = /helsinki halli|veikkaus.?arena|hartwall|olympiastadion|messukeskus|kulttuuritalo/i.test(v);
  if (isMultiUseArena) {
    return nameSaysSports ? "urheilu" : "kulttuuri";
  }

  const venueSaysCulture = KULTTUURI_KEYS.some((k) => v.includes(k));
  const venueSaysSports = URHEILU_KEYS.some((k) => v.includes(k));

  if (venueSaysCulture) return "kulttuuri";
  if (venueSaysSports) return "urheilu";

  return "muut";
}

/** Vanha API-yhteensopivuus: vain venuen perusteella. */
export function categorizeVenue(venue: string): EventCategory {
  return categorizeEvent("", venue);
}

// ---------------------------------------------------------------------------
// Aika-apurit
// ---------------------------------------------------------------------------

/** Parsii "HH:MM" tai ISO -ajan ja palauttaa millisekunnit nyt-hetkeen verrattuna */
function timeToMs(timeStr: string): number {
  if (!timeStr) return 0;
  // ISO-aika
  if (timeStr.includes("T") || timeStr.includes("-")) {
    const t = new Date(timeStr).getTime();
    return t - Date.now();
  }
  // HH:MM (oletetaan tanaan)
  const [h, m] = timeStr.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  // Jos aika on jo mennyt yli 30 min sitten -> oletetaan huomenna (esim. lentoasemille klo 00:30)
  if (d.getTime() < Date.now() - 30 * 60 * 1000) {
    d.setDate(d.getDate() + 1);
  }
  return d.getTime() - Date.now();
}

/** Onko kohde aika-ikkunan sisalla? maxMin = paljonko eteenpain, minMin = miten paljon ohi voi olla (oletus -30min) */
export function inWindow(item: TimelineItem, maxMinutes: number, minMinutes = -30): boolean {
  const minutes = item.startMs / 60000;
  return minutes >= minMinutes && minutes <= maxMinutes;
}

// ---------------------------------------------------------------------------
// Adapterit: dataformaatit -> TimelineItem
// ---------------------------------------------------------------------------

export function eventToTimelineItem(e: EventInfo): TimelineItem {
  const time = e.startTime ?? "";
  // Jos meilla on tay ISO-aika, kayta sita (oikea paivamaara). Muuten HH:MM-arvio.
  const startMs = e.startIso
    ? new Date(e.startIso).getTime() - Date.now()
    : timeToMs(time);
  const level = e.demandLevel || (e.soldOut ? "red" : "amber");
  const audience = profileAudience(e.name, e.venue, e.capacity, e.startIso);
  // Affinity bonus weightiin: 0..50 lisaa
  const affinityBonus = Math.round((audience.taxiAffinity / 100) * 50);
  // Painotus: red = 100, amber = 50, capacity bonus
  const weight =
    (level === "red" ? 100 : level === "amber" ? 50 : 10) +
    (e.capacity ? Math.min(50, e.capacity / 100) : 0) +
    (e.soldOut ? 30 : 0) +
    affinityBonus;

  const loadPct =
    e.soldOut
      ? 100
      : e.loadFactor != null
      ? Math.round(Number(e.loadFactor) * 100)
      : e.capacity && e.estimatedAttendance
      ? Math.round((e.estimatedAttendance / e.capacity) * 100)
      : undefined;

  const tolppaMatch = findTolppaForVenue(e.venue);
  // Helsingin kaupunginteatterin tapahtumiin näyttämömerkintä subtitleen
  // (Suuri näyttämö = 1120, Arena = 500, Studio Pasila = 320, Pieni = 250).
  // Auttaa kuljettajaa arvioimaan kysynnän kokoluokan suoraan listalta.
  const subtitle = annotateHktStage(e.name, e.venue);
  return {
    id: `event-${e.id}`,
    category: categorizeEvent(e.name, e.venue),
    title: e.name,
    subtitle,
    time,
    startMs,
    startIso: e.startIso,
    level,
    weight,
    tag: e.demandTag,
    audienceTag: audience.taxiTag,
    audienceAge: audience.primaryAge,
    capacity: e.capacity,
    loadPct,
    endTime: e.endTime,
    tolppa: tolppaMatch?.tolppa,
    url:
      e.infoUrl ||
      `https://www.google.com/search?q=${encodeURIComponent(`${e.name} ${e.venue} liput`)}`,
    raw: { kind: "event", data: e },
  };
}

export function flightToTimelineItem(f: FlightArrival): TimelineItem {
  const startMs = timeToMs(f.estimatedTime);
  // Painotus: kaukolennot (intercontinental) painavammat
  const weight =
    (f.demandLevel === "red" ? 100 : f.demandLevel === "amber" ? 50 : 20) +
    (f.delayMinutes > 30 ? 20 : 0);

  return {
    id: `flight-${f.id}`,
    category: "asemat",
    title: `${f.flightNumber} • ${f.origin}`,
    subtitle: `${f.terminal ?? "HEL"}${f.delayMinutes > 0 ? ` • +${f.delayMinutes}min` : ""}`,
    time: f.estimatedTime,
    startMs,
    level: f.demandLevel,
    weight,
    tag: f.demandTag,
    url: `https://www.finavia.fi/fi/lentoasemat/helsinki-vantaa/saapuvat-lennot?flight=${encodeURIComponent(f.flightNumber)}`,
    raw: { kind: "flight", data: f },
  };
}

export function shipToTimelineItem(s: ShipArrival): TimelineItem {
  const pax = s.estimatedPax ?? s.pax;
  const startMs = timeToMs(s.eta);
  const level: "red" | "amber" | "green" =
    pax > 2000 ? "red" : pax > 1000 ? "amber" : "green";
  const weight = (level === "red" ? 100 : level === "amber" ? 50 : 20) + Math.min(50, pax / 50);

  return {
    id: `ship-${s.id}`,
    category: "asemat",
    title: s.ship,
    subtitle: `${s.harbor} • ~${pax.toLocaleString("fi-FI")} hlö`,
    time: s.eta,
    startMs,
    level,
    weight,
    capacity: s.pax,
    url: `https://www.portofhelsinki.fi/matkustajat/aikataulut`,
    raw: { kind: "ship", data: s },
  };
}

export function trainToTimelineItem(t: TrainDelay, stationName: string): TimelineItem {
  const startMs = timeToMs(t.arrivalTime);
  const level: "red" | "amber" | "green" =
    t.delayMinutes > 60 ? "red" : t.delayMinutes > 10 ? "amber" : "green";
  // Junat painavammat jos myohassa, koska aiheuttaa ruuhkaa
  const weight = (level === "red" ? 80 : level === "amber" ? 40 : 15) + Math.min(20, t.delayMinutes);

  return {
    id: `train-${t.id}`,
    category: "asemat",
    title: `${t.line} ${t.origin}`,
    subtitle: `→ ${stationName}${t.delayMinutes > 0 ? ` • +${t.delayMinutes}min` : ""}`,
    time: t.arrivalTime,
    startMs,
    level,
    weight,
    url: `https://junalahdot.fi/?station=HKI`,
    raw: { kind: "train", data: t },
  };
}

export function sportsToTimelineItem(s: SportsEvent): TimelineItem {
  const startMs = timeToMs(s.startTime);
  const audience = profileAudience(`${s.homeTeam} vs ${s.awayTeam}`, s.venue, s.capacity);
  const weight =
    (s.demandLevel === "red" ? 100 : s.demandLevel === "amber" ? 50 : 20) +
    Math.min(50, s.expectedAttendance / 200) +
    Math.round((audience.taxiAffinity / 100) * 30);

  const tolppaMatch = findTolppaForVenue(s.venue);
  return {
    id: `sports-${s.id}`,
    category: "urheilu",
    title: `${s.homeTeam} – ${s.awayTeam}`,
    subtitle: `${s.venue} • ~${s.expectedAttendance.toLocaleString("fi-FI")} hlö`,
    time: s.startTime,
    startMs,
    level: s.demandLevel,
    weight,
    tag: s.demandTag,
    audienceTag: audience.taxiTag,
    audienceAge: audience.primaryAge,
    capacity: s.capacity,
    loadPct:
      s.capacity > 0 ? Math.round((s.expectedAttendance / s.capacity) * 100) : undefined,
    tolppa: tolppaMatch?.tolppa,
    url: `https://www.google.com/search?q=${encodeURIComponent(`${s.homeTeam} ${s.awayTeam} liput`)}`,
    raw: { kind: "sports", data: s },
  };
}

// ---------------------------------------------------------------------------
// Kategoria-metadata UI:lle
// ---------------------------------------------------------------------------

export const CATEGORY_ORDER: EventCategory[] = ["asemat", "kulttuuri", "urheilu", "politiikka", "muut"];

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  asemat: "Asemat",
  kulttuuri: "Kulttuuri",
  urheilu: "Urheilu",
  politiikka: "Politiikka",
  muut: "Muut",
};

// ---------------------------------------------------------------------------
// Political events -> TimelineItem
// ---------------------------------------------------------------------------

export function politicalToTimelineItem(p: PoliticalEvent): TimelineItem {
  const startMs = new Date(p.startIso).getTime() - Date.now();
  const time =
    new Date(p.startIso).getHours().toString().padStart(2, "0") +
    ":" +
    new Date(p.startIso).getMinutes().toString().padStart(2, "0");
  const endIso = p.endIso ?? p.predictedEndIso;
  const endTime = endIso
    ? new Date(endIso).getHours().toString().padStart(2, "0") +
      ":" +
      new Date(endIso).getMinutes().toString().padStart(2, "0")
    : undefined;

  // VIP-taso ohjaa kysyntatasoa
  const vip = (p.vipLevel ?? "").toLowerCase();
  const cat = (p.category ?? "").toLowerCase();
  const isHigh =
    vip.includes("president") ||
    vip.includes("paaminist") ||
    vip.includes("pääminist") ||
    cat.includes("nato") ||
    cat.includes("summit") ||
    cat.includes("huippu") ||
    cat.includes("valtio");
  const level: "red" | "amber" | "green" = isHigh ? "red" : "amber";
  const weight = (level === "red" ? 110 : 60) + (p.confidence ? p.confidence * 20 : 10);

  const tag = categoryLabel(p.category);
  const audienceTag = vipBadge(p.vipLevel);

  const tolppaMatch = findTolppaForVenue(p.location || "");
  return {
    id: `political-${p.id}`,
    category: "politiikka",
    title: p.title,
    subtitle: p.location || "Helsinki",
    time,
    startMs,
    startIso: p.startIso,
    level,
    weight,
    tag,
    audienceTag,
    endTime,
    tolppa: tolppaMatch?.tolppa,
    url:
      p.sourceUrl ||
      `https://www.google.com/search?q=${encodeURIComponent(`${p.title} Helsinki`)}`,
    raw: { kind: "political", data: p },
  };
}

/**
 * Päivittää TimelineItem-listan etäisyydet käyttäjän GPS-koordinaateista
 * jokaiseen tolppaan. Käytetään yhden kerran komponentin sisällä.
 */
export function withTolppaDistances(
  items: TimelineItem[],
  userLat: number | null,
  userLon: number | null,
): TimelineItem[] {
  if (userLat == null || userLon == null) return items;
  return items.map((item) => {
    if (!item.tolppa) return item;
    const km = distanceKm(userLat, userLon, item.tolppa.lat, item.tolppa.lon);
    return { ...item, tolppaKmFromUser: km };
  });
}
