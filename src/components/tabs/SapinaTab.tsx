import EventsTimeline from "@/components/EventsTimeline";
import DispatchLiveCard from "@/components/DispatchLiveCard";
import SuggestionButton from "@/components/SuggestionButton";
import { TripHeatmap } from "@/components/TripHeatmap";
import { EtaSniperCard } from "@/components/EtaSniperCard";

const SapinaTab = () => {
  return (
    <div className="px-4 pt-2 pb-6 space-y-6">

      <section aria-label="Tapahtumat">
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            Tapahtumat
          </h2>
          <SuggestionButton feature="Säpinä / Tapahtumat" context="Esim. puuttuva tapahtuma, väärä tolppa, väärä yleisöarvio" />
        </div>
        <EventsTimeline />
      </section>

      <section aria-label="Kysyntäennuste">
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            Kysyntä tolpilla & Top alueet
          </h2>
          <SuggestionButton feature="Säpinä / Kysyntäennuste" />
        </div>
        <DispatchLiveCard />
      </section>

      <section aria-label="Kyyntiheatmap">
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            Kyyntiheatmap
          </h2>
          <SuggestionButton feature="Säpinä / Kyyntiheatmap" context="Viikonpäivä x tunti -matriisi, EUR/h historiadata" />
        </div>
        <TripHeatmap />
      </section>

    </div>
  );
};

export default SapinaTab;
