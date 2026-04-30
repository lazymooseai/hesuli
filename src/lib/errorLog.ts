/**
 * errorLog.ts
 *
 * Kevyt sisaisesti tallennettu virhelogi joka kerää console.error,
 * console.warn ja kasittelematonia virheita. Naytetaan
 * ErrorLogDrawerissa kuljettajan diagnostiikkaa varten.
 *
 * - Pidetaan max 100 viimeisinta merkintaa
 * - Eventit lahetetaan custom-eventilla 'errorlog:update' jotta
 *   UI voi paivittya reaaliaikaisesti
 */

export type LogLevel = "error" | "warn" | "info";

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  detail?: string;
  ts: number;
  source?: string;
}

const MAX = 100;
const buffer: LogEntry[] = [];
let installed = false;

function shouldIgnore(args: unknown[]): boolean {
  const text = args
    .map((a) => (typeof a === "string" ? a : a instanceof Error ? a.message : String(a)))
    .join(" ");
  return (
    text.includes("React Router Future Flag Warning") ||
    text.includes("Unknown message type: RESET_BLANK_CHECK") ||
    text.includes("Download the React DevTools")
  );
}

function notify() {
  try {
    window.dispatchEvent(new CustomEvent("errorlog:update"));
  } catch {
    /* ssr safety */
  }
}

function push(level: LogLevel, args: unknown[], source?: string) {
  if (shouldIgnore(args)) return;
  const message = args
    .map((a) => {
      if (typeof a === "string") return a;
      if (a instanceof Error) return a.message;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(" ")
    .slice(0, 1000);
  const detail = args
    .filter((a): a is Error => a instanceof Error)
    .map((e) => e.stack || e.message)
    .join("\n")
    .slice(0, 2000) || undefined;
  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    level,
    message,
    detail,
    ts: Date.now(),
    source,
  };
  buffer.unshift(entry);
  if (buffer.length > MAX) buffer.length = MAX;
  notify();
}

/** Asenna globaalit konsoli- ja virhe-kuuntelijat. Idempotent. */
export function installErrorLog() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  console.error = (...args: unknown[]) => {
    push("error", args);
    origError(...args);
  };
  console.warn = (...args: unknown[]) => {
    push("warn", args);
    origWarn(...args);
  };

  window.addEventListener("error", (e) => {
    push("error", [e.message, e.error].filter(Boolean), "window.onerror");
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = (e as PromiseRejectionEvent).reason;
    push("error", [reason], "unhandledrejection");
  });
}

export function getErrorLog(): LogEntry[] {
  return buffer.slice();
}

export function clearErrorLog() {
  buffer.length = 0;
  notify();
}

export function logInfo(message: string, source?: string) {
  push("info", [message], source);
}
