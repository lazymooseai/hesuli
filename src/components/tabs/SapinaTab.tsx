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
        <EventsTimeline hideTraffic />
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

      <section aria-label="ETA-Sniper">
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            ETA-Sniper
          </h2>
          <SuggestionButton feature="Säpinä / ETA-Sniper" context="Kohde-ehdotukset, matka-aika, tuntiansio" />
        </div>
        <EtaSniperCard radiusKm={10} className="mb-1" />
      </section>

    </div>
  );
};

export default SapinaTab;
