import CommandCenter from "@/components/CommandCenter";
import JackpotAlert from "@/components/JackpotAlert";
import NextArrivalsCarousel from "@/components/NextArrivalsCarousel";
import SuggestionButton from "@/components/SuggestionButton";
import DisruptionsCard from "@/components/DisruptionsCard";

const TutkaTab = () => {
  return (
    <div className="px-4 pt-2 pb-6 space-y-6">
      <section aria-label="Suositusalue">
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            Suositusalue
          </h2>
          <SuggestionButton feature="Tutka / Suositusalue" />
        </div>
        <CommandCenter />
        <div className="mt-3">
          <JackpotAlert />
        </div>
      </section>

      <section aria-label="Seuraavat saapujat">
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            Seuraavat saapujat
          </h2>
          <SuggestionButton feature="Tutka / Seuraavat saapujat" />
        </div>
        <NextArrivalsCarousel />
      </section>

      <section aria-label="Häiriötiedote">
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            Häiriötiedote
          </h2>
          <SuggestionButton feature="Tutka / Häiriötiedote" context="Metro, juna, laivat, lentokenttä" />
        </div>
        <DisruptionsCard />
      </section>
    </div>
  );
};

export default TutkaTab;