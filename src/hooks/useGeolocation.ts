/**
 * useGeolocation.ts v3
 *
 * Kaytetaan VAIN getCurrentPosition + setInterval-pohjainen paivitys.
 * watchPosition poistettu — se kaatuu Lovable.dev-preview-iframessa
 * vaikka kayttaja antaisi luvan, koska iframe-konteksti ei saa
 * jatkuvaa sijaintilupaa ilman allow="geolocation"-attributtia.
 *
 * Iframe-tunnistus: jos window.self !== window.top, nayta
 * kayttajaystavallinen viesti manuaalivalinnalla.
 *
 * sessionStorage-cache: GPS-koordinaatit sailyvat sivunpaivityksen yli
 * jottei kayttajan tarvitse antaa lupaa uudelleen.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { ZONE_CENTERS, type Zone } from "@/lib/tolppaLocations";

const MANUAL_KEY  = "taxi-pulse:manual-zone";
const GPS_LAT_KEY = "taxi-pulse:gps-lat";
const GPS_LON_KEY = "taxi-pulse:gps-lon";
const REFRESH_MS  = 5 * 60 * 1000; // Paivita sijainti 5 min valein

export type LocationSource = "gps" | "manual" | "none";

export interface LocationState {
  lat:            number | null;
  lon:            number | null;
  source:         LocationSource;
  zone:           Zone | null;
  accuracyMeters: number | null;
  error:          string | null;
  loading:        boolean;
}

/** Onko sovellus iframe-kontekstissa (esim. Lovable.dev-preview) */
function isInIframe(): boolean {
  try {
    return typeof window !== "undefined" && window.self !== window.top;
  } catch {
    return true; // cross-origin iframe heittaa virheen
  }
}

export function useGeolocation() {
  const [state, setState] = useState<LocationState>(() => {
    if (typeof window === "undefined") {
      return { lat: null, lon: null, source: "none", zone: null,
               accuracyMeters: null, error: null, loading: false };
    }

    // 1. Manuaalivalinta sailyy localStorage:ssa
    const saved = localStorage.getItem(MANUAL_KEY) as Zone | null;
    if (saved && saved in ZONE_CENTERS) {
      const c = ZONE_CENTERS[saved];
      return { lat: c.lat, lon: c.lon, source: "manual", zone: saved,
               accuracyMeters: null, error: null, loading: false };
    }

    // 2. Edellinen GPS-sijainti sessionStorage:sta (sailyy refresh yli)
    const cachedLat = parseFloat(sessionStorage.getItem(GPS_LAT_KEY) ?? "");
    const cachedLon = parseFloat(sessionStorage.getItem(GPS_LON_KEY) ?? "");
    if (!isNaN(cachedLat) && !isNaN(cachedLon)) {
      return { lat: cachedLat, lon: cachedLon, source: "gps", zone: null,
               accuracyMeters: null, error: null, loading: false };
    }

    return { lat: null, lon: null, source: "none", zone: null,
             accuracyMeters: null, error: null, loading: false };
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const requestGps = useCallback(() => {
    // Iframe-tarkistus ensin
    if (isInIframe()) {
      setState((s) => ({
        ...s,
        loading: false,
        error: "GPS estetty esikatselussa — avaa sovellus omassa valilehdessa tai valitse alue alta",
      }));
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((s) => ({
        ...s, loading: false,
        error: "GPS ei ole tuettu tassa selaimessa — valitse alue alta",
      }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    // Kaytetaan VAIN getCurrentPosition — ei watchPosition
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        // Tallenna sessioon
        sessionStorage.setItem(GPS_LAT_KEY, String(lat));
        sessionStorage.setItem(GPS_LON_KEY, String(lon));
        localStorage.removeItem(MANUAL_KEY);

        setState({
          lat, lon, source: "gps", zone: null,
          accuracyMeters: pos.coords.accuracy,
          error: null, loading: false,
        });
      },
      (err) => {
        let msg = "GPS-haku epaonnistui — valitse alue alta";
        if (err.code === err.PERMISSION_DENIED) {
          msg = "GPS-lupa evatty — anna lupa: Asetukset > Safari > Sijainti > Salli";
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = "Sijainti ei saatavilla — valitse alue alta";
        } else if (err.code === err.TIMEOUT) {
          msg = "GPS aikakatkaistiin — valitse alue alta";
        }
        setState((s) => ({ ...s, loading: false, error: msg }));
      },
      {
        enableHighAccuracy: true,
        timeout: 12_000,
        maximumAge: 60_000,
      },
    );
  }, []);

  const setManualZone = useCallback((zone: Zone) => {
    stopInterval();
    const c = ZONE_CENTERS[zone];
    localStorage.setItem(MANUAL_KEY, zone);
    sessionStorage.removeItem(GPS_LAT_KEY);
    sessionStorage.removeItem(GPS_LON_KEY);
    setState({
      lat: c.lat, lon: c.lon, source: "manual", zone,
      accuracyMeters: null, error: null, loading: false,
    });
  }, [stopInterval]);

  const clear = useCallback(() => {
    stopInterval();
    localStorage.removeItem(MANUAL_KEY);
    sessionStorage.removeItem(GPS_LAT_KEY);
    sessionStorage.removeItem(GPS_LON_KEY);
    setState({ lat: null, lon: null, source: "none", zone: null,
               accuracyMeters: null, error: null, loading: false });
  }, [stopInterval]);

  // Kaynnista GPS automaattisesti — mutta vain jos EI olla iframessa
  useEffect(() => {
    if (state.source === "none") {
      if (isInIframe()) {
        // Nayta suoraan manuaalivalinta-viesti iframessa
        setState((s) => ({
          ...s, loading: false,
          error: "GPS estetty esikatselussa — avaa sovellus omassa valilehdessa tai valitse alue alta",
        }));
      } else {
        requestGps();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kaynnista paivitysintervaali kun GPS on saatu onnistuneesti
  useEffect(() => {
    if (state.source === "gps" && state.lat !== null && !isInIframe()) {
      stopInterval();
      intervalRef.current = setInterval(() => {
        requestGps();
      }, REFRESH_MS);
    }
    return () => { stopInterval(); };
  }, [state.source, state.lat, requestGps, stopInterval]);

  return { ...state, requestGps, setManualZone, clear };
}
