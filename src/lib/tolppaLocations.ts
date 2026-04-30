/**
 * tolppaLocations.ts
 *
 * Tunnetut taksitolpat Helsinki/Espoo/Vantaa-alueilta koordinaateilla.
 * Käytetään matchaamaan dispatch_scans.tolppa nimi → koordinaatit
 * jotta voidaan laskea etäisyys autosta ja ryhmitellä vyöhykkeisiin.
 *
 * Nimet normalisoidaan (lowercase, ilman ääkkösiä) → tolerantti haku.
 */

export type Zone = "Helsinki keskusta" | "Helsinki itä" | "Helsinki länsi" | "Helsinki pohjoinen" | "Espoo" | "Vantaa" | "Lentoasema";

export interface TolppaLocation {
  name: string;       // virallinen nimi
  aliases?: string[]; // vaihtoehtoiset kirjoitustavat
  lat: number;
  lon: number;
  zone: Zone;
  /** Virallinen Taksi Helsingin tolppanumero, jos tiedossa. */
  number?: number;
  /** Toinen tolppanumero jos kyseessä yhdistetty tolppa (esim. Erottaja 21 + Kämp 4). */
  number2?: number;
  /** Lyhyt katuosoite/kuvaus näyttöön (esim. "Aleksanterinkatu"). */
  street?: string;
}

/**
 * Tunnetut tolpat. Lista perustuu Helsingin/PKS:n yleisiin taksitolppiin
 * jotka esiintyvät Taksi Helsingin välityslaitteessa.
 */
