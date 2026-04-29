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

function parseHtml(html: string): KlubiEvent[] {
  const events: KlubiEvent[] = [];

  // Pilko monthWrapper-osioihin saadaksemme vuosi+kuukausi
  const monthRe = /<h2 class='tapuMonth'>([A-Za-zäöÄÖ]+)\s+(\d{4})<\/h2>([\s\S]*?)(?=<h2 class='tapuMonth'>|<\/div>\s*<\/div>\s*<\/div>\s*$)/g;
  let mMatch: RegExpExecArray | null;
  while ((mMatch = monthRe.exec(html)) !== null) {
    const monthName = mMatch[1].toLowerCase();
    const year = parseInt(mMatch[2], 10);
    const monthChunk = mMatch[3];
    const monthIdx = MONTHS[monthName];
    if (monthIdx == null) continue;

    // Pilko paivakohtaisiin lohkoihin
    const dayRe = /<h3 class='tapuDay'>[a-zäö]+,\s*(\d{2})\.(\d{2})\.(\d{4})<\/h3>([\s\S]*?)(?=<h3 class='tapuDay'>|$)/g;
    let dMatch: RegExpExecArray | null;
    while ((dMatch = dayRe.exec(monthChunk)) !== null) {
      const day = parseInt(dMatch[1], 10);
      const month = parseInt(dMatch[2], 10) - 1;
      const yr = parseInt(dMatch[3], 10);
      if (month !== monthIdx || yr !== year) {
        // Datepalat ristiriidassa — luota datepalan paivamaaraan
      }
      const dayChunk = dMatch[4];

      // Yksittaiset tapahtumat
      const eventRe = /<div class='tapuEvent[^']*'>([\s\S]*?)<\/div><\/div>/g;
      let eMatch: RegExpExecArray | null;
      while ((eMatch = eventRe.exec(dayChunk)) !== null) {
        const block = eMatch[1];
        const timeMatch = block.match(/<p class='tapuEventTime'>(\d{1,2}:\d{2})<\/p>/);
        const priceMatch = block.match(/<p class='tapuEventPrice'>([^<]+)<\/p>/);
        const titleMatch = block.match(/<h2><a href='([^']+)'>([\s\S]*?)<\/a><\/h2>/);
        const venueMatch = block.match(/<span class='tapuEventLocation'>([^<]+)<\/span>/);
        const summaryMatch = block.match(/<p class='tapuEventSummary'>([\s\S]*?)<\/p>/);

        if (!titleMatch || !timeMatch) continue;
        const url = titleMatch[1].startsWith("http")
          ? titleMatch[1]
          : `https://tapahtumat.klubi.fi${titleMatch[1]}`;
        const title = titleMatch[2].replace(/<[^>]+>/g, "").trim();
        const venue = (venueMatch?.[1] || "Suomalainen Klubi").trim();
        const summaryRaw = (summaryMatch?.[1] || "")
          .replace(/<br\s*\/?>(\n|\s)*/g, " ")
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim();

        const [hh, mm] = timeMatch[1].split(":").map(Number);
        const dt = new Date(yr, month, day, hh, mm, 0, 0);

        const lowerAll = `${title} ${summaryRaw}`.toLowerCase();
        const soldOut =
          /loppuunmyyty|ilmoittautuminen p[äa]ättynyt|täynnä|tayttynyt|paikat varattu/.test(
            lowerAll
          );

        events.push({
          url,
          title,
          startIso: dt.toISOString(),
          time: timeMatch[1],
          venue,
          summary: summaryRaw.slice(0, 240),
          soldOut,
          price: priceMatch?.[1]?.trim().replace(/&euro;/g, "€"),
          source: "klubi",
        });
      }
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
