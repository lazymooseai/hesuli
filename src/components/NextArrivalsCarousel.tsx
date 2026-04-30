import { TrainFront, Ship, Plane, ChevronRight } from "lucide-react";
import { useDashboard } from "@/context/DashboardContext";

/**
 * Horizontal swipe carousel: next 1–2 trains/ships/flights in arrival order.
 * Compact cards optimized for arm's-length glance.
 */
const NextArrivalsCarousel = () => {
  const { state } = useDashboard();

  type Item = {
    key: string;
    kind: "train" | "ship" | "flight";
    title: string;
    sub: string;
    time: string;
    delay?: number;
    pax?: number;
  };

  const items: Item[] = [];

  state.trainDelays.slice(0, 3).forEach((t) => {
    items.push({
      key: `tr-${t.id}`,
      kind: "train",
      title: t.line,
      sub: t.origin,
      time: t.arrivalTime,
      delay: t.delayMinutes,
      pax: t.capacity,
    });
  });
  state.shipArrivals.slice(0, 3).forEach((s) => {
    items.push({
      key: `sh-${s.id}`,
      kind: "ship",
      title: s.ship,
      sub: s.harbor,
      time: s.eta,
      pax: s.estimatedPax ?? s.pax,
    });
  });
  state.flights.slice(0, 3).forEach((f) => {
    items.push({
      key: `fl-${f.id}`,
      kind: "flight",
      title: f.flightNumber,
      sub: f.origin,
      time: f.estimatedTime,
      delay: f.delayMinutes,
    });
  });

  // Sort by time HH:MM
  items.sort((a, b) => a.time.localeCompare(b.time));
  const top = items.slice(0, 8);

  if (top.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-6 text-center text-muted-foreground">
        Ei tulevia saapujia
      </div>
    );
  }

  const iconFor = (kind: Item["kind"]) => {
    if (kind === "train") return <TrainFront className="h-6 w-6" />;
    if (kind === "ship") return <Ship className="h-6 w-6" />;
    return <Plane className="h-6 w-6" />;
  };

  return (
    <div className="-mx-4">
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory px-4 pb-2 scrollbar-none">
        {top.map((it) => {
          const delayed = (it.delay ?? 0) > 5;
          const onTime = (it.delay ?? 0) <= 0;
          return (
            <div
              key={it.key}
              className={`snap-start shrink-0 w-[78%] rounded-xl border-l-4 border border-border bg-card px-4 py-4 ${
                delayed ? "border-l-destructive" : onTime ? "border-l-primary" : "border-l-accent"
              }`}
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                {iconFor(it.kind)}
                <span className="text-xs font-black uppercase tracking-widest">
                  {it.kind === "train" ? "Juna" : it.kind === "ship" ? "Laiva" : "Lento"}
                </span>
                <ChevronRight className="h-4 w-4 ml-auto opacity-50" />
              </div>
              <p className="mt-2 font-black text-2xl text-foreground truncate">{it.title}</p>
              <p
                className={`text-sm text-muted-foreground font-bold ${
                  it.kind === "flight" ? "break-words leading-snug" : "truncate"
                }`}
              >
                {it.sub}
              </p>
              <div className="mt-2 flex items-end justify-between gap-2">
                <span
                  className={`font-mono font-black text-4xl ${
                    delayed ? "text-destructive" : onTime ? "text-primary" : "text-accent"
                  }`}
                >
                  {it.time}
                </span>
                <div className="text-right">
                  {it.delay !== undefined && it.delay > 0 && (
                    <span className="block text-xs font-black text-destructive">
                      +{it.delay} min
                    </span>
                  )}
                  {it.pax !== undefined && it.pax > 0 && (
                    <span className="block text-xs text-muted-foreground font-bold">
                      {it.pax.toLocaleString("fi-FI")} hlö
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NextArrivalsCarousel;