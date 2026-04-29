/**
 * scrape-klubi
 *
 * Hakee Helsingin Suomalaisen Klubin tapahtumat
 * (https://tapahtumat.klubi.fi/tapahtumat/) ja palauttaa ne JSON-listana.
 * Sivu on palvelinpuolelta renderoitu (ei JS-vaatimusta), joten suora
 * fetch + regex-parsinta riittaa.
 *
 * Palauttaa myos kentan "soldOut" josta paatellaan loppuunmyynti
 * "Ilmoittautuminen päättynyt"/"Loppuunmyyty" -tekstista jos sellainen
 * loytyy.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface KlubiEvent {
  url: string;
  title: string;
  startIso: string;
  time: string;       // HH:MM
  venue: string;
  summary: string;
  soldOut: boolean;
  price?: string;
  source: "klubi";
}

const MONTHS: Record<string, number> = {
  tammikuu: 0, helmikuu: 1, maaliskuu: 2, huhtikuu: 3, toukokuu: 4, kesäkuu: 5,
  heinäkuu: 6, elokuu: 7, syyskuu: 8, lokakuu: 9, marraskuu: 10, joulukuu: 11,
};

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&euro;/g, "€")
    .replace(/&aring;/g, "å")
    .replace(/&auml;/g, "ä")
    .replace(/&ouml;/g, "ö")
    .replace(/&Aring;/g, "Å")
    .replace(/&Auml;/g, "Ä")
    .replace(/&Ouml;/g, "Ö");
}

function stripTags(s: string): string {
  return decodeEntities(
    s
      .replace(/<br\s*\/?>(\n|\s)*/g, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function parseHtml(html: string): KlubiEvent[] {
  const events: KlubiEvent[] = [];

  // Toimintaperiaate: kayda tapuDay-kohdat lapi (paiva sisaltaa kaikki sen
  // paivan tapahtumat), ja jokaisen tapuDay-kohdan jalkeen poimia kaikki
  // tapuEvent-blokit kunnes seuraava tapuDay tai monthWrapperin loppu tulee.
  // Aikaisempi versio yritti käyttää sisäkkäisiä regexejä joiden lookahead
  // ei mätsännyt; nyt etsitään suoraan tapuDay-tageja koko HTML:sta.

  const dayHeaderRe =
    /<h3 class='tapuDay'>[a-zäö]+,\s*(\d{2})\.(\d{2})\.(\d{4})<\/h3>/g;
  const dayMatches: { day: number; month: number; year: number; idx: number; endIdx: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = dayHeaderRe.exec(html)) !== null) {
    dayMatches.push({
      day: parseInt(m[1], 10),
      month: parseInt(m[2], 10) - 1,
      year: parseInt(m[3], 10),
      idx: m.index + m[0].length,
      endIdx: -1,
    });
  }
  for (let i = 0; i < dayMatches.length; i++) {
    dayMatches[i].endIdx = i + 1 < dayMatches.length ? dayMatches[i + 1].idx : html.length;
  }

  for (const d of dayMatches) {
    const chunk = html.slice(d.idx, d.endIdx);
    // Poimi kaikki tapuEvent-blokit. Ne paattyvat aina </div></div> joka
    // sulkee tapuEventDetails + tapuEvent.
    const eventRe =
      /<div class='tapuEvent[^']*'>([\s\S]*?)<\/div><\/div>/g;
    let e: RegExpExecArray | null;
    while ((e = eventRe.exec(chunk)) !== null) {
      const block = e[1];
      const timeMatch = block.match(/<p class='tapuEventTime'>(\d{1,2}:\d{2})<\/p>/);
      const titleMatch = block.match(/<h2>\s*<a href='([^']+)'>([\s\S]*?)<\/a>\s*<\/h2>/);
      if (!timeMatch || !titleMatch) continue;

      const priceMatch = block.match(/<p class='tapuEventPrice'>([^<]+)<\/p>/);
      const venueMatch = block.match(/<span class='tapuEventLocation'>([^<]+)<\/span>/);
      const summaryMatch = block.match(/<p class='tapuEventSummary'>([\s\S]*?)<\/p>/);

      const url = titleMatch[1].startsWith("http")
        ? titleMatch[1]
        : `https://tapahtumat.klubi.fi${titleMatch[1]}`;
      const title = stripTags(titleMatch[2]);
      const venue = stripTags(venueMatch?.[1] || "Suomalainen Klubi");
      const summary = summaryMatch ? stripTags(summaryMatch[1]) : "";

      const [hh, mm] = timeMatch[1].split(":").map(Number);
      const dt = new Date(d.year, d.month, d.day, hh, mm, 0, 0);

      const all = `${title} ${summary}`.toLowerCase();
      const soldOut =
        /loppuunmyyty|ilmoittautuminen p[äa]ättynyt|t[äa]ynn[äa]|tayttynyt|paikat varattu/.test(
          all,
        );

      events.push({
        url,
        title,
        startIso: dt.toISOString(),
        time: timeMatch[1],
        venue,
        summary: summary.slice(0, 240),
        soldOut,
        price: priceMatch?.[1]?.trim().replace(/&euro;/g, "€"),
        source: "klubi",
      });
    }
  }

  return events;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const res = await fetch("https://tapahtumat.klubi.fi/tapahtumat/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (HelsinkiTaxiPulse) Klubi-events-fetcher",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: `Klubi HTTP ${res.status}`, events: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const html = await res.text();
    const all = parseHtml(html);

    // Suodata: vain tasta hetkesta 7 paivan paahan
    const now = Date.now();
    const max = now + 7 * 24 * 3600_000;
    const upcoming = all.filter((e) => {
      const t = new Date(e.startIso).getTime();
      return t >= now - 30 * 60_000 && t <= max;
    });

    return new Response(
      JSON.stringify({
        ok: true,
        events: upcoming,
        totalParsed: all.length,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        events: [],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
