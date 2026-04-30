import { useState } from "react";
import { DashboardProvider } from "@/context/DashboardContext";
import DashboardHeader from "@/components/DashboardHeader";
import HslTicker from "@/components/HslTicker";
import ScanButton from "@/components/ScanButton";
import BottomNav, { TabKey } from "@/components/BottomNav";
import TutkaTab from "@/components/tabs/TutkaTab";
import LiikenneTab from "@/components/tabs/LiikenneTab";
import SapinaTab from "@/components/tabs/SapinaTab";
import HallintaTab from "@/components/tabs/HallintaTab";
import SuggestionButton from "@/components/SuggestionButton";

const Index = () => {
  const [tab, setTab] = useState<TabKey>("tutka");

  return (
    <DashboardProvider>
      <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
        <DashboardHeader />
        <HslTicker />
        <main className="flex-1 pb-32 w-full max-w-screen-md mx-auto">
          {tab === "tutka" && <TutkaTab />}
          {tab === "liikenne" && <LiikenneTab />}
          {tab === "sapina" && <SapinaTab />}
          {tab === "hallinta" && <HallintaTab />}
        </main>
        <ScanButton />
        <BottomNav active={tab} onChange={setTab} />
        <SuggestionButton
          feature={`Yleinen / ${tab}`}
          context="Kelluva palautenappi — koskee aktiivista välilehteä"
          variant="floating"
        />
      </div>
    </DashboardProvider>
  );
};

export default Index;
