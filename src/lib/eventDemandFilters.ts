/**
 * eventDemandFilters.ts
 *
 * Keskitetyt "ei taksikysyntää" -suodattimet. Näitä käytetään kaikissa
 * tapahtumalähteissä (DB, LinkedEvents, urheilu, suositus), jotta pienet
 * näyttelyt eivät nouse takaisin eri reittiä.
 */

const LOW_TAXI_DEMAND_PATTERNS = [
  /tahdon\s+(tarina|tila)/i,
  /tahdontarina/i,
  /urheilumuseo/i,
];

export function isLowTaxiDemandEvent(name?: string | null, venue?: string | null): boolean {
  const text = `${name ?? ""} ${venue ?? ""}`;
  return LOW_TAXI_DEMAND_PATTERNS.some((re) => re.test(text));
}
