/**
 * klubiEvents.ts
 *
 * Asiakaspuolen wrapper scrape-klubi -edge functionille.
 * Mappaa Klubin tapahtumat EventInfo-tyyppiin.
 */

import { supabase } from "@/integrations/supabase/client";
import type { EventInfo } from "./types";

interface KlubiRaw {
  url: string;
  title: string;
  startIso: string;
  time: string;
  venue: string;
  summary: string;
  soldOut: boolean;
  price?: string;
  source: "klubi";
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

/** Hae Klubi-tapahtumat. Hiljainen virhe (palauttaa tyhjan listan). */
export async function fetchKlubiEvents(): Promise<EventInfo[]> {
  try {
    const { data, error } = await supabase.functions.invoke("scrape-klubi");
    if (error) {
      console.warn("scrape-klubi epaonnistui:", error.message);
      return [];
    }
    const events = ((data as { events?: KlubiRaw[] })?.events ?? []) as KlubiRaw[];
    return events.map((e) => {
      const level: "red" | "amber" | "green" = e.soldOut ? "red" : "amber";
      return {
        id: `klubi-${e.url}`,
        name: e.title,
        venue: e.venue,
        endsIn: 0,
        soldOut: e.soldOut,
        demandTag: e.soldOut ? "TÄYNNÄ" : "KLUBI",
        demandLevel: level,
        startTime: e.time,
        startIso: e.startIso,
        availabilityNote: e.summary || (e.price ? `Hinta ${e.price}` : undefined),
        infoUrl: e.url,
      };
    });
  } catch (err) {
    console.warn("Klubi fetch poikkeus:", err);
    return [];
  }
}
