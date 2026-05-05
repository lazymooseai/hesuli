import { AlertTriangle, TrainFront, Plane, Ship, Bus, ExternalLink } from "lucide-react";
import { useDashboard } from "@/context/DashboardContext";
import { useHslAlerts } from "@/lib/hsl";
import { openExternal } from "@/lib/openExternal";

/**
 * DisruptionsCard
 *
 * Yhdistetty hairiotiedote-kortti: HSL (metro/juna/raitiotie),
 * Fintraffic-junat (>10 min myöhässä), lennot (>30 min) ja laivat
 * (jos ETA siirtynyt). Tarjoaa nopean katsauksen kuljettajalle siitä,
 * mistä saattaa tulla yllättävää kysyntää tai esteitä.
 */
const DisruptionsCard = () => {
  const { state } = useDashboard();
  const { alerts } = useHslAlerts(60_000);

  const hslItems = alerts.map((a) => ({
    key: `hsl-${a.id}`,
    icon: <Bus className="h-5 w-5" />,
    label: a.isTransitCritical ? "HSL HÄIRIÖ" : "HSL VAROITUS",
    text: a.headerText || a.descriptionText,
    level: a.isTransitCritical ? ("red" as const) : ("amber" as const),
    url: "https://www.hsl.fi/liikenne/poikkeusinfo",
  }));

  const trainItems = state.trainDelays
    .filter((t) => t.delayMinutes >= 10)
    .slice(0, 5)
    .map((t) => ({
      key: `train-${t.id}`,
      icon: <TrainFront className="h-5 w-5" />,
      label: "JUNA MYÖHÄSSÄ",
      text: `${t.line} ${t.origin} +${t.delayMinutes} min (saap. ${t.arrivalTime})`,
      level: t.delayMinutes >= 30 ? ("red" as const) : ("amber" as const),
      url: "https://junalahdot.fi/?station=HKI",
    }));

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
    }));

  const items = [...hslItems, ...trainItems, ...flightItems, ...shipItems];

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