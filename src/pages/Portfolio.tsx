import { useCallback, useEffect, useMemo, useState } from "react";
import AppLayout from "../components/AppLayout";
import PortfolioPositionCard from "../components/PortfolioPositionCard";
import { PortfolioRow, loadInvestorPortfolioV29 } from "../features/investorProtection/portfolioV29Service";

export default function Portfolio() {
  const [investments, setInvestments] = useState<PortfolioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setMessage("");
    try { setInvestments(await loadInvestorPortfolioV29()); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load portfolio."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const summary = useMemo(() => {
    const valid = investments.filter((r) => !["refunded","cancelled","failed"].includes(r.status));
    return {
      portfolioTotal: valid.reduce((t,r) => t + Number(r.amount || 0), 0),
      protectedTotal: valid.filter((r) => ["protection_period","refund_requested","refund_processing"].includes(r.status)).reduce((t,r) => t + Number(r.amount || 0), 0),
      activeTotal: valid.filter((r) => ["active","settled"].includes(r.status)).reduce((t,r) => t + Number(r.amount || 0), 0),
      positions: valid.length,
    };
  }, [investments]);

  const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });

  return (
    <AppLayout>
      <main className="mx-auto max-w-6xl px-4 py-10 text-white">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">Investor Portfolio</p>
        <h1 className="mt-2 text-4xl font-black">My Investments</h1>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-slate-950 p-5"><p className="text-sm text-slate-400">Portfolio Total</p><p className="mt-2 text-2xl font-black">{money(summary.portfolioTotal)}</p></div>
          <div className="rounded-2xl bg-slate-950 p-5"><p className="text-sm text-slate-400">Protected Funds</p><p className="mt-2 text-2xl font-black text-amber-400">{money(summary.protectedTotal)}</p></div>
          <div className="rounded-2xl bg-slate-950 p-5"><p className="text-sm text-slate-400">Active Funds</p><p className="mt-2 text-2xl font-black text-emerald-400">{money(summary.activeTotal)}</p></div>
          <div className="rounded-2xl bg-slate-950 p-5"><p className="text-sm text-slate-400">Positions</p><p className="mt-2 text-2xl font-black">{summary.positions}</p></div>
        </section>

        {loading && <p className="mt-8">Loading portfolio...</p>}
        {message && <p className="mt-8 rounded-xl bg-red-950 p-4 text-red-300">{message}</p>}

        <section className="mt-8 space-y-5">
          {investments.map((investment) => <PortfolioPositionCard key={investment.investment_id} investment={investment} onUpdated={() => void load()} />)}
        </section>
      </main>
    </AppLayout>
  );
}
