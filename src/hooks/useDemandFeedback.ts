import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchActiveFeedback, type DemandFeedback } from "@/lib/demandFeedback";

/**
 * Tilaa kuljettajien kysyntaarviot reaaliaikaisesti.
 * Suodattaa pois vanhentuneet 60s valein.
 */
export function useDemandFeedback() {
  const [feedback, setFeedback] = useState<DemandFeedback[]>([]);

  useEffect(() => {
    let mounted = true;
    fetchActiveFeedback().then((list) => {
      if (mounted) setFeedback(list);
    });

    const ch = supabase
      .channel("demand-feedback-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "demand_feedback" },
        () => {
          fetchActiveFeedback().then((list) => {
            if (mounted) setFeedback(list);
          });
        },
      )
      .subscribe();

    const tick = setInterval(() => {
      const now = Date.now();
      setFeedback((prev) =>
        prev.filter((f) => new Date(f.expires_at).getTime() > now),
      );
    }, 60_000);

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
      clearInterval(tick);
    };
  }, []);

  return feedback;
}