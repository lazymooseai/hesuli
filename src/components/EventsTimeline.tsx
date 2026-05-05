/**
 * EventsTimeline.tsx
 *
 * Yhdistetty 4h aikajananakyma kuljettajalle.
 * 4 valilehtea (Asemat / Kulttuuri / Urheilu / Muut), swaipattavat.
 * Oletuksena Nyt + seuraavat 2h, max 5 itemia per tabi.
 * "Nayta kaikki N" -nappi laajentaa rajaa.
 * "4h" -toggle laajentaa aikaikkunan.
 */

import { useMemo, useState, useEffect } from "react";
import { useSwipeable } from "react-swipeable";
import {
  Plane,
  TrainFront,
  Ship,
  Ticket,
  Trophy,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  Plus,
  ExternalLink,
  Landmark,
  MapPin,
  Pencil,
} from "lucide-react";
import { useDashboard } from "@/context/DashboardContext";
import { TRAIN_STATIONS } from "@/lib/fintraffic";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type EventCategory,
  type TimelineItem,
  eventToTimelineItem,
  flightToTimelineItem,
  shipToTimelineItem,
  trainToTimelineItem,
  sportsToTimelineItem,
  politicalToTimelineItem,
  inWindow,
  withTolppaDistances,
} from "@/lib/eventCategories";
import { useGeolocation } from "@/hooks/useGeolocation";
import { formatTolppaLabel, detectDriverArea, driverAreaLabel, TOLPAT, distanceKm } from "@/lib/tolppaLocations";
import { getManualTolppa, setManualTolppa } from "@/lib/manualTolppaOverrides";
import { isLowTaxiDemandEvent } from "@/lib/eventDemandFilters";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const CATEGORY_ICONS: Record<EventCategory, React.ReactNode> = {
  asemat: <Plane className="h-4 w-4" />,
  kulttuuri: <Ticket className="h-4 w-4" />,
  urheilu: <Trophy className="h-4 w-4" />,
  politiikka: <Landmark className="h-4 w-4" />,
  muut: <Clock className="h-4 w-4" />,
};

const LEVEL_BORDER = {
  red: "border-l-destructive",
  amber: "border-l-accent",
  green: "border-l-primary",
};

const LEVEL_TIME_COLOR = {
  red: "text-destructive text-glow-red",
  amber: "text-accent text-glow-amber",
  green: "text-primary text-glow-green",
};

const ITEM_ICON: Record<TimelineItem["raw"]["kind"], React.ReactNode> = {
  flight: <Plane className="h-5 w-5" />,
  train: <TrainFront className="h-5 w-5" />,
  ship: <Ship className="h-5 w-5" />,
  event: <Ticket className="h-5 w-5" />,
  sports: <Trophy className="h-5 w-5" />,
  political: <Landmark className="h-5 w-5" />,
};

const HARD_LIMIT_PER_TAB = 5;

function isEventLike(item: TimelineItem): boolean {
  return item.raw.kind === "event" || item.raw.kind === "sports" || item.raw.kind === "political";
}

function isTodayUntilMidnight(item: TimelineItem): boolean {
  if (!isItemToday(item) || !isEventLike(item)) return false;
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return item.startMs > -24 * 60 * 60_000 && Date.now() <= end.getTime();
}

/**
 * Pieni popover-pohjainen tolpan korjausnappi. Käyttäjä voi valita
 * lähimmistä 12 tolpasta (jos GPS päällä) tai aakkosellisesta listasta
 * oikean tolpan tapahtumalle. Tallennus localStorageen.
 */