export const TOLPAT: TolppaLocation[] = [
  // === Helsinki keskusta ===
  { name: "Rautatientori", aliases: ["Rautatieasema", "Rautatieasema P", "Kaivokatu"], lat: 60.1709, lon: 24.9419, zone: "Helsinki keskusta", number: 14, street: "Kaivokatu / Rautatientori" },
  { name: "Asema-aukio", aliases: ["Elielinaukio", "Eliel", "Asemaaukio"], lat: 60.1718, lon: 24.9396, zone: "Helsinki keskusta", number: 37, street: "Asema-aukio / Elielinaukio" },
  { name: "Elielinaukio Musiikkitalo", aliases: ["Musiikkitalo Eliel", "Eliel Musiikkitalo"], lat: 60.1742, lon: 24.9370, zone: "Helsinki keskusta", number: 39, street: "Elielinaukio (Musiikkitalon puoli)" },
  { name: "Aleksanterinkatu", aliases: ["Säätytalo", "Saatytalo", "Snellmaninkatu"], lat: 60.1707, lon: 24.9525, zone: "Helsinki keskusta", number: 6, street: "Aleksanterinkatu / Säätytalo" },
  { name: "Kamppi", aliases: ["Kamppi keskus", "Narinkkatori"], lat: 60.1690, lon: 24.9320, zone: "Helsinki keskusta", number: 59, street: "Narinkkatori / Kamppi" },
  { name: "Museokatu", aliases: ["Eduskuntatalo", "Eduskunta", "Storyville", "Viikki"], lat: 60.1738, lon: 24.9298, zone: "Helsinki keskusta", number: 41, street: "Museokatu / Eduskuntatalo" },
  { name: "Pikkuparlamentti", aliases: ["Hotel Presidentti", "Presidentti-hotelli", "Hotelli Presidentti", "Lasipalatsi"], lat: 60.1707, lon: 24.9301, zone: "Helsinki keskusta", number: 35, street: "Lasipalatsi / Presidentti" },
  { name: "Musiikkitalo", aliases: ["Musiikkitalo Mannerheimintie"], lat: 60.1758, lon: 24.9355, zone: "Helsinki keskusta", number: 39, street: "Mannerheimintie / Elielinaukio" },
  { name: "Finlandia-talo", aliases: ["Finlandiatalo", "Finlandia talo"], lat: 60.1760, lon: 24.9389, zone: "Helsinki keskusta", number: 19, street: "Mannerheimintie" },
  { name: "Oodi", aliases: ["Keskustakirjasto"], lat: 60.1737, lon: 24.9380, zone: "Helsinki keskusta", street: "Töölönlahdenkatu" },
  { name: "Sanomatalo", lat: 60.1716, lon: 24.9381, zone: "Helsinki keskusta", street: "Töölönlahdenkatu" },
  { name: "Kiasma", lat: 60.1726, lon: 24.9367, zone: "Helsinki keskusta", street: "Mannerheiminaukio" },
  { name: "Ooppera", aliases: ["Kansallisooppera", "Oopperatalo", "Itä-Töölö"], lat: 60.1827, lon: 24.9270, zone: "Helsinki keskusta", number: 52, street: "Helsinginkatu / Itä-Töölö" },
  { name: "Helsingin kaupunginteatteri", aliases: ["HKT", "Kaupunginteatteri", "Hkt", "Linnanmäki"], lat: 60.1846, lon: 24.9532, zone: "Helsinki keskusta", number: 27, street: "Linnanmäki / HKT" },
  { name: "Veikkaus Areena", aliases: ["Veikkausareena", "Helsinki Halli", "Helsinki-halli", "Hartwall Arena", "Hartwall"], lat: 60.2061, lon: 24.9293, zone: "Helsinki pohjoinen", number: 79, street: "Areenakuja / Veikkausareena" },
  { name: "Linnanmäki", aliases: ["Linnanmaki"], lat: 60.1875, lon: 24.9395, zone: "Helsinki keskusta", street: "Tivolitie" },
  { name: "Kaisaniemi", lat: 60.1733, lon: 24.9466, zone: "Helsinki keskusta", street: "Kaisaniemenkatu" },
  { name: "Kauppatori", aliases: ["Kolera-allas"], lat: 60.1675, lon: 24.9528, zone: "Helsinki keskusta", street: "Eteläranta" },
  { name: "Senaatintori", lat: 60.1696, lon: 24.9519, zone: "Helsinki keskusta", street: "Aleksanterinkatu" },
  { name: "Erottaja", aliases: ["Erottajan tolppa", "Savoy"], lat: 60.1660, lon: 24.9437, zone: "Helsinki keskusta", number: 21, street: "Erottaja / Savoy" },
  { name: "Kämp", aliases: ["Kamp", "Kämp-tolppa"], lat: 60.1683, lon: 24.9450, zone: "Helsinki keskusta", number: 4, street: "Pohjoisesplanadi / Kämp" },
  { name: "Mannerheimintie", lat: 60.1731, lon: 24.9362, zone: "Helsinki keskusta", street: "Mannerheimintie" },
  { name: "Stockmann", lat: 60.1685, lon: 24.9418, zone: "Helsinki keskusta", street: "Aleksanterinkatu" },
  { name: "Hakaniemi", lat: 60.1789, lon: 24.9518, zone: "Helsinki keskusta", street: "Hakaniementori" },
  { name: "Töölöntori", aliases: ["Toolontori", "Töölö", "Olympiastadion-tolppa"], lat: 60.1820, lon: 24.9210, zone: "Helsinki keskusta", number: 45, street: "Töölöntori" },
  { name: "Kallio", aliases: ["Kallion tolppa"], lat: 60.1842, lon: 24.9508, zone: "Helsinki keskusta", street: "Helsinginkatu" },
  { name: "Sörnäinen", aliases: ["Sornainen", "Sörkkä"], lat: 60.1872, lon: 24.9601, zone: "Helsinki keskusta", street: "Hämeentie" },
  { name: "Simonkenttä", aliases: ["Simonkentta", "Simonkatu", "Simonaukio", "Suomalainen Klubi", "Klubi"], lat: 60.1696, lon: 24.9347, zone: "Helsinki keskusta", number: 96, street: "Simonkenttä / Suomalainen Klubi" },
  { name: "Katajanokan terminaali", aliases: ["Katajanokka"], lat: 60.1664, lon: 24.9690, zone: "Helsinki keskusta", street: "Katajanokanlaituri" },
  { name: "Olympiaterminaali", lat: 60.1620, lon: 24.9540, zone: "Helsinki keskusta", street: "Olympiaranta" },
  { name: "Länsiterminaali", aliases: ["Lansiterminaali", "LT2"], lat: 60.1542, lon: 24.9203, zone: "Helsinki länsi", street: "Tyynenmerenkatu" },
  { name: "Jätkäsaari", aliases: ["Jatkasaari"], lat: 60.1551, lon: 24.9180, zone: "Helsinki länsi", street: "Tyynenmerenkatu" },

  // === Helsinki länsi/luode ===
  { name: "Ruoholahti", aliases: ["Tanssin talo", "Kaapelitehdas", "Kaapeli"], lat: 60.1639, lon: 24.9150, zone: "Helsinki länsi", number: 11, street: "Ruoholahti / Tanssin talo / Kaapeli" },
  { name: "Lauttasaari", lat: 60.1597, lon: 24.8784, zone: "Helsinki länsi" },
  { name: "Munkkivuori", lat: 60.2071, lon: 24.8718, zone: "Helsinki länsi" },
  { name: "Munkkiniemi", lat: 60.1964, lon: 24.8800, zone: "Helsinki länsi" },
  { name: "Meilahti", aliases: ["Meilahden sairaala"], lat: 60.1888, lon: 24.9038, zone: "Helsinki länsi" },

  // === Helsinki pohjoinen ===
  { name: "Pasila", aliases: ["Pasilan asema", "Tripla"], lat: 60.1989, lon: 24.9335, zone: "Helsinki pohjoinen" },
  { name: "Käpylä", aliases: ["Kapyla"], lat: 60.2153, lon: 24.9520, zone: "Helsinki pohjoinen" },
  { name: "Oulunkylä", aliases: ["Oulunkyla"], lat: 60.2293, lon: 24.9678, zone: "Helsinki pohjoinen" },
  { name: "Malmi", aliases: ["Malmin asema"], lat: 60.2510, lon: 25.0090, zone: "Helsinki pohjoinen" },

  // === Helsinki itä ===
  { name: "Itäkeskus", aliases: ["Itakeskus", "Itis"], lat: 60.2103, lon: 25.0807, zone: "Helsinki itä" },
  { name: "Herttoniemi", lat: 60.1929, lon: 25.0354, zone: "Helsinki itä" },
  { name: "Vuosaari", lat: 60.2113, lon: 25.1450, zone: "Helsinki itä" },
  { name: "Mellunmäki", aliases: ["Mellunmaki"], lat: 60.2335, lon: 25.1140, zone: "Helsinki itä" },
  { name: "Kontula", lat: 60.2336, lon: 25.0920, zone: "Helsinki itä" },
  { name: "Myllypuro", lat: 60.2233, lon: 25.0750, zone: "Helsinki itä" },

  // === Espoo ===
  { name: "Tapiola", aliases: ["Tapiolan keskus", "Ainoa"], lat: 60.1755, lon: 24.8047, zone: "Espoo" },
  { name: "Otaniemi", aliases: ["Aalto-yliopisto"], lat: 60.1844, lon: 24.8260, zone: "Espoo" },
  { name: "Keilaniemi", lat: 60.1758, lon: 24.8290, zone: "Espoo" },
  { name: "Leppävaara", aliases: ["Leppavaara", "Sello"], lat: 60.2189, lon: 24.8131, zone: "Espoo" },
  { name: "Espoon keskus", aliases: ["Espoonkeskus", "Espoo asema"], lat: 60.2055, lon: 24.6559, zone: "Espoo" },
  { name: "Matinkylä", aliases: ["Matinkyla", "Iso Omena"], lat: 60.1606, lon: 24.7383, zone: "Espoo" },
  { name: "Kivenlahti", lat: 60.1500, lon: 24.6500, zone: "Espoo" },
  { name: "Westend", lat: 60.1700, lon: 24.8200, zone: "Espoo" },
  { name: "Niittykumpu", lat: 60.1700, lon: 24.7700, zone: "Espoo" },

  // === Vantaa ===
  { name: "Tikkurila", aliases: ["Tikkurilan asema", "Dixi"], lat: 60.2925, lon: 25.0440, zone: "Vantaa" },
  { name: "Myyrmäki", aliases: ["Myyrmaki", "Myyrmanni"], lat: 60.2614, lon: 24.8543, zone: "Vantaa" },
  { name: "Hakunila", lat: 60.2700, lon: 25.1000, zone: "Vantaa" },
  { name: "Korso", lat: 60.3414, lon: 25.0867, zone: "Vantaa" },
  { name: "Martinlaakso", lat: 60.2806, lon: 24.8419, zone: "Vantaa" },
  { name: "Jumbo", aliases: ["Flamingo", "Jumbo Flamingo"], lat: 60.2880, lon: 25.0370, zone: "Vantaa" },
  { name: "Aviapolis", lat: 60.2960, lon: 24.9550, zone: "Lentoasema" },
  { name: "Helsinki-Vantaa", aliases: ["Lentoasema", "Lentokenttä", "T2", "T1", "HEL"], lat: 60.3172, lon: 24.9633, zone: "Lentoasema" },
];

