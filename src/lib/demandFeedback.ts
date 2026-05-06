/**
 * demandFeedback.ts
 *
 * Kuljettajien antamat kysyntaarviot. Tallennetaan Lovable Cloudin
 * `demand_feedback`-tauluun. Vanhenee 60 min jalkeen (expires_at).
 * Realtime-paivitykset hoidetaan komponentissa.
 */

import { supabase } from "@/integrations/supabase/client";

export type DemandLevel = "many" | "some" | "few" | "ended";

export const DEMAND_LABEL: Record<DemandLevel, string> = {
  many: "PALJON ASIAKKAITA",
  some: "JONKIN VERRAN",
  few: "VAHAN JALJELLA",
  ended: "TAPAHTUMA LOPPUNUT",
};

export const DEMAND_SHORT: Record<DemandLevel, string> = {
  many: "Paljon",
  some: "Jonkin verran",
  few: "Vahan jaljella",
  ended: "Loppunut",
};

export const DEMAND_COLOR: Record<DemandLevel, string> = {
  many: "text-destructive",
  some: "text-accent",
  few: "text-primary",
  ended: "text-muted-foreground",
};

export interface DemandFeedback {
  id: string;
  card_key: string;
  card_type: string;
  card_label: string | null;
  zone: string | null;
  demand_level: DemandLevel;
  note: string | null;
  expires_at: string;
  created_at: string;
}

function deviceId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let id = localStorage.getItem("device-id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("device-id", id);
    }
    return id;
  } catch {
    return "anon";
  }
}

export async function submitDemandFeedback(input: {
  cardKey: string;
  cardType: string;
  cardLabel?: string;
  zone?: string;
  level: DemandLevel;
  note?: string;
}): Promise<void> {
  const { error } = await supabase.from("demand_feedback").insert({
    card_key: input.cardKey,
    card_type: input.cardType,
    card_label: input.cardLabel ?? null,
    zone: input.zone ?? null,
    demand_level: input.level,
    note: input.note ?? null,
    reported_by_device: deviceId(),
  });
  if (error) throw error;
}

export async function fetchActiveFeedback(): Promise<DemandFeedback[]> {
  const { data, error } = await supabase
    .from("demand_feedback")
    .select("*")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.warn("fetchActiveFeedback epaonnistui:", error);
    return [];
  }
  return (data ?? []) as DemandFeedback[];
}

/** Palauttaa kortille uusimman aktiivisen palautteen (jos on). */
export function latestForCard(
  feedback: DemandFeedback[],
  cardKey: string,
): DemandFeedback | null {
  return feedback.find((f) => f.card_key === cardKey) ?? null;
}