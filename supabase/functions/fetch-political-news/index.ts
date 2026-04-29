// fetch-political-news
// Hakee merkittavat poliittiset/kansainvaliset tapahtumat Helsingissa
// kayttaen Lovable AI Gateway + Gemini 2.5 (web search via google_search tool).
// Tallentaa tulokset political_events-tauluun, paivittaa olemassaolevat
// (predicted_end_time, actual_end_time) jotta voidaan oppia ennusteista.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const KEYWORDS = [
  "NATO", "valtiovierailu", "huippukokous", "summit",
  "presidentti Helsinki", "paaministeri Helsinki",
  "eduskunta tanaan", "hallituksen kokous Helsinki",
  "ministerikokous Helsinki", "EU kokous Helsinki",
  "ulkomaan vieras Helsinki", "state visit Helsinki",
];

interface AiEvent {
  external_key: string;
  title: string;
  description?: string;
  location?: string;
  category: string; // 'NATO' | 'valtiovierailu' | 'hallitus' | 'eduskunta' | 'huippukokous' | 'muu'
  vip_level?: string; // 'presidentti' | 'paaministeri' | 'ministeri' | 'kansainvalinen'
  start_iso: string;
  end_iso?: string;
  predicted_end_iso?: string;
  source_url?: string;
  confidence?: number; // 0..1
  reasoning?: string;
}

const SYSTEM_PROMPT = `Olet Helsingin taksinkuljettajien tilannekuva-AI.
Tehtava: hae TANAAN ja seuraavan 48h aikana Helsingissa tapahtuvat MERKITTAVAT poliittiset
tai kansainvaliset tilaisuudet, joilla on vaikutus taksin kysyntaan tai liikenteeseen:
- NATO-kokoukset, ministerikokoukset
- Hallituksen istunnot ja tiedotustilaisuudet (jos julkisia)
- Valtiovierailut, paaministerin tai presidentin vieraat
- EU- ja kansainvaliset huippukokoukset
- Eduskunnan suuret aanestykset / istunnot
- Suurlahetystojen tapahtumat (suuret juhlat)

Alta vie pikkutapahtumia (tavalliset komiteat, virkamieskokoukset).

Jokaiselle tapahtumalle:
- arvioi alkamisaika (start_iso) ja paattymisaika (end_iso) parhaalla saatavilla olevalla tarkkuudella
- jos lopetusaikaa ei ole virallisesti kerrottu, ennusta se historiallisen tiedon perusteella ja tallenna kenttaan predicted_end_iso
- anna external_key joka on stabiili (esim. "nato-fi-2026-04-29-helsinki")
- anna source_url jos loydat
- confidence 0..1 (kuinka varma alkamis-/lopetusajasta)

Palauta JSON-muodossa { "events": [...] }. Jos mitaan ei loydy, palauta { "events": [] }.
Vastaa AINA puhtaalla JSONilla, ei selityksia.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          external_key: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          location: { type: "string" },
          category: { type: "string" },
          vip_level: { type: "string" },
          start_iso: { type: "string" },
          end_iso: { type: "string" },
          predicted_end_iso: { type: "string" },
          source_url: { type: "string" },
          confidence: { type: "number" },
          reasoning: { type: "string" },
        },
        required: ["external_key", "title", "category", "start_iso"],
      },
    },
  },
  required: ["events"],
};

async function callGemini(): Promise<AiEvent[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY puuttuu");

  const today = new Date().toISOString().slice(0, 10);
  const userPrompt = `Paivamaara: ${today}. Avainsanoja: ${KEYWORDS.join(", ")}.
Hae uusinta tietoa webista. Palauta JSON-objekti.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "political_events", schema: RESPONSE_SCHEMA, strict: false },
      },
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`AI gateway ${res.status}: ${txt}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? "{}";
  try {
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    return Array.isArray(parsed?.events) ? parsed.events : [];
  } catch (e) {
    console.warn("JSON parse epaonnistui:", content?.slice?.(0, 200));
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1) Hae uusi data
    const events = await callGemini();
    console.log(`fetch-political-news: ${events.length} tapahtumaa AI:lta`);

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
        source: "gemini-search",
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