/**
 * ErrorLogDrawer.tsx
 *
 * Naytetaan viimeisimmat virheet ja varoitukset kuljettajalle.
 * Indikaattori (punainen piste) jos uusia virheita on viime tarkistuksen
 * jalkeen.
 */

import { useEffect, useState } from "react";
import { ScrollText, Trash2, AlertCircle, AlertTriangle, Info } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { clearErrorLog, getErrorLog, type LogEntry } from "@/lib/errorLog";

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

const LEVEL_ICON = {
  error: <AlertCircle className="h-4 w-4 text-destructive" />,
  warn: <AlertTriangle className="h-4 w-4 text-accent" />,
  info: <Info className="h-4 w-4 text-primary" />,
};

const ErrorLogDrawer = () => {
  const [entries, setEntries] = useState<LogEntry[]>(() => getErrorLog());
  const [open, setOpen] = useState(false);
  const [seenCount, setSeenCount] = useState(entries.length);

  useEffect(() => {
    const handler = () => setEntries(getErrorLog());
    window.addEventListener("errorlog:update", handler);
    return () => window.removeEventListener("errorlog:update", handler);
  }, []);

  useEffect(() => {
    if (open) setSeenCount(entries.length);
  }, [open, entries.length]);

  const errorCount = entries.filter((e) => e.level === "error").length;
  const hasNew = entries.length > seenCount && errorCount > 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="relative h-11 w-11 rounded-lg bg-card border border-border flex items-center justify-center active:scale-95 transition-all"
          aria-label="Virheloki"
          title="Virheloki"
        >
          <ScrollText className={`h-6 w-6 ${errorCount > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          {hasNew && (
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-destructive animate-pulse border border-background" />
          )}
          {errorCount > 0 && !hasNew && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-[10px] font-black text-destructive-foreground flex items-center justify-center border border-background">
              {errorCount > 99 ? "99+" : errorCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-2xl font-black uppercase tracking-wide flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-destructive" />
            Virheloki
          </SheetTitle>
          <SheetDescription>
            {entries.length === 0
              ? "Ei virheitä viimeaikoina — kaikki ok."
              : `${entries.length} merkintää (${errorCount} virhettä).`}
          </SheetDescription>
        </SheetHeader>

        {entries.length > 0 && (
          <button
            onClick={() => clearErrorLog()}
            className="mt-4 flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" /> Tyhjennä loki
          </button>
        )}

        <div className="mt-4 space-y-2 pb-12">
          {entries.map((e) => (
            <div
              key={e.id}
              className={`rounded-lg border p-3 text-sm ${
                e.level === "error"
                  ? "border-destructive/30 bg-destructive/5"
                  : e.level === "warn"
                  ? "border-accent/30 bg-accent/5"
                  : "border-border bg-card/40"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {LEVEL_ICON[e.level]}
                <span className="font-mono text-xs text-muted-foreground">{fmtTime(e.ts)}</span>
                {e.source && (
                  <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground/70">
                    {e.source}
                  </span>
                )}
              </div>
              <p className="text-foreground font-semibold break-words whitespace-pre-wrap">{e.message}</p>
              {e.detail && (
                <details className="mt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer">Stack</summary>
                  <pre className="mt-1 text-[10px] text-muted-foreground/80 whitespace-pre-wrap overflow-x-auto">
                    {e.detail}
                  </pre>
                </details>
              )}
            </div>
          ))}
          {entries.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">Lokimerkintöjä ei vielä ole.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ErrorLogDrawer;
