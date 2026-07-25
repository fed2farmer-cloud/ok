import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { resolveStorageUrl } from "../lib/mediaStorage";

type MarketplaceLoan = {
  id: number;
  loan_application_id: number | string;
  loan_number?: number | null;
  business_name?: string | null;
  borrower_name?: string | null;
  apn?: string | null;
  county?: string | null;
  state?: string | null;
  land_type?: string | null;
  acreage?: number | null;
  risk_score?: string | null;
  land_value?: number | null;
  loan_amount?: number | null;
  funding_goal?: number | null;
  amount_funded?: number | null;
  amount_remaining?: number | null;
  investor_interest_rate?: number | null;
  repayment_term_months?: number | null;
  status?: string | null;
  borrower_video_path?: string | null;
  borrower_video_status?: string | null;
  investor_refund_enabled?: boolean | null;
  investor_refund_days?: number | null;
  created_at?: string | null;
};

type InvestorWallet = {
  available_balance: number | null;
  invested_balance: number | null;
};

type PaymentMethod = "wallet" | "card" | "bitcoin";
type SortMode = "newest" | "rate" | "amount" | "funded";

function money(value: unknown): string {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function errorText(error: unknown, fallback: string): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const value = error as Record<string, unknown>;
    for (const key of ["message", "details", "hint"]) {
      if (typeof value[key] === "string" && value[key]) {
        return String(value[key]);
      }
    }
  }
  return fallback;
}

