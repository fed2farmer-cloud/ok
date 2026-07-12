import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import AppLayout from "../components/AppLayout";
import { BarChart, DonutChart, Sparkline } from "../components/PortfolioCharts";
import KYCWorkflow from "../components/KYCWorkflow";

interface Investment {
  id: string;
  loan_id: string;
  amount: number;
  investor_interest_rate: number;
  term_months: number;
  status: string;
  created_at: string;
  business_name?: string | null;
}

interface Wallet {
  available_balance: number | null;
  invested_balance: number | null;
  pending_balance: number | null;
}

interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
}

const money = (n: number | null | undefined) =>
  Number(n || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const pct = (n: number) => `${Number(n).toFixed(2)}%`;

const STATUS_CHIP: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  funded: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  completed: "bg-blue-100 text-blue-800",
  defaulted: "bg-rose-100 text-rose-800",
};

function StatCard({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        accent ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-black ${accent ? "text-emerald-700" : "text-slate-950"}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export default function InvestorDashboard() {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const load = useCallback(async () => {
    if (!supabase) {
      setErrorMsg("Supabase not configured.");
      setLoading(false);
      return;
    }
    setErrorMsg("");

    try {
      const {
        data: { user },
        error: ue,
      } = await supabase.auth.getUser();
      if (ue || !user) {
        navigate("/login", { replace: true });
        return;
      }

      const [{ data: w }, { data: inv }, { data: tx }] = await Promise.all([
        supabase
          .from("investor_wallets")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("investments")
          .select("*")
          .eq("investor_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("wallet_transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      setWallet(
        (w as Wallet | null) ?? {
          available_balance: 0,
          invested_balance: 0,
          pending_balance: 0,
        }
      );
      setInvestments((inv as Investment[] | null) ?? []);
      setTransactions((tx as WalletTransaction[] | null) ?? []);
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Unable to load portfolio.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime wallet updates
  useEffect(() => {
    if (!supabase) return;
    let cleanup: (() => void) | undefined;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || !supabase) return;
      const ch = supabase
        .channel("investor-wallet-rt")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "investor_wallets",
            filter: `user_id=eq.${user.id}`,
          },
          (p) => setWallet(p.new as Wallet)
        )
        .subscribe();
      cleanup = () => { supabase?.removeChannel(ch); };
    });
    return () => cleanup?.();
  }, []);

  const stats = useMemo(() => {
    const invested = investments.reduce((s, i) => s + Number(i.amount), 0);
    const activeInv = investments.filter((i) =>
      ["active", "funded"].includes(i.status)
    );
    const avgRate =
      activeInv.length > 0
        ? activeInv.reduce((s, i) => s + Number(i.investor_interest_rate), 0) /
          activeInv.length
        : 0;
    const annualYield = invested * (avgRate / 100);
    const monthlyYield = annualYield / 12;
    return { invested, avgRate, annualYield, monthlyYield };
  }, [investments]);

  const donutSlices = useMemo(() => {
    const byStatus: Record<string, number> = {};
    for (const inv of investments) {
      const s = inv.status ?? "pending";
      byStatus[s] = (byStatus[s] ?? 0) + Number(inv.amount);
    }
    const COLORS: Record<string, string> = {
      active: "#4da855",
      funded: "#4da855",
      pending: "#f0c84a",
      completed: "#3b82f6",
      defaulted: "#ef4444",
    };
    return Object.entries(byStatus).map(([label, value]) => ({
      label,
      value,
      color: COLORS[label] ?? "#94a3b8",
    }));
  }, [investments]);

  const barData = useMemo(() => {
    const months: Record<string, number> = {};
    for (const inv of investments) {
      const d = new Date(inv.created_at);
      const key = d.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      });
      months[key] = (months[key] ?? 0) + Number(inv.amount);
    }
    return Object.entries(months)
      .slice(-6)
      .map(([label, value]) => ({ label, value }));
  }, [investments]);

  const sparkData = useMemo(() => {
    let running = 0;
    return investments
      .slice()
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      .map((i) => {
        running += Number(i.amount);
        return running;
      });
  }, [investments]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
            <p className="text-sm">Loading portfolio…</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const totalPortfolio =
    Number(wallet?.available_balance ?? 0) +
    Number(wallet?.invested_balance ?? 0) +
    Number(wallet?.pending_balance ?? 0);

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Hero banner */}
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-7 text-white shadow-2xl sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">
            Investor Portal
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Your Land-Backed Portfolio
          </h1>
          <div className="mt-6 flex flex-wrap items-end gap-8">
            <div>
              <p className="text-sm text-slate-400">Total Portfolio Value</p>
              <p className="mt-1 font-mono text-4xl font-black">
                {money(totalPortfolio)}
              </p>
            </div>
            {sparkData.length > 1 && (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-slate-400">Growth trend</p>
                <Sparkline data={sparkData} color="#4da855" width={140} height={44} />
              </div>
            )}
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                onClick={() => navigate("/investor-wallet")}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-500"
              >
                Manage Wallet
              </button>
              <button
                onClick={() => navigate("/marketplace")}
                className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/20"
              >
                Browse Deals
              </button>
            </div>
          </div>
        </section>

        {errorMsg && (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            {errorMsg}
          </div>
        )}

        {/* KYC Banner */}
        <div className="mt-6">
          <KYCWorkflow />
        </div>

        {/* Stats */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Available Cash"
            value={money(wallet?.available_balance)}
            sub="Ready to invest"
          />
          <StatCard
            label="Capital Invested"
            value={money(stats.invested)}
            sub={`${investments.length} position${investments.length !== 1 ? "s" : ""}`}
            accent
          />
          <StatCard
            label="Avg. Return"
            value={pct(stats.avgRate)}
            sub="Across active loans"
          />
          <StatCard
            label="Monthly Yield"
            value={money(stats.monthlyYield)}
            sub="Estimated"
          />
        </div>

        {/* Charts */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Portfolio Allocation</h2>
            <p className="mt-0.5 text-xs text-slate-400">By investment status</p>
            <div className="mt-6 flex justify-center">
              {donutSlices.length > 0 ? (
                <DonutChart
                  slices={donutSlices}
                  centerValue={money(stats.invested)}
                  centerLabel="invested"
                  size={200}
                />
              ) : (
                <div className="flex flex-col items-center gap-3 py-12 text-slate-400">
                  <p className="text-sm">No investments yet.</p>
                  <button
                    onClick={() => navigate("/marketplace")}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
                  >
                    Browse Marketplace
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Capital Deployed</h2>
            <p className="mt-0.5 text-xs text-slate-400">By month (last 6)</p>
            <div className="mt-6">
              {barData.length > 0 ? (
                <BarChart data={barData} height={180} />
              ) : (
                <p className="py-12 text-center text-sm text-slate-400">
                  No investment history yet.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Active positions table */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
            <h2 className="text-base font-bold text-slate-900">Active Positions</h2>
            <button
              onClick={() => navigate("/marketplace")}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
            >
              + New Investment
            </button>
          </div>

          {investments.length === 0 ? (
            <div className="p-10 text-center text-slate-400">
              <p className="text-sm">
                No investments yet. Browse the marketplace to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left">
                    {["Loan", "Amount", "Rate", "Term", "Status", "Date"].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {investments.map((inv) => (
                    <tr
                      key={inv.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-5 py-3 font-semibold text-slate-800">
                        {inv.business_name ?? `Loan #${inv.loan_id}`}
                      </td>
                      <td className="px-5 py-3 font-semibold text-emerald-700">
                        {money(inv.amount)}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {pct(inv.investor_interest_rate)}
                      </td>
                      <td className="px-5 py-3 text-slate-500">{inv.term_months}mo</td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                            STATUS_CHIP[inv.status] ?? "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {new Date(inv.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent transactions */}
        {transactions.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-bold text-slate-900">Recent Transactions</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 capitalize">
                      {String(tx.type).replace(/_/g, " ")}
                    </p>
                    {tx.description && (
                      <p className="text-xs text-slate-400">{tx.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-black ${
                        Number(tx.amount) >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {Number(tx.amount) >= 0 ? "+" : ""}
                      {money(tx.amount)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200 px-6 py-3">
              <button
                onClick={() => navigate("/investor-wallet")}
                className="text-xs font-semibold text-emerald-600 hover:underline"
              >
                View all transactions →
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
