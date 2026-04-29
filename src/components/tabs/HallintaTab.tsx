import TripsTabs from "@/components/trips/TripsTabs";
import TripHistoryCard from "@/components/trips/TripHistoryCard";
import FeedbackButtons from "@/components/FeedbackButtons";
import DevTools from "@/components/DevTools";

const HallintaTab = () => {
  return (
    <div className="px-4 pt-2 pb-6 space-y-6">
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
      <DevTools />
    </div>
  );
};

export default HallintaTab;