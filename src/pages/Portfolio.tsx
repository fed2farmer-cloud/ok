import { useCallback, useEffect, useState } from "react";
import PortfolioInvestmentCard from "../components/PortfolioInvestmentCard";
import {
  PortfolioInvestment,
  loadMyPortfolio,
} from "../features/investorProtection/investorProtectionService";

export default function Portfolio() {
  const [investments, setInvestments] = useState<PortfolioInvestment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      setInvestments(await loadMyPortfolio());
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to load portfolio."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-white">
      <h1 className="text-3xl font-bold">My Investments</h1>
      <p className="mt-2 text-slate-400">
        Track positions and request eligible refunds during the investor
        protection period.
      </p>

      {loading && <p className="mt-6">Loading portfolio...</p>}

      {message && (
        <p className="mt-6 rounded-xl bg-red-950 p-4 text-red-300">
          {message}
        </p>
      )}

      <div className="mt-6 space-y-5">
        {investments.map((investment) => (
          <PortfolioInvestmentCard
            key={investment.id}
            investment={investment}
            onUpdated={() => void load()}
          />
        ))}
      </div>
    </main>
  );
}