/** Normalisoi nimi: lowercase, ilman ääkkösiä, ilman välimerkkejä. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Etsi tolppa nimellä tai aliaksella. Palauttaa undefined jos ei löydy. */
export function findTolppa(name: string): TolppaLocation | undefined {
  const n = normalize(name);
  if (!n) return undefined;
  // 1. Täsmälleen sama
  for (const t of TOLPAT) {
    if (normalize(t.name) === n) return t;
    if (t.aliases?.some((a) => normalize(a) === n)) return t;
  }
  // 2. Sisältyy nimeen tai päinvastoin (esim. "Pasilan asema P3" → "Pasila")
  for (const t of TOLPAT) {
    const tn = normalize(t.name);
    if (n.includes(tn) || tn.includes(n)) return t;
    if (t.aliases?.some((a) => {
      const an = normalize(a);
      return n.includes(an) || an.includes(n);
    })) return t;
  }
  return undefined;
}

/**
 * Token-pohjainen haku — jakaa hakunimen sanoiksi ja katsoo löytyykö
 * jokin tokeni tolpan nimestä/aliaksesta. Esim "B96 SIMONKENTTÄ" → "simonkentta" → Simonkenttä.
 * Filtteroi pois lyhyet (≤2 merkkiä) ja pelkät numerot/koodit (B96, P3 jne.).
 */
