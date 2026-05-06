import { useState } from "react";
import { ExternalLink, Users, Loader2, Check } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  submitDemandFeedback,
  DEMAND_LABEL,
  DEMAND_COLOR,
  type DemandLevel,
} from "@/lib/demandFeedback";
import { openExternal } from "@/lib/openExternal";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardKey: string;
  cardType: string;
  title: string;
  subtitle?: string;
  zone?: string;
  deepLink?: string | null;
}

const LEVELS: DemandLevel[] = ["many", "some", "few", "ended"];

const DemandFeedbackSheet = ({
  open,
  onOpenChange,
  cardKey,
  cardType,
  title,
  subtitle,
  zone,
  deepLink,
}: Props) => {
  const [submitting, setSubmitting] = useState<DemandLevel | null>(null);
  const [done, setDone] = useState<DemandLevel | null>(null);

  const send = async (level: DemandLevel) => {
    setSubmitting(level);
    try {
      await submitDemandFeedback({
        cardKey,
        cardType,
        cardLabel: title,
        zone,
        level,
      });
      setDone(level);
      toast.success("Arvio lahetetty", { description: DEMAND_LABEL[level] });
      setTimeout(() => onOpenChange(false), 600);
    } catch (e) {
      console.warn("submitDemandFeedback epaonnistui:", e);
      toast.error("Arvion lahetys epaonnistui");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-card border-border">
        <SheetHeader className="text-left">
          <SheetTitle className="text-2xl font-black uppercase tracking-wide text-foreground">
            {title}
          </SheetTitle>
          {subtitle && (
            <SheetDescription className="text-base font-bold text-muted-foreground">
              {subtitle}
            </SheetDescription>
          )}
        </SheetHeader>

        {deepLink && (
          <button
            type="button"
            onClick={() => openExternal(deepLink)}
            className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 py-3 text-sm font-black uppercase tracking-widest text-primary active:scale-[0.98] transition"
          >
            <ExternalLink className="h-4 w-4" /> Avaa lahde
          </button>
        )}

        <div className="mt-5">
          <p className="px-1 mb-2 text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Users className="h-4 w-4" /> Arvioi kysynta
          </p>
          <div className="grid grid-cols-2 gap-2">
            {LEVELS.map((lvl) => {
              const isSubmitting = submitting === lvl;
              const isDone = done === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  disabled={submitting !== null}
                  onClick={() => send(lvl)}
                  className={`rounded-xl border border-border bg-background/60 px-3 py-4 text-sm font-black uppercase tracking-wide active:scale-[0.97] transition flex items-center justify-center gap-2 ${DEMAND_COLOR[lvl]} disabled:opacity-50`}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isDone ? (
                    <Check className="h-4 w-4" />
                  ) : null}
                  {DEMAND_LABEL[lvl]}
                </button>
              );
            })}
          </div>
          <p className="mt-3 px-1 text-xs text-muted-foreground">
            Arvio nakyy muille kuljettajille noin tunnin ajan.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default DemandFeedbackSheet;