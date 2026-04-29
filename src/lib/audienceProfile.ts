/**
 * audienceProfile.ts
 *
 * Heuristiikka: arvioi tapahtuman yleison ika- ja asiakassegmentti
 * VENUEN ja NIMEN perusteella. Kayttetaan priorisoimaan tapahtumat
 * jotka todennakoisesti tuottavat taksiasiakkaita (ikalueet 30-100,
 * business-asiakkaat).
 *
 * Skaala: taxiAffinity 0..100. >=70 = vahva BOOST, 50-69 = lievä boost.
 */

export type AudienceSegment =
  | "senior"      // 60+ — vahvasti taksiystavallinen, klassinen / iskelma
  | "adult"       // 40-65 — teatteri, ooppera, business
  | "business"    // messut, gaalat, konferenssit
  | "young_adult" // 25-40 — klubit, rock, populaari
  | "youth"       // alle 25 — bilekonsertit, festivaalit
  | "family"      // perhetapahtumat — vahempi taksikysynta
  | "mixed";      // ei selkeaa profiilia

export interface AudienceProfile {
  segments: AudienceSegment[];
  primaryAge: string;          // esim. "50-75"
  taxiAffinity: number;        // 0..100
  taxiTag?: string;            // UI-tag esim. "TAKSIYLEISO" / "BUSINESS"
  reason: string;              // lyhyt perustelu
}

const SENIOR_VENUES = [
  /malmitalo/i,
  /stoa/i,
  /savoy/i,
  /finlandia/i,
  /kansallisteatteri/i,
  /helsingin kaupunginteatteri/i,
  /\bhkt\b/i,
  /kansallisooppera/i,
  /\booppera\b/i,
  /musiikkitalo/i,
  /sello-?sali/i,
  /espoon kulttuurikeskus/i,
  /kulttuuritalo/i,
  /alexanderinteatteri/i,
  /kannussali/i,
];

const SENIOR_NAME_KEYS = [
  /topmost/i,
  /iskelm/i,
  /tango/i,
  /humppa/i,
  /\beino\b/i,
  /vesa-matti/i,
  /paula koivuniemi/i,
  /katri-helena/i,
  /sinfonia/i,
  /klassinen/i,
  /klassikko/i,
  /ooppera/i,
  /opera/i,
  /baletti/i,
  /ballet/i,
  /kuoro/i,
  /chorus/i,
  /orkesteri/i,
  /orchestra/i,
  /kamarimusiik/i,
  /barokki/i,
  /sibelius/i,
];

const ADULT_VENUES = [
  /tanssin talo/i,
  /q-?teatteri/i,
  /ryhmateatteri/i,
  /kansallisteatteri/i,
  /helsingin kaupunginteatteri/i,
  /\bhkt\b/i,
  /svenska teatern/i,
];

const ADULT_NAME_KEYS = [
  /musikaali/i,
  /musical/i,
  /draama/i,
  /komedia/i,
  /stand[- ]?up/i,
  /jazz/i,
  /soul/i,
  /blues/i,
];

const BUSINESS_VENUES = [
  /messukeskus/i,
  /finlandia[- ]?talo/i,
  /paasitorni/i,
  /scandic[- ]?marina/i,
  /clarion[- ]?congress/i,
  /kalastajatorppa/i,
  /hilton/i,
];

const BUSINESS_NAME_KEYS = [
  /konferenssi/i,
  /conference/i,
  /summit/i,
  /forum/i,
  /messut/i,
  /expo/i,
  /gaala/i,
  /gala/i,
  /kongressi/i,
  /seminar/i,
  /seminaari/i,
  /b2b/i,
];

const YOUNG_ADULT_VENUES = [
  /tavastia/i,
  /klubi/i,
  /kuudes linja/i,
  /korjaamo/i,
  /g livelab/i,
  /apollo/i,
  /\bbar\b/i,
  /helsinki halli/i,
  /nordis/i,
  /jaahalli/i,
  /jäähalli/i,
];

const YOUNG_ADULT_NAME_KEYS = [
  /\brock\b/i,
  /\bpop\b/i,
  /\bindie\b/i,
  /\bdj\b/i,
  /\brap\b/i,
  /\bhip[- ]?hop\b/i,
  /\belectro/i,
  /\bclub\b/i,
  /klubi/i,
];