const TolppaEditor = ({ item }: { item: TimelineItem }) => {
  const geo = useGeolocation();
  const [open, setOpen] = useState(false);
  // Lähimmät 16 tolppaa kuljettajan sijainnista, muuten aakkosellisesti.
  const options = useMemo(() => {
    const list = [...TOLPAT];
    if (geo.lat != null && geo.lon != null) {
      list.sort(
        (a, b) =>
          distanceKm(geo.lat, geo.lon, a.lat, a.lon) -
          distanceKm(geo.lat, geo.lon, b.lat, b.lon),
      );
      return list.slice(0, 16);
    }
    list.sort((a, b) => a.name.localeCompare(b.name, "fi"));
    return list;
  }, [geo.lat, geo.lon]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              setOpen(true);
            }
          }}
          className="ml-auto shrink-0 inline-flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
          aria-label="Korjaa tolppa"
        >
          <Pencil className="h-3.5 w-3.5" />
        </span>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-2"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground px-1 pb-1">
          Valitse tolppa
        </p>
        <div className="max-h-64 overflow-y-auto">
          {options.map((t) => (
            <button
              key={t.name}
              onClick={(e) => {
                e.stopPropagation();
                setManualTolppa(item.id, t.name);
                setOpen(false);
              }}
              className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted truncate"
            >
              {formatTolppaLabel(t)}
            </button>
          ))}
        </div>
        <div className="border-t border-border mt-1 pt-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setManualTolppa(item.id, "");
              setOpen(false);
            }}
            className="w-full text-left text-xs px-2 py-1.5 rounded text-destructive hover:bg-destructive/10"
          >
            Poista tolppa tästä tapahtumasta
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

