/**
 * types.ts
 *
 * Kaikki jaetut TypeScript-tyypit Helsinki Taxi Pulse -sovellukselle.
 * Muutokset tahan tiedostoon vaikuttavat koko sovellukseen.
 *
 * Muutoshistoria:
 * - BUG-FIX: Lisatty TrainDelay.trainCategory (optionaalinen) jotta scoring.ts
 *   voi suodattaa kaukojunat luotettavasti regexin sijaan. Digitraffic API
 *   palauttaa kentan trainCategory ("Long-distance" | "Commuter" | "Cargo"),
 *   ja fintraffic.ts pitaa paivittaa valittamaan tama eteenpain.
 */

// ---------------------------------------------------------------------------
// Junan kategorialuokitus (vastaa Digitraffic API:n trainCategory-kenttaa)
// ---------------------------------------------------------------------------

export type TrainCategory = "Long-distance" | "Commuter" | "Cargo";

export interface TrainDelay {
  id: string;
  line: string;
  origin: string;
  delayMinutes: number;
  arrivalTime: string;
  /**
   * Junan kategoria Digitraffic-API:sta.
   * Optionaalinen takautuvan yhteensopivuuden vuoksi, mutta kaikki uudet
   * kayttotapaukset pitaisi paivittaa kayttamaan tata kentta.
   *
   * scoring.ts kayttaa tata kentta jos se on maaritelty; muussa tapauksessa
   * putoaa varovaiseen IC-only -fallbackiin (joka jattaa Pendolinon ja muut
   * kaukojunatyypit pois hylkayksen sijaan).
   */
  trainCategory?: TrainCategory;
  cancelled?: boolean;
  capacity?: number;
  capacitySource?: string;
}

export interface ShipArrival {
  id: string;
  ship: string;
  harbor: string;
  pax: number;           // Maksimikapasiteetti
  estimatedPax?: number; // Live-estimaatti Averio/Port of Helsinki -lahteesta
  eta: string;
}

export interface EventInfo {
  id: string;
  name: string;
  venue: string;
  endsIn: number;         // Minuutteja paattymiseen
  soldOut: boolean;
  demandTag?: string;     // Kuljettajalle nakyva tagi, esim. "KORKEA KYSYNTA"
  demandLevel?: "red" | "amber" | "green";
  startTime?: string;     // HH:MM muodossa
  startIso?: string;      // Tay ISO-aika alkamisajalle (paivamaaran nayttoa varten)
  endTime?: string;       // HH:MM muodossa - paattymisaika (purkuaika)
  endIso?: string;        // Tay ISO-aika paattymiselle, jotta kaynnissa olevat pysyvat aktiivisina
  capacity?: number;      // Venue-kapasiteetti (paikkamaara)
  estimatedAttendance?: number; // Arvio yleisomaarasta
  loadFactor?: number;    // 0..1 - lipunmyyntiaste
  availabilityNote?: string; // Vapaa kuvaus tilanteesta tai AI-arvion peruste
  infoUrl?: string;
}

export interface WeatherData {
  condition: "Rain" | "Clear" | "Snow";
  temp: number;           // Lampotila celsiuksina (pyoristetty)
  rain: number;           // Sademaara mm/h
  showers: number;        // Sadekuurot mm/h
  snowfall: number;       // Lumisade mm/h
  windSpeed: number;      // Tuulennopeus m/s
  rainModeActive: boolean; // true kun sade+lumi > 1.0 mm/h
  slipperyIndex?: number;  // 0.0-1.0: liukkausindeksi (>= 0.6 = sairaala-signaali)
}

export type AlertLevel = "none" | "high" | "jackpot";

export interface JackpotAlert {
  level: AlertLevel;
  zone: string;
  reason: string;
  type: "train" | "ship" | "weather" | "combined" | "event";
}

export interface FlightArrival {
  id: string;
  flightNumber: string;       // "AY1234"
  airline: string;
  origin: string;             // Koko nimi tai IATA
  originCode: string;         // IATA-koodi "ARN"
  scheduledTime: string;      // HH:MM
  estimatedTime: string;      // HH:MM
  delayMinutes: number;
  terminal?: string;          // "T1" / "T2"
  gate?: string;
  belt?: string;
  status: string;
  demandTag: string;
  demandLevel: "red" | "amber" | "green";
}

export interface SportsEvent {
  id: string;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  startTime: string;          // HH:MM
  expectedAttendance: number;
  capacity: number;
  league: string;             // "Liiga", "Veikkausliiga", "NHL preseason" jne.
  endsIn: number;             // Min ennen paattymista (negatiivinen jos jo loppunut)
  demandTag: string;
  demandLevel: "red" | "amber" | "green";
  startIso?: string;
  endIso?: string;
}

export interface DashboardState {
  trainDelays: TrainDelay[];
  shipArrivals: ShipArrival[];
  events: EventInfo[];
  weather: WeatherData;
  flights: FlightArrival[];
  sportsEvents: SportsEvent[];
}

export interface UpcomingEvents {
  list: EventInfo[];
}

export interface HarborPaxEstimate {
  estimate: number;
  maxCapacity: number;
  factor: number;        // Tayttoprosentti 0-100
}

export interface AverioShip {
  ship: string;
  harbor: string;
  pax: number;
  arrivalTime: string;
}

export interface HarborPaxResponse {
  estimates: Record<string, HarborPaxEstimate>;
  ships: AverioShip[];
  source: string;
  timestamp: string;
}
