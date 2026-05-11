/**
 * useGeolocation.ts v2
 *
 * Korjattu versio: watchPosition jatkuvaan seurantaan,
 * parempi virheenkasittely, toimii Lovable.dev-previewssa.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { ZONE_CENTERS, type Zone } from "@/lib/tolppaLocations";

const STORAGE_KEY = "taxi-pulse:manual-zone";

export type LocationSource = "gps" | "manual" | "none";

export interface LocationState {
  lat: number | null;
  lon: number | null;
  source: LocationSource;
  zone: Zone | null;
  accuracyMeters: number | null;
  error: string | null;
  loading: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<LocationState>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY) as Zone | null;
      if (saved && saved in ZONE_CENTERS) {
        const c = ZONE_CENTERS[saved];
        return {
          lat: c.lat, lon: c.lon, source: "manual", zone: saved,
          accuracyMeters: null, error: null, loading: false,
        };
      }
    }
    return { lat: null, lon: null, source: "none", zone: null,
             accuracyMeters: null, error: null, loading: false };
  });

  const watchIdRef = useRef<number | null>(null);

  // Pysaytetaan watch
  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // Kaynnistetaan GPS-seuranta
  const requestGps = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((s) => ({
        ...s,
        error: "GPS ei ole tuettu tassa selaimessa",
        loading: false,
      }));
      return;
    }

    // Pysayta edellinen watch ensin
    stopWatch();

    setState((s) => ({ ...s, loading: true, error: null }));

    // Kokeile ensin getCurrentPosition nopeaan vastaukseen
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        localStorage.removeItem(STORAGE_KEY);
        setState({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          source: "gps",
          zone: null,
          accuracyMeters: pos.coords.accuracy,
          error: null,
          loading: false,
        });
      },
      (err) => {
        // getCurrentPosition epaonnistui -- nayta virheilmoitus
        let msg = "GPS-haku epaonnistui";
        if (err.code === err.PERMISSION_DENIED) {
          msg = "GPS-lupa evatty -- anna lupa selaimen asetuksista";
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = "Sijainti ei saatavilla";
        } else if (err.code === err.TIMEOUT) {
          msg = "GPS-haku aikakatkaistiin";
        }
        setState((s) => ({ ...s, loading: false, error: msg }));
      },
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 30_000,
      },
    );

    // Kaynnista myos watchPosition jatkuvaan paivitykseen
    const wid = navigator.geolocation.watchPosition(
      (pos) => {
        localStorage.removeItem(STORAGE_KEY);
        setState({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          source: "gps",
          zone: null,
          accuracyMeters: pos.coords.accuracy,
          error: null,
          loading: false,
        });
      },
      (_err) => {
        // Watch-virhe -- ei nayteta uutta virhetta jos koordinaatit jo saatu
        setState((s) => {
          if (s.lat !== null) return s; // koordinaatit jo OK
          return { ...s, loading: false,
                   error: "GPS-paivitys keskeytyi" };
        });
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
    watchIdRef.current = wid;
  }, [stopWatch]);

  const setManualZone = useCallback((zone: Zone) => {
    stopWatch();
    const c = ZONE_CENTERS[zone];
    localStorage.setItem(STORAGE_KEY, zone);
    setState({
      lat: c.lat, lon: c.lon, source: "manual", zone,
      accuracyMeters: null, error: null, loading: false,
    });
  }, [stopWatch]);

  const clear = useCallback(() => {
    stopWatch();
    localStorage.removeItem(STORAGE_KEY);
    setState({ lat: null, lon: null, source: "none", zone: null,
               accuracyMeters: null, error: null, loading: false });
  }, [stopWatch]);

  // Kaynnista GPS automaattisesti kun ei ole manuaalivalintaa
  useEffect(() => {
    if (state.source === "none") {
      requestGps();
    }
    return () => { stopWatch(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Puhdista watch kun komponentti poistetaan
  useEffect(() => {
    return () => { stopWatch(); };
  }, [stopWatch]);

  return { ...state, requestGps, setManualZone, clear };
}