function InvestorMarketplace() {
  const navigate = useNavigate();
  const [loans, setLoans] = useState<MarketplaceLoan[]>([]);
  const [wallet, setWallet] = useState<InvestorWallet | null>(null);
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [methods, setMethods] = useState<Record<number, PaymentMethod>>({});
  const [videoUrls, setVideoUrls] = useState<Record<number, string>>({});
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("All");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingLoanId, setProcessingLoanId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadMarketplace = useCallback(async (silent = false) => {
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }

    silent ? setRefreshing(true) : setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }

      const [walletResult, loanResult] = await Promise.all([
        supabase
          .from("investor_wallets")
          .select("available_balance,invested_balance")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("marketplace_loans")
          .select("*")
          .eq("status", "Open")
          .order("created_at", { ascending: false }),
      ]);

      if (walletResult.error) throw walletResult.error;
      if (loanResult.error) throw loanResult.error;

      const nextLoans = (loanResult.data || []) as MarketplaceLoan[];
      setWallet((walletResult.data as InvestorWallet | null) || null);
      setLoans(nextLoans);

      const approvedVideos = nextLoans.filter(
        (loan) =>
          loan.borrower_video_status === "approved" &&
          Boolean(loan.borrower_video_path)
      );

      const resolved = await Promise.all(
        approvedVideos.map(async (loan) => {
          const url = await resolveStorageUrl(
            "borrower-videos",
            String(loan.borrower_video_path || "")
          );
          return [loan.id, url] as const;
        })
      );

      setVideoUrls(
        Object.fromEntries(resolved.filter(([, url]) => Boolean(url))) as Record<
          number,
          string
        >
      );
    } catch (loadError: unknown) {
      setError(
        errorText(loadError, "Unable to load marketplace opportunities.")
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigate]);

  useEffect(() => {
    void loadMarketplace();
  }, [loadMarketplace]);

  const states = useMemo(() => {
    const values = loans
      .map((loan) => loan.state)
      .filter((value): value is string => Boolean(value));
    return ["All", ...Array.from(new Set(values)).sort()];
  }, [loans]);

  const visibleLoans = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = loans.filter((loan) => {
      const matchesQuery =
        !query ||
        [
          loan.business_name,
          loan.borrower_name,
          loan.state,
          loan.county,
          loan.apn,
          loan.loan_number,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query)
        );

      const matchesState =
        stateFilter === "All" || loan.state === stateFilter;

      return matchesQuery && matchesState;
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === "rate") {
        return (
          Number(b.investor_interest_rate || 0) -
          Number(a.investor_interest_rate || 0)
        );
      }
      if (sortMode === "amount") {
        return (
          Number(a.funding_goal ?? a.loan_amount ?? 0) -
          Number(b.funding_goal ?? b.loan_amount ?? 0)
        );
      }
      if (sortMode === "funded") {
        const aGoal = Math.max(Number(a.funding_goal ?? a.loan_amount ?? 1), 1);
        const bGoal = Math.max(Number(b.funding_goal ?? b.loan_amount ?? 1), 1);
        return (
          Number(b.amount_funded || 0) / bGoal -
          Number(a.amount_funded || 0) / aGoal
        );
      }
      return (
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
      );
    });
  }, [loans, search, sortMode, stateFilter]);

  async function investFromWallet(
    loan: MarketplaceLoan,
    amount: number,
    remaining: number
  ) {
    if (!supabase) return;

    const loanNumber = Number(loan.loan_number ?? loan.loan_application_id);
    const available = Number(wallet?.available_balance || 0);

    if (!Number.isFinite(amount) || amount < 100) {
      setError("The minimum investment is $100.");
      return;
    }
    if (amount > remaining) {
      setError("The investment exceeds the amount remaining on this loan.");
      return;
    }
    if (amount > available) {
      setError(
        `Your wallet has ${money(
          available
        )} available. Select debit/credit card or Bitcoin.`
      );
      return;
    }

    setProcessingLoanId(loan.id);
    setError("");
    setMessage("");

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "invest_from_wallet_v28",
        {
          p_loan_number: loanNumber,
          p_amount: amount,
        }
      );

      if (rpcError) throw rpcError;
      if (!data) throw new Error("No investment record was returned.");

      setAmounts((current) => ({ ...current, [loan.id]: "" }));
      setMessage(
        `${money(amount)} was invested in Loan #${loanNumber} from wallet cash.`
      );
      await loadMarketplace(true);
      window.setTimeout(() => navigate("/portfolio"), 700);
    } catch (investmentError: unknown) {
      setError(
        errorText(
          investmentError,
          "The wallet investment could not be completed."
        )
      );
    } finally {
      setProcessingLoanId(null);
    }
  }

  function payByCard(
    loan: MarketplaceLoan,
    amount: number,
    remaining: number
  ) {
    if (!Number.isFinite(amount) || amount < 100) {
      setError("The minimum investment is $100.");
      return;
    }
    if (amount > remaining) {
      setError("The investment exceeds the amount remaining on this loan.");
      return;
    }

    const loanNumber = loan.loan_number ?? loan.loan_application_id;
    navigate(
      `/payment?loanId=${encodeURIComponent(
        String(loanNumber)
      )}&amount=${encodeURIComponent(String(amount))}&method=card`
    );
  }

  function payByBitcoin(
    loan: MarketplaceLoan,
    amount: number,
    remaining: number
  ) {
    if (!Number.isFinite(amount) || amount < 100) {
      setError("The minimum investment is $100.");
      return;
    }
    if (amount > remaining) {
      setError("The investment exceeds the amount remaining on this loan.");
      return;
    }

    const loanNumber = loan.loan_number ?? loan.loan_application_id;
    navigate(
      `/bitcoin-payment?loanId=${encodeURIComponent(
        String(loanNumber)
      )}&amount=${encodeURIComponent(String(amount))}`
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <div className="mx-auto max-w-6xl animate-pulse rounded-3xl bg-slate-900 p-12">
          Loading investment marketplace…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-emerald-400">
              Investment Marketplace
            </h1>
            <p className="mt-2 text-slate-300">
              Invest in reviewed land-backed opportunities using wallet cash,
              debit/credit card, or Bitcoin.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate("/investor-wallet")}
              className="rounded-xl border border-emerald-500 px-4 py-3 font-bold text-emerald-300"
            >
              Back to Wallet
            </button>
            <button
              type="button"
              onClick={() => void loadMarketplace(true)}
              disabled={refreshing}
              className="rounded-xl bg-slate-700 px-4 py-3 font-bold disabled:opacity-60"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-5 rounded-2xl border border-rose-500 bg-rose-950/50 p-4 text-rose-100">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-5 rounded-2xl border border-emerald-500 bg-emerald-950/50 p-4 text-emerald-100">
            {message}
          </div>
        )}

        <section className="mb-8 grid gap-4 rounded-3xl bg-slate-900 p-6 sm:grid-cols-2">
          <div>
            <p className="text-sm text-slate-400">Available Wallet Cash</p>
            <p className="mt-2 text-3xl font-black">
              {money(wallet?.available_balance)}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Invested Balance</p>
            <p className="mt-2 text-3xl font-black text-emerald-400">
              {money(wallet?.invested_balance)}
            </p>
          </div>
        </section>

        <section className="mb-8 grid gap-3 rounded-2xl bg-slate-900 p-4 md:grid-cols-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search business, borrower, state, APN…"
            className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 md:col-span-2"
          />
          <select
            value={stateFilter}
            onChange={(event) => setStateFilter(event.target.value)}
            className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-3"
          >
            {states.map((state) => (
              <option key={state}>{state}</option>
            ))}
          </select>
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-3"
          >
            <option value="newest">Newest first</option>
            <option value="rate">Highest return</option>
            <option value="amount">Lowest loan amount</option>
            <option value="funded">Most funded</option>
          </select>
        </section>

        <div className="space-y-7">
          {visibleLoans.map((loan) => {
            const goal = Number(loan.funding_goal ?? loan.loan_amount ?? 0);
            const funded = Number(loan.amount_funded || 0);
            const remaining = Math.max(
              Number(loan.amount_remaining ?? goal - funded),
              0
            );
            const progress = goal > 0 ? Math.min((funded / goal) * 100, 100) : 0;
            const amount = Number(amounts[loan.id] || 0);
            const available = Number(wallet?.available_balance || 0);
            const method =
              methods[loan.id] || (amount > available ? "card" : "wallet");
            const invalidAmount =
              !Number.isFinite(amount) || amount < 100 || amount > remaining;
            const walletDisabled = invalidAmount || amount > available;
            const refundDays = loan.investor_refund_days ?? 7;
            const loanNumber = loan.loan_number ?? loan.loan_application_id;

            return (
              <article
                key={loan.id}
                className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-emerald-400">
                      {loan.business_name || "No Business Name"}
                    </h2>
                    <p className="mt-1 text-slate-400">Loan #{loanNumber}</p>
                  </div>
                  <span className="rounded-full bg-emerald-950 px-4 py-2 font-bold text-emerald-300">
                    {loan.status || "Open"}
                  </span>
                </div>

                {loan.investor_refund_enabled !== false && (
                  <div className="mt-4 inline-flex rounded-full border border-emerald-700 bg-emerald-950 px-4 py-2 text-sm font-bold text-emerald-300">
                    🛡️ {refundDays}-Day Investment Protection
                  </div>
                )}

                {videoUrls[loan.id] && (
                  <video
                    controls
                    playsInline
                    preload="metadata"
                    className="mt-5 w-full rounded-2xl bg-black"
                    src={videoUrls[loan.id]}
                  />
                )}

                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <p><strong>Borrower:</strong> {loan.borrower_name || "Not provided"}</p>
                  <p><strong>APN:</strong> {loan.apn || "Not provided"}</p>
                  <p><strong>Location:</strong> {[loan.county, loan.state].filter(Boolean).join(", ") || "Not provided"}</p>
                  <p><strong>Land type:</strong> {loan.land_type || "Not provided"}</p>
                  <p><strong>Acres:</strong> {loan.acreage ?? "Not provided"}</p>
                  <p><strong>Risk:</strong> {loan.risk_score || "Not rated"}</p>
                  <p><strong>Land value:</strong> {money(loan.land_value)}</p>
                  <p><strong>Loan amount:</strong> {money(goal)}</p>
                  <p><strong>Investor return:</strong> {Number(loan.investor_interest_rate || 9).toFixed(2)}%</p>
                  <p><strong>Term:</strong> {loan.repayment_term_months || 36} months</p>
                  <p><strong>Remaining:</strong> {money(remaining)}</p>
                </div>

                <div className="mt-6">
                  <div className="mb-2 flex justify-between text-sm">
                    <span>{money(funded)} funded</span>
                    <span>{progress.toFixed(0)}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-700">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="mt-2 text-right text-sm text-slate-400">
                    {money(goal)} goal
                  </div>
                </div>

                <div className="mt-6">
                  <label className="mb-2 block font-bold" htmlFor={`amount-${loan.id}`}>
                    Investment amount
                  </label>
                  <input
                    id={`amount-${loan.id}`}
                    type="number"
                    min="100"
                    step="1"
                    value={amounts[loan.id] || ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      setAmounts((current) => ({ ...current, [loan.id]: value }));
                      if (Number(value || 0) > available) {
                        setMethods((current) => ({ ...current, [loan.id]: "card" }));
                      }
                    }}
                    placeholder="Minimum $100"
                    className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-3"
                  />
                </div>

                <section className="mt-5 rounded-2xl border border-slate-700 bg-slate-950 p-4">
                  <h3 className="font-black">Choose Payment Method</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Wallet cash available: {money(available)}
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {(["wallet", "card", "bitcoin"] as PaymentMethod[]).map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() =>
                          setMethods((current) => ({ ...current, [loan.id]: item }))
                        }
                        className={`rounded-xl border px-4 py-3 font-bold capitalize ${
                          method === item
                            ? "border-emerald-400 bg-emerald-950 text-emerald-300"
                            : "border-slate-700 bg-slate-900 text-slate-300"
                        }`}
                      >
                        {item === "card" ? "Debit / Credit" : item}
                      </button>
                    ))}
                  </div>

                  {amount > available && amount > 0 && (
                    <div className="mt-4 rounded-xl border border-amber-700 bg-amber-950/40 p-3 text-amber-200">
                      This amount exceeds your wallet balance. Card and Bitcoin remain available.
                    </div>
                  )}

                  {method === "wallet" && (
                    <button
                      type="button"
                      disabled={walletDisabled || processingLoanId === loan.id}
                      onClick={() => void investFromWallet(loan, amount, remaining)}
                      className="mt-4 w-full rounded-xl bg-emerald-600 py-4 text-lg font-black disabled:bg-slate-600"
                    >
                      {processingLoanId === loan.id
                        ? "Processing Investment…"
                        : "Invest From Wallet"}
                    </button>
                  )}

                  {method === "card" && (
                    <button
                      type="button"
                      disabled={invalidAmount}
                      onClick={() => payByCard(loan, amount, remaining)}
                      className="mt-4 w-full rounded-xl bg-blue-700 py-4 text-lg font-black disabled:bg-slate-600"
                    >
                      Pay by Debit / Credit Card
                    </button>
                  )}

                  {method === "bitcoin" && (
                    <button
                      type="button"
                      disabled={invalidAmount}
                      onClick={() => payByBitcoin(loan, amount, remaining)}
                      className="mt-4 w-full rounded-xl bg-orange-500 py-4 text-lg font-black disabled:bg-slate-600"
                    >
                      Pay with Bitcoin
                    </button>
                  )}
                </section>
              </article>
            );
          })}

          {visibleLoans.length === 0 && (
            <div className="rounded-2xl bg-slate-900 p-10 text-center text-slate-300">
              No opportunities match the selected filters.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default InvestorMarketplace;
