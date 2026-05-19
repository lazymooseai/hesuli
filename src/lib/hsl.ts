import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface HslAlert {
  id: string;
  headerText: string;
  descriptionText: string;
  severity: string;
  effectiveStartDate: number;
  effectiveEndDate: number;
  isTransitCritical: boolean;
}

const TRANSIT_KEYWORDS = ["metro", "juna", "train", "raitiotie", "tram", "raitiovaunu"];
const SERVICE_DISRUPTION_KEYWORDS = [
  "häiriö",
  "poikkeus",
  "poikki",
  "keskeyt",
  "korvaava",
  "harvempi",
  "ei liikennöidä",
  "peruttu",
  "myöhässä",
  "viiväst",
  "ruuhka",
];
const INFRA_NOISE_KEYWORDS = [
  "liukuport",
  "hissi",
  "pysäkki",
  "pysäkin",
  "laituri",
  "sisäänkäynti",
  "poistetaan käytöstä",
  "siirtyy",
  "yö",
  "öinä",
];

function isTransitCritical(description: string, header: string, severity: string): boolean {
  const text = `${description} ${header}`.toLowerCase();
  const touchesTransit = TRANSIT_KEYWORDS.some((kw) => text.includes(kw));
  if (!touchesTransit) return false;
  if (INFRA_NOISE_KEYWORDS.some((kw) => text.includes(kw))) return false;

  const affectsService = SERVICE_DISRUPTION_KEYWORDS.some((kw) => text.includes(kw));
  return severity === "SEVERE" && affectsService;
}

export async function fetchHslAlerts(): Promise<HslAlert[]> {
  try {
    const { data, error } = await supabase.functions.invoke('fetch-hsl-alerts');
    if (error) throw new Error(`HSL alerts proxy error: ${error.message}`);

    const alerts = data?.alerts ?? [];

    return alerts.map((a: any, i: number) => {
      const severity = a.alertSeverityLevel || "WARNING";
      return {
      id: a.id || `hsl-alert-${i}`,
      headerText: a.alertHeaderText || "",
      descriptionText: a.alertDescriptionText || "",
      severity,
      effectiveStartDate: a.effectiveStartDate || 0,
      effectiveEndDate: a.effectiveEndDate || 0,
      isTransitCritical: isTransitCritical(a.alertDescriptionText || "", a.alertHeaderText || "", severity),
    };
    });
  } catch (err) {
    console.warn("HSL alerts fetch failed:", err);
    return [];
  }
}

export function useHslAlerts(refreshIntervalMs = 60000) {
  const [alerts, setAlerts] = useState<HslAlert[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const fetched = await fetchHslAlerts();
    setAlerts(fetched);
    setDismissedIds((prev) => {
      const activeIds = new Set(fetched.map((a) => a.id));
      const next = new Set<string>();
      prev.forEach((id) => { if (activeIds.has(id)) next.add(id); });
      return next;
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [refresh, refreshIntervalMs]);

  const visibleAlerts = alerts.filter((a) => !dismissedIds.has(a.id));

  return { alerts: visibleAlerts, allAlerts: alerts, dismiss, refresh };
}