const YOUTH_NAME_KEYS = [
  /\bk-?15\b/i,
  /\bk-?18\b/i,
  /festival/i,
  /festivaali/i,
  /metal/i,
  /punk/i,
  /\brave\b/i,
  /\bedm\b/i,
  /\btrap\b/i,
];

const FAMILY_NAME_KEYS = [
  /lasten/i,
  /perhe/i,
  /muumi/i,
  /pikku/i,
  /satukirja/i,
  /\bk-?0\b/i,
];

function matches(re: RegExp[], text: string): boolean {
  return re.some((r) => r.test(text));
}

/**
 * Pisteyta tapahtuma kuljettajan kannalta.
 * Korkea taxiAffinity (>=70): senior/adult/business + iso venue
 * Keskiluokka (50-69): young_adult kulttuuri-/iltatapahtumissa
 * Matala (<50): family / katukulttuuri / aamupaivatapahtumat
 */
export function profileAudience(name: string, venue: string, capacity?: number, startIso?: string): AudienceProfile {
  const txt = `${name} ${venue}`;
  const segments: AudienceSegment[] = [];
  let affinity = 40; // perusarvo
  let primary = "30-65";
  const reasons: string[] = [];

  // 1) Senior — voimakkain boost
  if (matches(SENIOR_VENUES, txt) || matches(SENIOR_NAME_KEYS, txt)) {
    segments.push("senior");
    affinity = Math.max(affinity, 85);
    primary = "55-85";
    reasons.push("klassinen/seniori-yleisö");
  }

  // 2) Adult kulttuuri
  if (matches(ADULT_VENUES, txt) || matches(ADULT_NAME_KEYS, txt)) {
    segments.push("adult");
    affinity = Math.max(affinity, 75);
    if (primary === "30-65") primary = "35-70";
    reasons.push("aikuisyleisö");
  }

  // 3) Business
  if (matches(BUSINESS_VENUES, txt) || matches(BUSINESS_NAME_KEYS, txt)) {
    segments.push("business");
    affinity = Math.max(affinity, 80);
    primary = "30-60";
    reasons.push("business-asiakkaita");
  }

  // 4) Young adult
  if (matches(YOUNG_ADULT_VENUES, txt) || matches(YOUNG_ADULT_NAME_KEYS, txt)) {
    segments.push("young_adult");
    if (affinity < 60) affinity = 60;
    if (segments.length === 1) primary = "22-40";
    reasons.push("klubi-/iltayleisö");
  }

  // 5) Youth (vähentää taksitodennäköisyyttä)
  if (matches(YOUTH_NAME_KEYS, txt)) {
    segments.push("youth");
    affinity = Math.min(affinity, 50);
    primary = "16-30";
    reasons.push("nuori yleisö");
  }

  // 6) Family (vähentää voimakkaasti)
  if (matches(FAMILY_NAME_KEYS, txt)) {
    segments.push("family");
    affinity = Math.min(affinity, 25);
    primary = "5-45";
    reasons.push("perhetapahtuma");
  }

  // Iltatapahtumat (>=18:00) saavat lievän boostin — enemmän taksia
  if (startIso) {
    const h = new Date(startIso).getHours();
    if (h >= 18 && h <= 23) {
      affinity = Math.min(100, affinity + 10);
      reasons.push("iltatapahtuma");
    } else if (h < 11) {
      affinity = Math.max(10, affinity - 15);
      reasons.push("aamupäivä");
    }
  }

  // Iso kapasiteetti = enemmän asiakkaita absoluuttisesti
  if (capacity && capacity >= 1000) {
    affinity = Math.min(100, affinity + Math.min(15, Math.floor(capacity / 1000) * 3));
  }

  if (segments.length === 0) segments.push("mixed");

  // Tag UI:lle
  let taxiTag: string | undefined;
  if (segments.includes("business")) taxiTag = "BUSINESS";
  else if (segments.includes("senior")) taxiTag = "TAKSIYLEISÖ";
  else if (affinity >= 80) taxiTag = "TAKSIBOOST";
  else if (affinity >= 65) taxiTag = "POTENTIAALI";

  return {
    segments,
    primaryAge: primary,
    taxiAffinity: affinity,
    taxiTag,
    reason: reasons.join(" • ") || "yleisötapahtuma",
  };
}
