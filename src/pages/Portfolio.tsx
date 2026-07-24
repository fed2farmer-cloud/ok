import { useCallback, useEffect, useState } from "react";
import InvestorProtectionCard from "../components/InvestorProtectionCard";
import {
  ProtectedInvestment,
  loadMyProtectedInvestments,
} from "../features/investorProtection/investorProtectionService";

export default function Portfolio() {
  const [investments, setInvestments] = useState<ProtectedInvestment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      setInvestments(await loadMyProtectedInvestments());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load investments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold">My Investments</h1>
      <p className="mt-2 text-slate-600">
        Request eligible refunds during the 7-day investor protection period.
      </p>

      {loading && <p className="mt-6">Loading portfolio...</p>}
      {message && <p className="mt-6 rounded-xl bg-red-50 p-4 text-red-800">{message}</p>}

      <div className="mt-6 space-y-5">
        {investments.map((investment) => (
          <InvestorProtectionCard
            key={investment.id}
            investment={investment}
            onUpdated={() => void load()}
          />
        ))}
      </div>
    </main>
  );
}