export function findTolppaSmart(name: string): TolppaLocation | undefined {
  const direct = findTolppa(name);
  if (direct) return direct;
  const n = normalize(name);
  if (!n) return undefined;
  const tokens = n.split(" ").filter((t) => t.length >= 4 && !/^[a-z]?\d+$/.test(t));
  if (tokens.length === 0) return undefined;
  // Etsi pisin matchaava tokeni (Simonkenttä > Kamppi jos molemmat osuvat)
  let best: { loc: TolppaLocation; len: number } | undefined;
  for (const t of TOLPAT) {
    const candidates = [normalize(t.name), ...(t.aliases ?? []).map(normalize)];
    for (const c of candidates) {
      for (const tok of tokens) {
        if (c.includes(tok) || tok.includes(c)) {
          const len = Math.min(c.length, tok.length);
          if (!best || len > best.len) best = { loc: t, len };
        }
      }
    }
  }
  return best?.loc;
}

/**
 * Tarkistaa onko merkkijono uskottava tolpan nimi.
 * Hylkää LLM-roskan: markdown, päivämäärä-otsikot, "Ryhmä", liian lyhyet.
 */
export function isValidTolppaName(name: string): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 80) return false;
  // Markdown / metadata
  if (/[*_`#]/.test(trimmed)) return false;
  if (/päivämäärä|paivamaara|aika:|pvm:|date:|time:/i.test(trimmed)) return false;
  // Pelkkä "Ryhmä" tai "Tolppa" tms. yleissana ilman omaa nimeä
  const norm = normalize(trimmed);
  const banned = new Set(["ryhma", "tolppa", "asema", "tuntematon", "unknown", "n a", "na"]);
  if (banned.has(norm)) return false;
  // Vähintään yksi kirjainsekvenssi (≥3 kirjainta)
  if (!/[a-zA-ZåäöÅÄÖ]{3,}/.test(trimmed)) return false;
  return true;
}

/** Haversine etäisyys kilometreinä. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export const ALL_ZONES: Zone[] = [
  "Helsinki keskusta",
  "Helsinki itä",
  "Helsinki länsi",
  "Helsinki pohjoinen",
  "Espoo",
  "Vantaa",
  "Lentoasema",
];

/** Vyöhykkeen keskipiste (manuaalivalintaa varten). */
export const ZONE_CENTERS: Record<Zone, { lat: number; lon: number }> = {
  "Helsinki keskusta": { lat: 60.1699, lon: 24.9420 },
  "Helsinki itä": { lat: 60.2100, lon: 25.0800 },
  "Helsinki länsi": { lat: 60.1640, lon: 24.9000 },
  "Helsinki pohjoinen": { lat: 60.2150, lon: 24.9500 },
  "Espoo": { lat: 60.2055, lon: 24.6559 },
  "Vantaa": { lat: 60.2925, lon: 25.0440 },
  "Lentoasema": { lat: 60.3172, lon: 24.9633 },
};

/**
 * Päättele kuljettajan "alue" GPS-sijainnin perusteella.
 * Palauttaa lähimmän vyöhykkeen + sen etäisyyden.
 * Käytetään dynaamiseen UI:n priorisointiin (näytetään lähimmän alueen
 * tapahtumat ensisijaisesti).
 */
export function detectDriverArea(
  lat: number | null | undefined,
  lon: number | null | undefined,
): { zone: Zone; km: number } | null {
  if (lat == null || lon == null) return null;
  let best: { zone: Zone; km: number } | null = null;
  for (const z of ALL_ZONES) {
    const c = ZONE_CENTERS[z];
    const km = distanceKm(lat, lon, c.lat, c.lon);
    if (!best || km < best.km) best = { zone: z, km };
  }
  return best;
}

/** Lyhyt label kuljettajan alueesta UI:ta varten ("Tikkurila", "Pasila", "Keskusta", jne.). */
export function driverAreaLabel(zone: Zone): string {
  switch (zone) {
    case "Helsinki keskusta": return "Keskusta";
    case "Helsinki itä": return "Itä-Helsinki";
    case "Helsinki länsi": return "Länsi-Helsinki";
    case "Helsinki pohjoinen": return "Pohjois-Helsinki";
    case "Espoo": return "Espoo";
    case "Vantaa": return "Vantaa";
    case "Lentoasema": return "Lentoasema";
  }
}

// ---------------------------------------------------------------------------
// Venue -> tolppa -mappi (erikoistapaukset, joissa lähin tolppa ei ole sama
// kuin geometrian lähin). Esim. Savoy palvelee Erottaja+Kämp -yhdistettyä,
// vaikka geometrisesti Senaatintori voisi olla yhtä lähellä.
// Avaimet normalisoidaan (lowercase, ilman ääkkösiä).
// ---------------------------------------------------------------------------

const VENUE_TOLPPA_OVERRIDES: Record<string, string> = {
  // Politiikka / valtio
  "saatytalo": "Aleksanterinkatu",
  "säätytalo": "Aleksanterinkatu",
  "valtioneuvoston linna": "Aleksanterinkatu",
  "smolna": "Aleksanterinkatu",
  "presidentinlinna": "Kauppatori",
  "eduskuntatalo": "Museokatu",
  "eduskunta": "Museokatu",
  "pikkuparlamentti": "Pikkuparlamentti",
  "hotel presidentti": "Pikkuparlamentti",
  "hotelli presidentti": "Pikkuparlamentti",
  // Kulttuuri
  "kansallisooppera": "Ooppera",
  "ooppera": "Ooppera",
  "oopperatalo": "Ooppera",
  "musiikkitalo": "Musiikkitalo",
  "finlandia-talo": "Finlandia-talo",
  "finlandiatalo": "Finlandia-talo",
  "savoy-teatteri": "Erottaja",
  "savoy": "Erottaja",
  "kansallisteatteri": "Rautatientori",
  "aleksanterin teatteri": "Erottaja",
  "kaupunginteatteri": "Helsingin kaupunginteatteri",
  "helsingin kaupunginteatteri": "Helsingin kaupunginteatteri",
  "hkt": "Helsingin kaupunginteatteri",
  "tanssin talo": "Ruoholahti",
  "kaapelitehdas": "Ruoholahti",
  "kaapeli": "Ruoholahti",
  "storyville": "Museokatu",
  "kulttuuritalo": "Sörnäinen",
  "tavastia": "Kamppi",
  "g livelab": "Kämp",
  "kaisaniemen puisto": "Kaisaniemi",
  // Klubit / business
  // Käyttäjän vahvistama: Suomalainen Klubi → tolppa 96 Simonkenttä
  "suomalainen klubi": "Simonkenttä",
  "helsingin suomalainen klubi": "Simonkenttä",
  "klubi": "Simonkenttä",
  // Hotellit
  "hotel kämp": "Kämp",
  "kamp": "Kämp",
  "hotel st. george": "Erottaja",
  "hotel vaakuna": "Rautatientori",
  "vaakuna": "Rautatientori",
  "radisson blu plaza": "Rautatientori",
  "radisson blue plaza": "Rautatientori",
  "ateneum": "Rautatientori",
  // Areenat
  "helsinki halli": "Veikkaus Areena",
  "helsinki-halli": "Veikkaus Areena",
  "hartwall arena": "Veikkaus Areena",
  "hartwall areena": "Veikkaus Areena",
  "veikkaus arena": "Veikkaus Areena",
  "veikkausareena": "Veikkaus Areena",
  "veikkaus areena": "Veikkaus Areena",
  "jaahalli": "Veikkaus Areena",
  "jäähalli": "Veikkaus Areena",
  "nordis": "Veikkaus Areena",
  // Käyttäjän vahvistama: Olympiastadion-alue → Ooppera/Itä-Töölö (tolppa 52)
  "olympiastadion": "Ooppera",
  "bolt arena": "Ooppera",
  "helsingin olympiastadion": "Ooppera",
  "urheilumuseo": "Ooppera",
  // Messut
  "messukeskus": "Pasila",
  "messukeskus helsinki": "Pasila",
  // Suurlähetystöt-keskusta
  "presidentin kanslia": "Kauppatori",
};

/**
 * Tunnetut venuet koordinaatteineen geo-fallbackia varten.
 * Käytetään kun overridesta ei löydy match-iä → otetaan venuen lat/lon ja
 * etsitään lähin tolppa.
 */
export const VENUE_GEO: Record<string, { lat: number; lon: number }> = {
  "saatytalo": { lat: 60.1715, lon: 24.9527 },
  "säätytalo": { lat: 60.1715, lon: 24.9527 },
  "smolna": { lat: 60.1675, lon: 24.9498 },
  "valtioneuvoston linna": { lat: 60.1693, lon: 24.9514 },
  "presidentinlinna": { lat: 60.1685, lon: 24.9531 },
  "eduskuntatalo": { lat: 60.1722, lon: 24.9335 },
  "kansallisooppera": { lat: 60.1827, lon: 24.9270 },
  "musiikkitalo": { lat: 60.1758, lon: 24.9355 },
  "finlandia-talo": { lat: 60.1760, lon: 24.9389 },
  "savoy-teatteri": { lat: 60.1668, lon: 24.9479 },
  "savoy": { lat: 60.1668, lon: 24.9479 },
  "kansallisteatteri": { lat: 60.1719, lon: 24.9430 },
  "kaupunginteatteri": { lat: 60.1846, lon: 24.9532 },
  "tanssin talo": { lat: 60.1604, lon: 24.9211 },
  "kulttuuritalo": { lat: 60.1880, lon: 24.9489 },
  "tavastia": { lat: 60.1690, lon: 24.9295 },
  "suomalainen klubi": { lat: 60.1672, lon: 24.9498 },
  "helsingin suomalainen klubi": { lat: 60.1672, lon: 24.9498 },
  "hotel kamp": { lat: 60.1683, lon: 24.9450 },
  "hotel kämp": { lat: 60.1683, lon: 24.9450 },
  "messukeskus": { lat: 60.2014, lon: 24.9376 },
  "olympiastadion": { lat: 60.1869, lon: 24.9263 },
  "bolt arena": { lat: 60.1864, lon: 24.9305 },
  "helsinki halli": { lat: 60.2061, lon: 24.9293 },
};

/** Etsi lähin tolppa annetuista koordinaateista. */
export function findNearestTolppa(
  lat: number,
  lon: number,
): { tolppa: TolppaLocation; km: number } | undefined {
  let best: { tolppa: TolppaLocation; km: number } | undefined;
  for (const t of TOLPAT) {
    const d = distanceKm(lat, lon, t.lat, t.lon);
    if (!best || d < best.km) best = { tolppa: t, km: d };
  }
  return best;
}

/**
 * Päättelee venue-nimen perusteella tarkimman tolpan.
 * Logiikka:
 *   1. Override-mappi (esim. Säätytalo → Aleksanterinkatu)
 *   2. Venue-koordinaatit (VENUE_GEO) → lähin tolppa
 *   3. Token-pohjainen findTolppaSmart (etsii tolppanimeä venuesta)
 *   4. undefined
 */
export function findTolppaForVenue(
  venue: string,
): { tolppa: TolppaLocation; matchType: "override" | "geo" | "token"; km?: number } | undefined {
  if (!venue) return undefined;
  const n = normalize(venue);

  // 1. Override
  for (const key of Object.keys(VENUE_TOLPPA_OVERRIDES)) {
    const nk = normalize(key);
    if (n === nk || n.includes(nk) || nk.includes(n)) {
      const targetName = VENUE_TOLPPA_OVERRIDES[key];
      const t = TOLPAT.find((x) => x.name === targetName);
      if (t) return { tolppa: t, matchType: "override" };
    }
  }

  // 2. Geo via tunnettu venue
  for (const key of Object.keys(VENUE_GEO)) {
    const nk = normalize(key);
    if (n === nk || n.includes(nk) || nk.includes(n)) {
      const c = VENUE_GEO[key];
      const near = findNearestTolppa(c.lat, c.lon);
      if (near) return { tolppa: near.tolppa, matchType: "geo", km: near.km };
    }
  }

  // 3. Token-pohjainen tolppa-haku (esim. "Stockmannin Stockmann-baari")
  const direct = findTolppaSmart(venue);
  if (direct) return { tolppa: direct, matchType: "token" };

  return undefined;
}

/** Muotoilee tolpan näyttöä varten. "Tolppa 6 — Aleksanterinkatu" tai "Erottaja". */
export function formatTolppaLabel(t: TolppaLocation): string {
  if (t.number != null && t.number2 != null) {
    return `Tolppa ${t.number}/${t.number2} — ${t.name}`;
  }
  if (t.number != null) {
    return `Tolppa ${t.number} — ${t.name}`;
  }
  return t.name;
}