import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TrainBulletin {
  id: string;
  trainNumber?: number;
  trainNumbers?: number[];
  stations: string[];
  text: string;
  endValidity?: string;
}

export async function fetchTrainBulletins(): Promise<TrainBulletin[]> {
  try {
    const { data, error } = await supabase.functions.invoke("fetch-train-bulletins");
    if (error) throw error;
    return data?.bulletins ?? [];
  } catch (err) {
    console.warn("train bulletins fetch failed:", err);
    return [];
  }
}

export function useTrainBulletins(refreshMs = 120_000) {
  const [bulletins, setBulletins] = useState<TrainBulletin[]>([]);
  const refresh = useCallback(async () => {
    setBulletins(await fetchTrainBulletins());
  }, []);
  useEffect(() => {
    refresh();
    const i = setInterval(refresh, refreshMs);
    return () => clearInterval(i);
  }, [refresh, refreshMs]);
  return { bulletins, refresh };
}