/**
 * politicalEvents.ts
 *
 * Hakee poliittiset/kansainvaliset tapahtumat (NATO, valtiovierailut, hallitus,
 * eduskunta, huippukokoukset) Lovable Cloud -tietokannasta.
 * Edge function fetch-political-news populoi taulun tunneittain.
 */

import { supabase } from "@/integrations/supabase/client";

export interface PoliticalEvent {
  id: string;
  externalKey?: string;
  title: string;
  description?: string;
  location: string;
  category: string; // 'NATO' | 'valtiovierailu' | 'hallitus' | ...
  vipLevel?: string;
  startIso: string;
  endIso?: string;
  predictedEndIso?: string;
  sourceUrl?: string;
  confidence?: number;
  reasoning?: string;
}

/** Hakee 48h ikkunan poliittiset tapahtumat */
export async function fetchPoliticalEvents(): Promise<PoliticalEvent[]> {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const horizon = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("political_events")
    .select("*")
    .gte("start_time", start.toISOString())
    .lte("start_time", horizon.toISOString())
    .order("start_time", { ascending: true });

  if (error) {
    console.warn("fetchPoliticalEvents error:", error.message);
    return [];
  }

  type Row = {
    id: string;
    external_key: string | null;
    title: string;
    description: string | null;
    location: string | null;
    category: string;
    vip_level: string | null;
    start_time: string;
    end_time: string | null;
    predicted_end_time: string | null;
    source_url: string | null;
    confidence: number | null;
    reasoning: string | null;
  };

  return (data as Row[] | null ?? []).map((r) => ({
    id: r.id,
    externalKey: r.external_key ?? undefined,
    title: r.title,
    description: r.description ?? undefined,
    location: r.location ?? "Helsinki",
    category: r.category,
    vipLevel: r.vip_level ?? undefined,
    startIso: r.start_time,
    endIso: r.end_time ?? undefined,
    predictedEndIso: r.predicted_end_time ?? undefined,
    sourceUrl: r.source_url ?? undefined,
    confidence: r.confidence != null ? Number(r.confidence) : undefined,
    reasoning: r.reasoning ?? undefined,
  }));
}

/** Triggeroi hakua kasin (refresh-nappi tai toteumavertailu) */
export async function triggerPoliticalNewsFetch(): Promise<{ ok: boolean; count?: number; error?: string }> {
  const { data, error } = await supabase.functions.invoke("fetch-political-news");
  if (error) return { ok: false, error: error.message };
  return { ok: true, count: (data as { count?: number })?.count ?? 0 };
}

// ---------------------------------------------------------------------------
// Apufunktiot UI:lle
// ---------------------------------------------------------------------------

export function vipBadge(vipLevel?: string): string | undefined {
  if (!vipLevel) return undefined;
  const v = vipLevel.toLowerCase();
  if (v.includes("president")) return "PRESIDENTTI";
  if (v.includes("paaminist") || v.includes("pääminist") || v.includes("pm")) return "PÄÄMINISTERI";
  if (v.includes("minist")) return "MINISTERI";
  if (v.includes("kansainval") || v.includes("nato") || v.includes("eu")) return "KANSAINVÄLINEN";
  return vipLevel.toUpperCase().slice(0, 14);
}

export function categoryLabel(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("nato")) return "NATO";
  if (c.includes("valtio") || c.includes("vierailu") || c.includes("state")) return "VALTIOVIERAILU";
  if (c.includes("huippu") || c.includes("summit")) return "HUIPPUKOKOUS";
  if (c.includes("hallitu") || c.includes("government")) return "HALLITUS";
  if (c.includes("eduskunta") || c.includes("parliament")) return "EDUSKUNTA";
  if (c.includes("eu")) return "EU";
  return category.toUpperCase();
}