function formatRelative(startMs: number): string {
  const min = Math.round(startMs / 60000);
  if (min < -5) return `${Math.abs(min)} min sitten`;
  if (min < 5) return "Nyt";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

const WEEKDAYS = ["su", "ma", "ti", "ke", "to", "pe", "la"];

/** Palauttaa lyhyen paivamaaran jos tapahtuma EI ole tanaan, muuten tyhjan stringin. */
function formatDateBadge(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isToday) return "";
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate();
  if (isTomorrow) return "Huomenna";
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`;
}

function isItemToday(item: TimelineItem): boolean {
  if (item.startIso) {
    const d = new Date(item.startIso);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }
  // Ei ISO:a -> oletetaan tanaan (lennot, junat jne. kayttavat HH:MM)
  return true;
}

interface TimelineCardProps {
  item: TimelineItem;
  onClick: () => void;
}

const TimelineCard = ({ item, onClick }: TimelineCardProps) => {
  const isPast = item.startMs < -5 * 60 * 1000;
  const dateBadge = formatDateBadge(item.startIso);
  const timeLabel =
    item.endTime && item.time && item.endTime !== item.time
      ? `${item.time}–${item.endTime}`
      : item.time || "—";
  // Tolppa-muokkaus on käytettävissä vain venue-pohjaisissa (event/sports/political)
  const canEditTolppa =
    item.raw.kind === "event" ||
    item.raw.kind === "sports" ||
    item.raw.kind === "political";
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 rounded-xl bg-card border-l-4 ${LEVEL_BORDER[item.level]} border border-border px-4 py-3 active:scale-[0.98] transition-all ${
        isPast ? "opacity-50" : ""
      }`}
    >
      <div
        className={`shrink-0 ${
          item.level === "red"
            ? "text-destructive"
            : item.level === "amber"
            ? "text-accent"
            : "text-primary"
        }`}
      >
        {ITEM_ICON[item.raw.kind]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-black text-lg text-foreground truncate leading-tight">{item.title}</p>
        <p className="text-base text-primary/85 font-bold truncate mt-1">
          {item.subtitle}
        </p>
        <div className="flex items-center gap-1 mt-1">
          {item.tolppa ? (
            <p className="flex items-center gap-1.5 text-sm font-black uppercase tracking-wider text-primary min-w-0">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {formatTolppaLabel(item.tolppa)}
                {item.tolppaKmFromUser != null && (
                  <span className="ml-1 text-foreground/80">
                    • {item.tolppaKmFromUser < 1
                      ? `${Math.round(item.tolppaKmFromUser * 1000)} m`
                      : `${item.tolppaKmFromUser.toFixed(1)} km`}
                  </span>
                )}
              </span>
            </p>
          ) : canEditTolppa ? (
            <p className="text-xs font-bold uppercase tracking-wider text-primary/70 italic">
              Tolppa tuntematon
            </p>
          ) : null}
          {canEditTolppa && (
            <TolppaEditor item={item} />
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {dateBadge && (
            <span className="inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-primary/15 text-primary">
              {dateBadge}
            </span>
          )}
          {item.audienceTag && (
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                item.audienceTag === "BUSINESS"
                  ? "bg-primary/20 text-primary"
                  : item.audienceTag === "TAKSIYLEISÖ"
                  ? "bg-destructive/20 text-destructive"
                  : "bg-accent/20 text-accent"
              }`}
              title={`Kohdeyleisö ${item.audienceAge ?? ""}`}
            >
              {item.audienceTag}
            </span>
          )}
          {item.tag && (
            <span
              className={`inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                item.tag.includes("LOPPUUNMYYTY") || item.tag.includes("KORKEA") || item.tag.includes("TÄYNNÄ")
                  ? "bg-destructive/20 text-destructive"
                  : item.tag.includes("PREMIUM")
                  ? "bg-accent/20 text-accent"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {item.tag}
            </span>
          )}
          {item.loadPct != null && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-black tabular-nums px-1.5 py-0.5 rounded ${
                item.loadPct >= 90
                  ? "bg-destructive/15 text-destructive"
                  : item.loadPct >= 70
                  ? "bg-accent/15 text-accent"
                  : "bg-muted text-muted-foreground"
              }`}
              title="Lipunmyyntiaste"
            >
              <Ticket className="h-3 w-3" />
              {item.loadPct}%
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end shrink-0">
        <span
          className={`font-mono font-black ${LEVEL_TIME_COLOR[item.level]} ${
            timeLabel.includes("–") ? "text-lg leading-tight" : "text-3xl"
          }`}
        >
          {timeLabel}
        </span>
        <span className="text-[10px] font-bold text-muted-foreground/70 mt-0.5">
          {formatRelative(item.startMs)}
        </span>
      </div>
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
    </button>
  );
};

interface EventsTimelineProps {
  /** Avaa detail-paneelin klikatulle itemille (yhteinen DetailSheet) */
  onSelect?: (item: TimelineItem) => void;
  /** Avaa "Lisaa tapahtuma" -modaalin */
  onAddEvent?: () => void;
}

const EventsTimeline = ({ onSelect, onAddEvent }: EventsTimelineProps) => {
  const { state, upcomingEvents, trainStation, politicalEvents } = useDashboard();
  const { lat: userLat, lon: userLon, source: locSource } = useGeolocation();

  // Päättele kuljettajan alue (dynaaminen UI: lähin vyöhyke saa prioriteetin)
  const driverArea = useMemo(
    () => detectDriverArea(userLat, userLon),
    [userLat, userLon],
  );

  // Aikaikkuna: 2h oletus, 4h laajennettu
  const [windowH, setWindowH] = useState<2 | 4>(2);
  // Lähellä-suodatin: kun päällä, näytetään vain ≤ 5 km säteellä autosta
  const [nearOnly, setNearOnly] = useState(false);
  // Aktiivinen tabi-indeksi (swipe vaihtaa)
  const [tabIdx, setTabIdx] = useState(0);
  // Per-tab "nayta kaikki" -laajennus (id = "<cat>:expanded")
  const [expanded, setExpanded] = useState<Record<EventCategory, boolean>>({
    asemat: false,
    kulttuuri: false,
    urheilu: false,
    politiikka: false,
    muut: false,
  });
  const [showUpcoming, setShowUpcoming] = useState<Record<EventCategory, boolean>>({
    asemat: false,
    kulttuuri: false,
    urheilu: false,
    politiikka: false,
    muut: false,
  });

  const stationName =
    TRAIN_STATIONS.find((s) => s.code === trainStation)?.name || "Helsinki";

  // Triggeri uudelleenrenderille kun käyttäjä muuttaa manuaalista tolppa-overridea
  const [manualVer, setManualVer] = useState(0);
  useEffect(() => {
    const handler = () => setManualVer((v) => v + 1);
    window.addEventListener("manual-tolppa-changed", handler);
    return () => window.removeEventListener("manual-tolppa-changed", handler);
  }, []);

  // Yhdista kaikki lahteet TimelineItemeiksi
  const allItems: TimelineItem[] = useMemo(() => {
    const items: TimelineItem[] = [];
    state.flights.forEach((f) => items.push(flightToTimelineItem(f)));
    state.trainDelays.forEach((t) => items.push(trainToTimelineItem(t, stationName)));
    state.shipArrivals.forEach((s) => items.push(shipToTimelineItem(s)));
    state.events.filter((e) => !isLowTaxiDemandEvent(e.name, e.venue)).forEach((e) => items.push(eventToTimelineItem(e)));
    upcomingEvents.filter((e) => !isLowTaxiDemandEvent(e.name, e.venue)).forEach((e) => items.push(eventToTimelineItem(e)));
    state.sportsEvents
      .filter((s) => !isLowTaxiDemandEvent(`${s.homeTeam} ${s.awayTeam}`, s.venue))
      .forEach((s) => items.push(sportsToTimelineItem(s)));
    politicalEvents.forEach((p) => items.push(politicalToTimelineItem(p)));
    // Sovella käyttäjän manuaaliset tolppa-overridet ennen etäisyyslaskua
    const overridden = items.map((it) => {
      const m = getManualTolppa(it.id);
      if (m === undefined) return it; // ei overridea
      if (m === null) return { ...it, tolppa: undefined }; // käyttäjä poisti
      return { ...it, tolppa: m };
    });
    return withTolppaDistances(overridden, userLat, userLon);
  }, [
    state.flights,
    state.trainDelays,
    state.shipArrivals,
    state.events,
    state.sportsEvents,
    upcomingEvents,
    politicalEvents,
    stationName,
    userLat,
    userLon,
    manualVer,
  ]);

  // Suodata aika-ikkunan mukaan + ryhmita kategorioihin
  // Jaa: TANAAN (aika-ikkunan sisalla) ja TULEVAT (myohemmat paivat)
  const { todayGrouped, upcomingGrouped, totalCounts } = useMemo(() => {
    const maxMin = windowH * 60;
    const today: Record<EventCategory, TimelineItem[]> = {
      asemat: [], kulttuuri: [], urheilu: [], politiikka: [], muut: [],
    };
    const upcoming: Record<EventCategory, TimelineItem[]> = {
      asemat: [], kulttuuri: [], urheilu: [], politiikka: [], muut: [],
    };
    const filtered = nearOnly
      ? allItems.filter(
          (i) => i.tolppaKmFromUser == null || i.tolppaKmFromUser <= 5,
        )
      : allItems;
    for (const item of filtered) {
      if (isItemToday(item)) {
        if (inWindow(item, maxMin) || isTodayUntilMidnight(item)) {
          today[item.category].push(item);
        } else if (item.startMs > maxMin * 60_000) {
          // Saman paivan myohemmat tapahtumat eivat saa kadota aikaikkunan taakse.
          upcoming[item.category].push(item);
        }
      } else if (item.startMs > 0) {
        // Tulevat paivat: ei aikaikkunarajoitusta, mutta ohi olleet pois
        upcoming[item.category].push(item);
      }
    }
    const sortByWeight = (a: TimelineItem, b: TimelineItem) => {
      // Lähellä-priorisointi: jos käyttäjä on antanut GPS:n, lähemmät nousevat
      if (a.tolppaKmFromUser != null && b.tolppaKmFromUser != null) {
        // Vahva boost 0-5 km (max +60), kohtalainen 5-10 km (max +20),
        // ei boostia >10 km. Pidetään isot tapahtumat (weight >100) silti listalla.
        const distBoost = (km: number, weight: number) => {
          if (km <= 5) return 60 - km * 8; // 5km->20, 0km->60
          if (km <= 10) return 20 - (km - 5) * 4; // 10km->0
          // Kaukaiset: jos tapahtuma muuten erityisen iso, pieni jäännös
          return weight >= 100 ? -10 : -40;
        };
        const aBoost = distBoost(a.tolppaKmFromUser, a.weight);
        const bBoost = distBoost(b.tolppaKmFromUser, b.weight);
        const aw = a.weight + aBoost;
        const bw = b.weight + bBoost;
        if (bw !== aw) return bw - aw;
      } else if (b.weight !== a.weight) {
        return b.weight - a.weight;
      }
      if (b.weight !== a.weight) return b.weight - a.weight;
      return a.startMs - b.startMs;
    };
    const sortByTime = (a: TimelineItem, b: TimelineItem) => a.startMs - b.startMs;
    const counts: Record<EventCategory, number> = { asemat: 0, kulttuuri: 0, urheilu: 0, politiikka: 0, muut: 0 };
    for (const cat of CATEGORY_ORDER) {
      today[cat].sort(sortByWeight);
      upcoming[cat].sort(sortByTime);
      counts[cat] = today[cat].length + upcoming[cat].length;
    }
    return { todayGrouped: today, upcomingGrouped: upcoming, totalCounts: counts };
  }, [allItems, windowH, nearOnly]);

  const activeCategory = CATEGORY_ORDER[tabIdx];
  const todayItems = todayGrouped[activeCategory];
  const upcomingItems = upcomingGrouped[activeCategory];
  const isExpanded = expanded[activeCategory];
  const isUpcomingOpen = showUpcoming[activeCategory];
  const visibleToday = isExpanded ? todayItems : todayItems.slice(0, HARD_LIMIT_PER_TAB);
  const visibleUpcoming = isUpcomingOpen
    ? isExpanded ? upcomingItems : upcomingItems.slice(0, HARD_LIMIT_PER_TAB)
    : [];
  const hiddenToday = todayItems.length - visibleToday.length;
  const hiddenUpcoming = isUpcomingOpen ? upcomingItems.length - visibleUpcoming.length : 0;
  const hiddenCount = hiddenToday + hiddenUpcoming;
  const hasAnything = visibleToday.length > 0 || upcomingItems.length > 0;

  // Swipe handlers
  const swipe = useSwipeable({
    onSwipedLeft: () => setTabIdx((i) => Math.min(CATEGORY_ORDER.length - 1, i + 1)),
    onSwipedRight: () => setTabIdx((i) => Math.max(0, i - 1)),
    trackMouse: false,
    delta: 40,
  });

  // Kun tabia vaihdetaan, palauta laajennus oletukseen
  useEffect(() => {
    setExpanded((prev) => ({ ...prev, [activeCategory]: false }));
    setShowUpcoming((prev) => ({ ...prev, [activeCategory]: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabIdx, windowH]);

  return (
    <section className="space-y-3">
      {/* Header: otsikko + aika-ikkuna toggle + Lisaa */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Clock className="h-5 w-5 text-accent" />
          Aikajana
          <span className="text-xs font-bold text-muted-foreground/60 normal-case tracking-normal">
            {windowH === 2 ? "Nyt + 2h" : "Nyt + 4h"}
          </span>
          {driverArea && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-primary/15 text-primary normal-case"
              title={`Kuljettaja lähellä ${driverArea.zone} (${driverArea.km.toFixed(1)} km)`}
            >
              <MapPin className="h-3 w-3" />
              {driverAreaLabel(driverArea.zone)}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {userLat != null && userLon != null && (
            <button
              onClick={() => setNearOnly((v) => !v)}
              className={`h-10 px-3 rounded-lg border flex items-center gap-1 text-xs font-black uppercase tracking-wider active:scale-95 ${
                nearOnly
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-muted border-border text-muted-foreground"
              }`}
              title={
                locSource === "gps"
                  ? "Näytä vain 5 km säteellä autosta"
                  : "Näytä vain valitun vyöhykkeen läheisyydessä"
              }
            >
              <MapPin className="h-4 w-4" /> 5km
            </button>
          )}
          <button
            onClick={() => setWindowH(windowH === 2 ? 4 : 2)}
            className="h-10 px-3 rounded-lg bg-muted border border-border flex items-center gap-1 text-xs font-black uppercase tracking-wider text-muted-foreground active:scale-95"
            title="Vaihda aikaikkunaa"
          >
            {windowH === 2 ? "+2h" : "−2h"}
          </button>
          {onAddEvent && (
            <button
              onClick={onAddEvent}
              className="h-10 px-3 rounded-lg bg-primary/15 border border-primary/40 flex items-center gap-1.5 text-primary text-xs font-black uppercase tracking-wider active:scale-95"
            >
              <Plus className="h-4 w-4" /> Lisää
            </button>
          )}
        </div>
      </div>

      {/* Tab-napit + swipe-vihjeet */}
      <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
        <button
          onClick={() => setTabIdx((i) => Math.max(0, i - 1))}
          disabled={tabIdx === 0}
          className="shrink-0 h-9 w-7 flex items-center justify-center text-muted-foreground disabled:opacity-30"
          aria-label="Edellinen"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 grid grid-cols-5 gap-1">
          {CATEGORY_ORDER.map((cat, i) => {
            const count = totalCounts[cat];
            const isActive = i === tabIdx;
            return (
              <button
                key={cat}
                onClick={() => setTabIdx(i)}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all ${
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground active:scale-95"
                }`}
              >
                <div className="flex items-center gap-1">
                  {CATEGORY_ICONS[cat]}
                  {count > 0 && (
                    <span
                      className={`px-1.5 rounded text-[9px] ${
                        isActive ? "bg-accent/20 text-accent" : "bg-muted-foreground/10"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </div>
                <span className="leading-none">{CATEGORY_LABELS[cat]}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setTabIdx((i) => Math.min(CATEGORY_ORDER.length - 1, i + 1))}
          disabled={tabIdx === CATEGORY_ORDER.length - 1}
          className="shrink-0 h-9 w-7 flex items-center justify-center text-muted-foreground disabled:opacity-30"
          aria-label="Seuraava"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Tab-sisalto, swaipattava */}
      <div {...swipe} className="min-h-[120px]">
        {!hasAnything ? (
          <div className="rounded-xl bg-card border border-border p-5 text-center">
            <p className="text-base font-bold text-muted-foreground">
              Ei {CATEGORY_LABELS[activeCategory].toLowerCase()}-tapahtumia
              tanaan eika tulevina paivina.
            </p>
            {windowH === 2 && (
              <button
                onClick={() => setWindowH(4)}
                className="mt-3 text-sm font-black text-accent uppercase tracking-wider"
              >
                Laajenna 4h →
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* TANAAN */}
            <div className="flex flex-col gap-2">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/80 px-1">
                Tanaan {todayItems.length > 0 && `(${todayItems.length})`}
              </h3>
              {visibleToday.length === 0 ? (
                <div className="rounded-lg bg-card/50 border border-border/50 p-3 text-center">
                  <p className="text-xs font-bold text-muted-foreground">
                    Ei tapahtumia {windowH === 2 ? "seur. 2h" : "seur. 4h"} aikana
                  </p>
                </div>
              ) : (
              visibleToday.map((item) => (
                  <TimelineCard
                    key={item.id}
                    item={item}
                    onClick={() => {
                      if (item.url) window.open(item.url, "_blank", "noopener,noreferrer");
                      onSelect?.(item);
                    }}
                  />
                ))
              )}
            </div>

            {/* TULEVAT PAIVAT */}
            {upcomingItems.length > 0 && (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setShowUpcoming((prev) => ({ ...prev, [activeCategory]: !prev[activeCategory] }))}
                  className="w-full rounded-xl border border-border bg-muted/60 px-4 py-3 flex items-center justify-between text-sm font-black uppercase tracking-wider text-primary active:scale-[0.98]"
                >
                  <span>Tulevat tapahtumat ({upcomingItems.length})</span>
                  <ChevronDown className={`h-5 w-5 transition-transform ${isUpcomingOpen ? "rotate-180" : ""}`} />
                </button>
                {isUpcomingOpen && visibleUpcoming.map((item) => (
                    <TimelineCard
                      key={item.id}
                      item={item}
                      onClick={() => {
                        if (item.url) window.open(item.url, "_blank", "noopener,noreferrer");
                        onSelect?.(item);
                      }}
                    />
                  ))}
              </div>
            )}

            {hiddenCount > 0 && (
              <button
                onClick={() =>
                  setExpanded((prev) => ({ ...prev, [activeCategory]: true }))
                }
                className="w-full rounded-xl border-2 border-dashed border-border bg-card/50 py-3 text-sm font-black uppercase tracking-wider text-muted-foreground active:scale-[0.98]"
              >
                Nayta kaikki ({hiddenCount} lisaa)
              </button>
            )}
            {isExpanded && (todayItems.length + upcomingItems.length) > HARD_LIMIT_PER_TAB && (
              <button
                onClick={() =>
                  setExpanded((prev) => ({ ...prev, [activeCategory]: false }))
                }
                className="w-full rounded-xl bg-muted py-2 text-xs font-black uppercase tracking-wider text-muted-foreground active:scale-[0.98]"
              >
                Tiivista top {HARD_LIMIT_PER_TAB}
              </button>
            )}
          </div>
        )}

        {/* Swipe-vihje */}
        <p className="mt-2 text-center text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">
          ← Pyyhkäise vaihtaaksesi tabia →
        </p>
      </div>
    </section>
  );
};

export default EventsTimeline;
