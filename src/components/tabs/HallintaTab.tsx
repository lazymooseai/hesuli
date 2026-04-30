import TripsTabs from "@/components/trips/TripsTabs";
import TripHistoryCard from "@/components/trips/TripHistoryCard";
import FeedbackButtons from "@/components/FeedbackButtons";
import DevTools from "@/components/DevTools";
import SuggestionButton from "@/components/SuggestionButton";
import PrebookingsCard from "@/components/PrebookingsCard";

const HallintaTab = () => {
  return (
    <div className="px-4 pt-2 pb-6 space-y-6">
      <section aria-label="Ennakkotilaukset">
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            Ennakkotilaukset
          </h2>
          <SuggestionButton feature="Hallinta / Ennakkotilaukset" />
        </div>
        <p className="text-xs text-muted-foreground/80 mb-2 px-1">
          Beta — siirretään Tutka-näkymään, kun ennuste tunnin sisään saapuvista
          ennakoista on tarpeeksi tarkka.
        </p>
        <PrebookingsCard />
      </section>

      <section aria-label="Reittityökalut ja tuonti">
        <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">
          Työkalut & Datan tuonti
        </h2>
        <TripsTabs />
      </section>

      <section aria-label="Kyytihistoria">
        <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">
          Kyytihistoria
        </h2>
        <TripHistoryCard />
      </section>

      <FeedbackButtons />

      <section aria-label="Kehitysehdotukset" className="rounded-xl border border-border bg-card/40 p-4 space-y-2">
        <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
          Kehitysehdotukset
        </h2>
        <p className="text-sm text-muted-foreground/90">
          Lähetä kehitystiimille konkreettinen ehdotus, virheilmoitus tai uusi
          idea. Pikanappi löytyy myös ruudun oikeasta alakulmasta (lamppu-ikoni)
          ja jokaisen osion otsikon vierestä.
        </p>
        <div className="pt-1">
          <SuggestionButton feature="Hallinta / Yleinen palaute" context="Yleinen kehitysehdotus tai virheilmoitus" />
        </div>
      </section>

      <DevTools />
    </div>
  );
};

export default HallintaTab;