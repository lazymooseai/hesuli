/**
 * RefreshButton.tsx
 *
 * Pakottaa kaikkien lahteiden uudelleenhaun (junat, lennot, sää, laivat,
 * tapahtumat, urheilu).
 */

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useDashboard } from "@/context/DashboardContext";
import { toast } from "sonner";

const RefreshButton = () => {
  const { refreshAll, refreshTrains, isLoading } = useDashboard();
  const [spinning, setSpinning] = useState(false);

  const handle = async () => {
    setSpinning(true);
    try {
      await Promise.all([refreshAll(), refreshTrains()]);
      toast.success("Päivitetty");
    } catch (e) {
      toast.error("Päivitys epäonnistui");
    } finally {
      setTimeout(() => setSpinning(false), 600);
    }
  };

  return (
    <button
      onClick={handle}
      disabled={spinning || isLoading}
      className="h-11 w-11 rounded-lg bg-card border border-border flex items-center justify-center active:scale-95 transition-all disabled:opacity-60"
      aria-label="Päivitä kaikki"
      title="Päivitä kaikki tiedot"
    >
      <RefreshCw className={`h-6 w-6 text-primary ${spinning || isLoading ? "animate-spin" : ""}`} />
    </button>
  );
};

export default RefreshButton;
