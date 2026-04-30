// fetch-political-news
// ILMAINEN versio: hakee merkittävät poliittiset/kansainväliset tapahtumat
// Helsingissä Wikidata SPARQL -kyselyllä. Ei vaadi LLM-credittejä eikä API-avaimia.
//
// Lähteet:
//   1) Wikidata SPARQL — valtiovierailut, huippukokoukset, kansainväliset
//      konferenssit jotka pidetään Helsingissä lähitulevaisuudessa.
//   2) (Best-effort) Eduskunnan tulevat täysistunnot — staattinen viikkokalenteri.
//   3) "Some-agentti": Lovable AI Gateway (Gemini) skannaa lehdistön /
//      sosiaalisen median otsikot Helsingin joukkotapahtumista,
//      järjestyshäiriöistä ja viranomaistoimista (esim. vappuaaton
//      Kaivopuiston tyhjennys). Tallennetaan kategoriaan
//      "joukkotapahtuma" tai "jarjestyshairio".
//
// Tapahtumat upsertataan political_events-tauluun. Jos rivissä on aiempi
// predicted_end_time ja saadaan uusi end_iso, lasketaan end_error_min →
// järjestelmä oppii kuinka hyvin loppuajat ennustettiin.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PoliticalEv {
  external_key: string;
  title: string;
  description?: string;
  location?: string;
  category: string;
  vip_level?: string;
  start_iso: string;
  end_iso?: string;
  predicted_end_iso?: string;
  source_url?: string;
  confidence?: number;
  reasoning?: string;
}

// ---------------------------------------------------------------------------
// Wikidata SPARQL: tapahtumat joilla sijainti = Helsinki ja päivä >= tänään.
// Q1757 = Helsinki. Etsitään konferensseja, huippukokouksia, valtiovierailuja.
// ---------------------------------------------------------------------------

const SPARQL = `
SELECT DISTINCT ?item ?itemLabel ?itemDescription ?date ?endDate ?typeLabel ?article WHERE {
  ?item wdt:P585|wdt:P580 ?date.
  OPTIONAL { ?item wdt:P582 ?endDate. }
  ?item (wdt:P276|wdt:P17) ?place.
  ?place rdfs:label ?placeLabel.
  FILTER(LANG(?placeLabel) IN ("fi","en"))
  FILTER(CONTAINS(LCASE(?placeLabel), "helsink"))
  FILTER(?date >= NOW() && ?date <= "2027-12-31T00:00:00Z"^^xsd:dateTime)
  OPTIONAL { ?item wdt:P31 ?type. }
  OPTIONAL {
    ?article schema:about ?item.
    ?article schema:isPartOf <https://en.wikipedia.org/>.
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fi,en". }
}
ORDER BY ?date
LIMIT 50
`;

interface WdRow {
  item: { value: string };
  itemLabel?: { value: string };
  itemDescription?: { value: string };
  date?: { value: string };
  endDate?: { value: string };
  typeLabel?: { value: string };
  article?: { value: string };
}

