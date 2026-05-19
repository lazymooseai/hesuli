import { AlertTriangle, TrainFront, Plane, Ship, Bus, ExternalLink, Megaphone, Clock } from "lucide-react";
import { useDashboard } from "@/context/DashboardContext";
import { useHslAlerts } from "@/lib/hsl";
import { useTrainBulletins } from "@/lib/trainBulletins";
import { openExternal } from "@/lib/openExternal";

/**
 * DisruptionsCard
 *
 * Yhdistetty hairiotiedote-kortti: HSL (metro/juna/raitiotie),
 * Fintraffic-junat (>10 min myöhässä), lennot (>30 min) ja laivat
 * (jos ETA siirtynyt). Tarjoaa nopean katsauksen kuljettajalle siitä,
 * mistä saattaa tulla yllättävää kysyntää tai esteitä.
 */
const DisruptionsCard = ({ criticalOnly = false }: { criticalOnly?: boolean }) => {
  const { state } = useDashboard();
  const { alerts } = useHslAlerts(60_000);

  const { bulletins } = useTrainBulletins(120_000);

  const fmtClock = (ms: number) => {
    const d = new Date(ms);
    return new Intl.DateTimeFormat("fi-FI", {
      timeZone: "Europe/Helsinki",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  };

  const fmtAgo = (ms: number) => {
    const diffMin = Math.round((Date.now() - ms) / 60000);
    if (diffMin < 1) return "juuri nyt";
    if (diffMin < 60) return `${diffMin} min sitten`;
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return m === 0 ? `${h} h sitten` : `${h} h ${m} min sitten`;
  };

  const fmtRemaining = (ms: number) => {
    const diffMin = Math.round((ms - Date.now()) / 60000);
    if (diffMin <= 0) return null;
    if (diffMin < 60) return `${diffMin} min`;
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    if (h >= 24) {
      const days = Math.floor(h / 24);
      return `${days} pv`;
    }
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
  };

  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
  const nowMs = Date.now();
  const hslItems = alerts
    .filter((a) => {
      const startMs = a.effectiveStartDate ? a.effectiveStartDate * 1000 : 0;
      return startMs === 0 || nowMs - startMs <= TWO_HOURS_MS;
    })
    .map((a) => {
    const startMs = a.effectiveStartDate ? a.effectiveStartDate * 1000 : 0;
    const endMs = a.effectiveEndDate ? a.effectiveEndDate * 1000 : 0;
    return {
      key: `hsl-${a.id}`,
      icon: <Bus className="h-5 w-5" />,
      label: a.isTransitCritical ? "HSL HÄIRIÖ" : "HSL VAROITUS",
      text: a.headerText || a.descriptionText,
      level: a.isTransitCritical ? ("red" as const) : ("amber" as const),
      url: "https://www.hsl.fi/liikenne/poikkeusinfo",
      issuedAtMs: startMs && startMs <= Date.now() ? startMs : 0,
      validUntilMs: endMs || 0,
    };
  });

  const trainItems = state.trainDelays
    .filter((t) => t.cancelled || t.delayMinutes >= 10)
    .slice(0, 5)
    .map((t) => ({
      key: `train-${t.id}`,
      icon: <TrainFront className="h-5 w-5" />,
      label: t.cancelled ? "JUNA PERUTTU" : "JUNA MYÖHÄSSÄ",
      text: t.cancelled
        ? `${t.line} ${t.origin} (oli saap. ${t.arrivalTime})`
        : `${t.line} ${t.origin} +${t.delayMinutes} min (saap. ${t.arrivalTime})`,
      level: t.cancelled || t.delayMinutes >= 30 ? ("red" as const) : ("amber" as const),
      url: "https://junalahdot.fi/?station=HKI",
      issuedAtMs: 0,
      validUntilMs: 0,
    }));

  const bulletinItems = bulletins
    .filter((b) => {
      const startMs = b.startValidity ? new Date(b.startValidity).getTime() : 0;
      // Näytetään vain jos tiedote on julkaistu enintään 2 h sitten
      return startMs > 0 && nowMs - startMs <= TWO_HOURS_MS;
    })
    .slice(0, 5)
    .map((b) => {
    const startMs = b.startValidity ? new Date(b.startValidity).getTime() : 0;
    const endMs = b.endValidity ? new Date(b.endValidity).getTime() : 0;
    return {
      key: `bulletin-${b.id}`,
      icon: <Megaphone className="h-5 w-5" />,
      label: "VR TIEDOTE",
      text: b.trainNumber ? `Juna ${b.trainNumber}: ${b.text}` : b.text,
      level: "amber" as const,
      url: "https://www.vr.fi/asiakaspalvelu/poikkeustilanteet",
      issuedAtMs: startMs && startMs <= Date.now() ? startMs : 0,
      validUntilMs: endMs,
    };
  });

  const flightItems = state.flights
    .filter((f) => f.delayMinutes >= 30)
    .slice(0, 5)
    .map((f) => ({
      key: `flight-${f.id}`,
      icon: <Plane className="h-5 w-5" />,
      label: "LENTO MYÖHÄSSÄ",
      text: `${f.flightNumber} ${f.origin} +${f.delayMinutes} min (saap. ${f.estimatedTime})`,
      level: f.delayMinutes >= 60 ? ("red" as const) : ("amber" as const),
      url: `https://www.finavia.fi/fi/lentoasemat/helsinki-vantaa/lennot?tab=arr&flight=${encodeURIComponent(f.flightNumber)}`,
      issuedAtMs: 0,
      validUntilMs: 0,
    }));

  // Laivahäiriö: ETA tunnin päässä mutta useita aluksia samaan terminaaliin
  // tai laiva > 2500 hlö (poikkeavan suuri kuorma).
  const shipItems = state.shipArrivals
    .filter((s) => (s.estimatedPax ?? s.pax) > 2500)
    .slice(0, 3)
    .map((s) => ({
      key: `ship-${s.id}`,
      icon: <Ship className="h-5 w-5" />,
      label: "ISO LAIVA",
      text: `${s.ship} → ${s.harbor} ${s.eta} • ~${(s.estimatedPax ?? s.pax).toLocaleString("fi-FI")} hlö`,
      level: "amber" as const,
      url: "https://averio.fi/laivat",
      issuedAtMs: 0,
      validUntilMs: 0,
    }));

  let items = [...hslItems, ...bulletinItems, ...trainItems, ...flightItems, ...shipItems];
  if (criticalOnly) {
    items = items.filter((it) => it.level === "red");
  }


  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center">
          <AlertTriangle className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-base font-black text-primary">EI HÄIRIÖITÄ</p>
          <p className="text-sm text-muted-foreground">
            HSL, junat, lennot ja laivat liikkuvat normaalisti.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/40">
        <AlertTriangle className="h-4 w-4 text-destructive animate-flash-icon" />
        <span className="text-xs font-black uppercase tracking-widest text-foreground">
          Häiriötiedote
        </span>
        <span className="ml-auto text-xs font-bold text-muted-foreground">
          {items.length} kpl
        </span>
      </div>
      <ul className="divide-y divide-border">
        {items.map((it) => (
          <li key={it.key}>
            <button
              onClick={() => openExternal(it.url)}
              className={`w-full text-left flex items-start gap-3 px-4 py-3 active:scale-[0.99] transition border-l-4 ${
                it.level === "red" ? "border-l-destructive" : "border-l-accent"
              } hover:bg-muted/40`}
            >
              <div
                className={`shrink-0 mt-0.5 ${
                  it.level === "red" ? "text-destructive" : "text-accent"
                }`}
              >
                {it.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-[11px] font-black uppercase tracking-wider mb-0.5 ${
                    it.level === "red" ? "text-destructive" : "text-accent"
                  }`}
                >
                  {it.label}
                </p>
                <p className="text-base font-bold text-foreground leading-snug">
                  {it.text}
                </p>
                {(it.issuedAtMs > 0 || (it.validUntilMs && fmtRemaining(it.validUntilMs))) && (
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {it.issuedAtMs > 0 && (
                      <span>
                        klo {fmtClock(it.issuedAtMs)} • {fmtAgo(it.issuedAtMs)}
                      </span>
                    )}
                    {it.validUntilMs && fmtRemaining(it.validUntilMs) && (
                      <span className="ml-auto">
                        voimassa vielä {fmtRemaining(it.validUntilMs)}
                      </span>
                    )}
                  </p>
                )}
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DisruptionsCard;