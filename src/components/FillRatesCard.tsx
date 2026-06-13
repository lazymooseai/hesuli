/**
 * FillRatesCard.tsx
 *
 * Yhdistetty tayttoastenakyma: tapahtumat (lipunmyynti) + laivat (matkustajat).
 *
 * Tapahtumat:
 *   - load_factor 0..1 lipunmyyntiasteena (enrich-event-tickets paivittaa)
 *   - Palkki + prosentti + availability_note
 *   - Punainen >= 90%, keltainen >= 65%, vihrea muuten
 *
 * Laivat:
 *   - estimatedPax / pax = tayttoprosentti
 *   - Naytetaan saapuvat seuraavan 3h aikana
 *
 * Naytetaan vain rivit joilla on oikeaa dataa - ei placeholdereita.
 */

import { Ship, Ticket } from "lucide-react";
import { useDashboard } from "@/context/DashboardContext";
import type { EventInfo, ShipArrival } from "@/lib/types";

// ---------------------------------------------------------------------------
// Apufunktiot
// ---------------------------------------------------------------------------

function fillColor(pct: number): string {
  if (pct >= 90) return "bg-red-500";
  if (pct >= 65) return "bg-amber-500";
  return "bg-emerald-500";
}

function fillTextColor(pct: number): string {
  if (pct >= 90) return "text-red-500";
  if (pct >= 65) return "text-amber-500";
  return "text-emerald-500";
}

function minutesUntilEta(eta: string): number {
  const [h, m] = eta.split(":").map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h ?? 0, m ?? 0, 0, 0);
  if (target < now) target.setDate(target.getDate() + 1);
  return Math.round((target.getTime() - now.getTime()) / 60000);
}

// ---------------------------------------------------------------------------
// Alikomponentit
// ---------------------------------------------------------------------------

function FillBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${fillColor(clamped)}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function EventFillRow({ ev }: { ev: EventInfo }) {
  if (ev.loadFactor == null) return null;
  const pct = Math.round(ev.loadFactor * 100);
  return (
    <div className="py-2 border-b border-border last:border-0">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-sm font-bold truncate">{ev.name}</span>
        <span className={`text-sm font-black shrink-0 ${fillTextColor(pct)}`}>
          {pct}%
        </span>
      </div>
      <FillBar pct={pct} />
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-muted-foreground truncate">
          {ev.venue}
          {ev.startTime ? ` · ${ev.startTime}` : ""}
        </span>
        {ev.availabilityNote && (
          <span className="text-xs text-muted-foreground shrink-0 ml-2">
            {ev.availabilityNote}
          </span>
        )}
      </div>
    </div>
  );
}

function ShipFillRow({ ship }: { ship: ShipArrival }) {
  if (!ship.estimatedPax || !ship.pax || ship.pax <= 0) return null;
  const pct = Math.round((ship.estimatedPax / ship.pax) * 100);
  const mins = minutesUntilEta(ship.eta);
  if (mins > 180) return null; // vain seuraavat 3h
  return (
    <div className="py-2 border-b border-border last:border-0">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-sm font-bold truncate">{ship.ship}</span>
        <span className={`text-sm font-black shrink-0 ${fillTextColor(pct)}`}>
          {pct}%
        </span>
      </div>
      <FillBar pct={pct} />
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-muted-foreground truncate">
          {ship.harbor} · ETA {ship.eta} ({mins} min)
        </span>
        <span className="text-xs text-muted-foreground shrink-0 ml-2">
          ~{ship.estimatedPax.toLocaleString("fi-FI")} / {ship.pax.toLocaleString("fi-FI")}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paakomponentti
// ---------------------------------------------------------------------------

const FillRatesCard = () => {
  const { state } = useDashboard();

  // Tapahtumat joilla on tayttoastedata, lahimmat ensin
  const eventsWithFill = state.events
    .filter((e) => e.loadFactor != null)
    .sort((a, b) => (b.loadFactor ?? 0) - (a.loadFactor ?? 0))
    .slice(0, 6);

  // Laivat joilla on estimaatti
  const shipsWithFill = state.shipArrivals
    .filter((s) => s.estimatedPax != null && s.pax > 0)
    .slice(0, 4);

  const hasData = eventsWithFill.length > 0 || shipsWithFill.length > 0;

  if (!hasData) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground text-center py-2">
          Ei tayttoastedataa viela. Lipunmyyntiseuranta paivittyy
          automaattisesti taustalla.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
      {eventsWithFill.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Ticket className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              Lipunmyynti
            </h3>
          </div>
          {eventsWithFill.map((ev) => (
            <EventFillRow key={ev.id} ev={ev} />
          ))}
        </div>
      )}

      {shipsWithFill.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Ship className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              Laivojen tayttoaste
            </h3>
          </div>
          {shipsWithFill.map((s) => (
            <ShipFillRow key={s.id} ship={s} />
          ))}
        </div>
      )}
    </div>
  );
};

export default FillRatesCard;