async function fetchWikidata(): Promise<PoliticalEv[]> {
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(SPARQL);
  const res = await fetch(url, {
    headers: { "User-Agent": "HelsinkiTaxiPulse/1.0 (political-events)", Accept: "application/sparql-results+json" },
  });
  if (!res.ok) {
    console.warn("Wikidata SPARQL", res.status, await res.text().catch(() => ""));
    return [];
  }
  const data = await res.json() as { results?: { bindings?: WdRow[] } };
  const rows = data.results?.bindings ?? [];
  const events: PoliticalEv[] = [];
  for (const r of rows) {
    if (!r.itemLabel?.value || !r.date?.value) continue;
    const title = r.itemLabel.value;
    const desc = r.itemDescription?.value;
    const start = r.date.value;
    const end = r.endDate?.value;
    const typeLbl = (r.typeLabel?.value || "").toLowerCase();
    const titleLow = title.toLowerCase();

    // Suodata: ohitetaan urheilukisat ja konsertit (eivät ole "poliittisia")
    if (/cup|championship|olymp|tour de|marathon|festival/i.test(title)) continue;

    // Suodata: eduskunta-aiheiset Wikidata-rivit ovat vanhentuneita / vääriä —
    // käyttäjä lisää täysistunnot manuaalisesti Hallinta-välilehdeltä.
    if (/eduskun|parliament|täysistun|taysistun/i.test(title + " " + (typeLbl || ""))) continue;

    // Kategoria-päättely
    let category = "muu";
    let vip: string | undefined;
    if (/state visit|valtiovierailu/.test(titleLow + " " + typeLbl)) {
      category = "valtiovierailu"; vip = "presidentti";
    } else if (/nato/.test(titleLow)) {
      category = "nato"; vip = "kansainvalinen";
    } else if (/summit|huippukokous|g7|g20/.test(titleLow + " " + typeLbl)) {
      category = "huippukokous"; vip = "kansainvalinen";
    } else if (/eu |european council/.test(titleLow + " " + typeLbl)) {
      category = "EU"; vip = "kansainvalinen";
    } else if (/conference|kongressi|konferenssi/.test(titleLow + " " + typeLbl)) {
      category = "konferenssi";
    }

    // Ennustettu loppuaika: jos virallista ei ole, oletetaan 4h kesto
    const startMs = new Date(start).getTime();
    const predictedEnd = end || new Date(startMs + 4 * 3600_000).toISOString();

    const qid = r.item.value.split("/").pop() || title;
    const sourceUrl = r.article?.value || `https://www.wikidata.org/wiki/${qid}`;

    events.push({
      external_key: `wd-${qid}`,
      title,
      description: desc,
      location: "Helsinki",
      category,
      vip_level: vip,
      start_iso: start,
      end_iso: end,
      predicted_end_iso: predictedEnd,
      source_url: sourceUrl,
      confidence: end ? 0.85 : 0.55,
      reasoning: `Wikidata: ${typeLbl || "tapahtuma"}${end ? " (virallinen loppuaika)" : " (ennustettu 4h kesto)"}`,
    });
  }
  return events;
}

/**
 * Eduskunnan vakioistuntoaikataulu (FI):
 *   ti, ke, to klo 14:00 — kestää tyypillisesti ~3-4h
 *   pe klo 13:00 — kyselytunti, ~1h
 * Tuotetaan seuraavan 14 vrk istunnot (kesä-/joulutauot eivät tunnistettu —
 * kuljettaja voi poistaa irrelevantit manuaalisesti).
 */
function eduskuntaSchedule(): PoliticalEv[] {
  const events: PoliticalEv[] = [];
  const now = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    const dow = d.getDay(); // 0=su
    let hour = 0;
    let durMin = 0;
    let label = "";
    if (dow === 2 || dow === 3 || dow === 4) {
      hour = 14; durMin = 210; label = "Eduskunnan täysistunto";
    } else if (dow === 5) {
      hour = 13; durMin = 60; label = "Eduskunnan kyselytunti";
    } else {
      continue;
    }
    // Karkea kesätauko (heinäkuu) ja joulutauko (22.12-7.1)
    const m = d.getMonth();
    const day = d.getDate();
    if (m === 6) continue; // heinäkuu pois
    if ((m === 11 && day >= 22) || (m === 0 && day <= 7)) continue;

    const start = new Date(d);
    start.setHours(hour, 0, 0, 0);
    if (start.getTime() < Date.now()) continue;
    const end = new Date(start.getTime() + durMin * 60_000);
    const ymd = start.toISOString().slice(0, 10);
    events.push({
      external_key: `eduskunta-${ymd}-${hour}`,
      title: label,
      description: "Vakioaikataulu — voi vaihdella valiokuntakäsittelyn mukaan.",
      location: "Eduskuntatalo, Mannerheimintie 30",
      category: "eduskunta",
      vip_level: "kansanedustajat",
      start_iso: start.toISOString(),
      end_iso: undefined,
      predicted_end_iso: end.toISOString(),
      source_url: "https://www.eduskunta.fi/FI/lakiensaataminen/valiokunnat/Sivut/default.aspx",
      confidence: 0.7,
      reasoning: "Vakioaikataulu (ti/ke/to 14:00, pe 13:00)",
    });
  }
  return events;
}

// ---------------------------------------------------------------------------
// Some-agentti — Lovable AI Gateway (Gemini)
//
// Pyytää mallia listaamaan Helsingin alueen "joukkotapahtumat" ja
// "järjestyshäiriöt" lähipäiviltä lehdistön ja some-otsikoiden perusteella:
// esim. vappuaaton Kaivopuiston kokoontumiset ja niiden tyhjennys,
// mielenosoitukset, suuret katujuhlat, festivaalit jotka tuovat satoja
// tuhansia ihmisiä keskustaan.
//
// Mallin tulee palauttaa PUHDAS JSON ilman koodiblokkia.
// ---------------------------------------------------------------------------

interface SocialAiItem {
  title: string;
  description?: string;
  location?: string;
  start_iso: string;
  end_iso?: string;
  category: "joukkotapahtuma" | "jarjestyshairio" | "mielenosoitus" | "festivaali";
  source_url?: string;
  confidence?: number;
  reasoning?: string;
}

async function fetchSocialAgent(): Promise<PoliticalEv[]> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.warn("Some-agentti: LOVABLE_API_KEY puuttuu — ohitetaan");
    return [];
  }

  const today = new Date();
  const horizon = new Date(today.getTime() + 5 * 24 * 3600_000);
  const ymd = (d: Date) => d.toISOString().slice(0, 10);

  const prompt = `Olet helsinkiläisen taksinkuljettajan tilannepäivystäjä.
Listaa Helsingin alueen MERKITTÄVÄT joukkotapahtumat, mielenosoitukset,
järjestyshäiriöt ja viranomaistoimet aikavälillä ${ymd(today)} – ${ymd(horizon)}.
Tarkoitus: kuljettaja osaa välttää tukkeutuneita alueita ja siirtyä
kysynnän perään kun ihmismassat purkautuvat.

Esimerkkejä:
- Vappuaaton kokoontumiset Kaivopuistossa, Ullanlinnanmäellä, Kauppatorilla
  ja niiden poliisin tyhjennykset
- Mielenosoitukset Eduskuntatalolla, Senaatintorilla, Narinkkatorilla
- Suuret katujuhlat, paraatit, kulkueet
- Festivaalit jotka tuovat kymmeniä tuhansia keskustaan
- Suurmielenosoitukset jotka sulkevat keskustan katuja

Jätä pois:
- Tavanomaiset konsertit, teatteriesitykset, urheilukisat (ne ovat jo muissa
  lähteissä)
- Pienet (alle 500 hlö) tapahtumat

Palauta PUHDAS JSON-taulukko (ei koodiblokkia, ei selitystä). Jos et löydä
mitään, palauta tyhjä taulukko []. Esimerkki:
[{"title":"Vappuaaton kokoontuminen Kaivopuistossa","description":"Perinteinen ylioppilaiden vappujuhla; poliisi voi tyhjentää alueen myöhään illalla","location":"Kaivopuisto, Helsinki","start_iso":"2026-04-30T18:00:00+03:00","end_iso":"2026-05-01T03:00:00+03:00","category":"joukkotapahtuma","source_url":"https://yle.fi/...","confidence":0.85,"reasoning":"Vuosittainen perinne, lehdistö raportoi joka vuosi"}]

Käytä ISO 8601 -aikoja Helsinki-aikavyöhykkeessä (+03:00 kesä-, +02:00 talvi).
Älä keksi tapahtumia. Jos epävarmuus on suuri, jätä pois.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Vastaa aina puhtaalla JSON-taulukolla ilman koodiblokkia." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    console.warn("Some-agentti AI", res.status, await res.text().catch(() => ""));
    return [];
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const raw = data.choices?.[0]?.message?.content?.trim() ?? "";
  // Riisu mahdollinen koodiblokki
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

  let items: SocialAiItem[] = [];
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) items = parsed as SocialAiItem[];
  } catch (e) {
    console.warn("Some-agentti JSON parse fail:", e instanceof Error ? e.message : e, "raw:", raw.slice(0, 200));
    return [];
  }

  const events: PoliticalEv[] = [];
  for (const it of items) {
    if (!it.title || !it.start_iso) continue;
    const startMs = Date.parse(it.start_iso);
    if (!Number.isFinite(startMs)) continue;
    if (startMs < Date.now() - 6 * 3600_000) continue; // ei mennyttä
    if (startMs > Date.now() + 7 * 24 * 3600_000) continue;

    // Vakaa avain: kategoria + slug + päivä
    const slug = it.title.toLowerCase().replace(/[^a-zåäö0-9]+/g, "-").slice(0, 40);
    const day = it.start_iso.slice(0, 10);
    const cat = it.category || "joukkotapahtuma";

    events.push({
      external_key: `social-${cat}-${slug}-${day}`,
      title: it.title,
      description: it.description,
      location: it.location || "Helsinki",
      category: cat,
      vip_level: cat === "jarjestyshairio" ? "viranomainen" : undefined,
      start_iso: it.start_iso,
      end_iso: it.end_iso,
      predicted_end_iso: it.end_iso || new Date(startMs + 4 * 3600_000).toISOString(),
      source_url: it.source_url,
      confidence: typeof it.confidence === "number" ? it.confidence : 0.6,
      reasoning: `Some-agentti (Gemini): ${it.reasoning ?? "lehdistöhaku"}`,
    });
  }
  return events;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1) Hae uusi data ilmaisista lähteistä (Wikidata)
    // HUOM: Eduskunnan vakiokalenteri poistettu käytöstä — eduskunta.fi uudistui
    // ja vanhat URLit antavat 404, ja vakioaikataulut eivät pidä paikkaansa
    // (kesätauot, valiokuntakäsittelyt yms). Käyttäjä voi lisätä täysistunnot
    // käsin Hallinta-välilehdeltä jos tarpeen.
    const wd = await fetchWikidata().catch((e) => {
      console.warn("Wikidata fail:", e instanceof Error ? e.message : e);
      return [] as PoliticalEv[];
    });
    // 2) Some-agentti: skannaa lehdistö joukkotapahtumista ja
    //    järjestyshäiriöistä (ilmainen Gemini Lovable AI Gatewayn kautta).
    const socialEvents = await fetchSocialAgent().catch((e) => {
      console.warn("Social agent fail:", e instanceof Error ? e.message : e);
      return [] as PoliticalEv[];
    });
    const events = [...wd, ...socialEvents];
    console.log(`fetch-political-news: wikidata=${wd.length} social=${socialEvents.length}`);

    // Siivoa vanhat eduskunta-cal -rivit kannasta (lähteen poiston jälkeen)
    await supabase
      .from("political_events")
      .delete()
      .eq("source", "eduskunta-cal");

    // Siivoa myös Wikidatasta tulleet eduskunta-rivit (vanhentuneita aikatauluja)
    await supabase
      .from("political_events")
      .delete()
      .or("title.ilike.%eduskun%,title.ilike.%parliament%,title.ilike.%täysistun%,category.eq.eduskunta");

    let inserted = 0;
    let updated = 0;
    const now = new Date().toISOString();

    for (const ev of events) {
      const row = {
        external_key: ev.external_key,
        title: ev.title,
        description: ev.description ?? null,
        location: ev.location ?? "Helsinki",
        category: ev.category ?? "muu",
        vip_level: ev.vip_level ?? null,
        start_time: ev.start_iso,
        end_time: ev.end_iso ?? null,
        predicted_end_time: ev.predicted_end_iso ?? ev.end_iso ?? null,
        source_url: ev.source_url ?? null,
        source: ev.external_key.startsWith("eduskunta-")
          ? "eduskunta-cal"
          : ev.external_key.startsWith("social-")
          ? "social-agent"
          : "wikidata",
        confidence: ev.confidence ?? null,
        reasoning: ev.reasoning ?? null,
        fetched_at: now,
      };

      // upsert by external_key
      const { data: existing } = await supabase
        .from("political_events")
        .select("id, predicted_end_time, actual_end_time")
        .eq("external_key", ev.external_key)
        .maybeSingle();

      if (existing) {
        // Jos meilla oli ennuste ja nyt saadaan toteutunut paatosaika -> kirjaa virhe
        const update: Record<string, unknown> = { ...row };
        if (ev.end_iso && existing.predicted_end_time && !existing.actual_end_time) {
          const predicted = new Date(existing.predicted_end_time).getTime();
          const actual = new Date(ev.end_iso).getTime();
          update.actual_end_time = ev.end_iso;
          update.end_error_min = Math.round((actual - predicted) / 60000);
          update.evaluated_at = now;
        }
        await supabase.from("political_events").update(update).eq("id", existing.id);
        updated++;
      } else {
        const { error } = await supabase.from("political_events").insert(row);
        if (error) console.warn("insert error:", error.message);
        else inserted++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, count: events.length, inserted, updated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("fetch-political-news error:", e);
    const msg = e instanceof Error ? e.message : "unknown";
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});