import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import AppLayout from "../components/AppLayout";

type MarketplaceLoan = {
  id: number;
  loan_application_id: string;
  loan_number?: number | null;
  business_name?: string | null;
  borrower_name?: string | null;
  apn?: string | null;
  state?: string | null;
  acreage?: number | null;
  risk_score?: string | null;
  land_value?: number | null;
  loan_amount?: number | null;
  funding_goal?: number | null;
  amount_funded?: number | null;
  amount_remaining?: number | null;
  investor_interest_rate?: number | null;
  status?: string | null;
  created_at?: string | null;
  borrower_video_path?: string | null;
  borrower_video_status?: string | null;
};


function ApprovedBorrowerVideo({ storagePath }: { storagePath: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!supabase) return;
    void supabase.storage
      .from("borrower-videos")
      .createSignedUrl(storagePath, 3600)
      .then(({ data, error }) => {
        if (active && !error && data?.signedUrl) setUrl(data.signedUrl);
      });
    return () => { active = false; };
  }, [storagePath]);

  if (!url) {
    return <div className="mt-5 rounded-xl bg-slate-100 p-4 text-sm text-slate-500">Loading approved borrower video…</div>;
  }

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-emerald-100 bg-black shadow-sm">
      <div className="bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">Approved borrower introduction</div>
      <video src={url} controls preload="metadata" className="max-h-[520px] w-full bg-black object-contain" />
    </div>
  );
}

type InvestorWallet = {
  id?: string;
  user_id?: string;
  available_balance?: number | null;
  pending_balance?: number | null;
  invested_balance?: number | null;
};

export default function InvestorMarketplace() {
  const navigate = useNavigate();

  const [loans, setLoans] = useState<MarketplaceLoan[]>([]);
  const [wallet, setWallet] = useState<InvestorWallet | null>(null);
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [processingLoanId, setProcessingLoanId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const loadMarketplace = useCallback(async (silent = false) => {
    if (!supabase) {
      setErrorMessage("Supabase is not configured.");
      setLoading(false);
      return;
    }

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        navigate("/login", { replace: true });
        return;
      }

      const [
        { data: walletData, error: walletError },
        { data: loanData, error: loanError },
      ] = await Promise.all([
        supabase
          .from("investor_wallets")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),

        supabase
          .from("marketplace_loans")
          .select("*")
          .eq("status", "Open")
          .order("created_at", { ascending: false }),
      ]);

      if (walletError) {
        throw walletError;
      }

      if (loanError) {
        throw loanError;
      }

      setWallet(walletData || null);
      setLoans((loanData as MarketplaceLoan[] | null) || []);
    } catch (error: any) {
      setErrorMessage(
        error?.message || "Unable to load investment opportunities."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadMarketplace();

    const refreshTimer = window.setInterval(() => {
      loadMarketplace(true);
    }, 15000);

    return () => {
      window.clearInterval(refreshTimer);
    };
  }, [loadMarketplace]);

  // Realtime: live funding progress on both investor & borrower dashboards
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase
      .channel("marketplace-investor-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "marketplace_loans" },
        () => loadMarketplace(true)
      )
      .subscribe();
    return () => { supabase?.removeChannel(ch); };
  }, [loadMarketplace]);

  function money(value: unknown) {
    return Number(value || 0).toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  function getLoanGoal(loan: MarketplaceLoan) {
    return Number(loan.funding_goal ?? loan.loan_amount ?? 0);
  }

  function getAmountFunded(loan: MarketplaceLoan) {
    return Number(loan.amount_funded || 0);
  }

  function getAmountRemaining(loan: MarketplaceLoan) {
    const goal = getLoanGoal(loan);
    const funded = getAmountFunded(loan);

    if (
      loan.amount_remaining !== null &&
      loan.amount_remaining !== undefined
    ) {
      return Math.max(Number(loan.amount_remaining), 0);
    }

    return Math.max(goal - funded, 0);
  }

  function getFundingPercentage(loan: MarketplaceLoan) {
    const goal = getLoanGoal(loan);
    const funded = getAmountFunded(loan);

    if (goal <= 0) {
      return 0;
    }

    return Math.min(Math.max((funded / goal) * 100, 0), 100);
  }

  async function logout() {
    if (!supabase) return;

    await supabase.auth.signOut();
    navigate("/", { replace: true });
  }

  async function investFromWallet(loan: MarketplaceLoan) {
    if (!supabase) return;

    setMessage("");
    setErrorMessage("");

    const amount = Number(amounts[loan.id] || 0);
    const remaining = getAmountRemaining(loan);
    const availableBalance = Number(wallet?.available_balance || 0);

    if (!amount || amount < 100) {
      setErrorMessage("The minimum investment is $100.");
      return;
    }

    if (amount > remaining) {
      setErrorMessage(
        `Your investment cannot exceed the remaining amount of ${money(
          remaining
        )}.`
      );
      return;
    }

    if (amount > availableBalance) {
      setErrorMessage(
        `Wallet balance is too low. Available: ${money(
          availableBalance
        )}. Deposit funds before investing.`
      );
      return;
    }

    const confirmed = window.confirm(
      `Invest ${money(amount)} from your wallet into ${
        loan.business_name || "this loan"
      }?`
    );

    if (!confirmed) {
      return;
    }

    setProcessingLoanId(loan.id);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        navigate("/login", { replace: true });
        return;
      }

      const response = await fetch("/api/invest-from-wallet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          loan_id: loan.loan_application_id,
          amount,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Investment failed.");
      }

      setMessage(
        result.message ||
          `${money(amount)} was successfully invested from your wallet.`
      );

      setAmounts((current) => ({
        ...current,
        [loan.id]: "",
      }));

      await loadMarketplace(true);
    } catch (error: any) {
      setErrorMessage(error?.message || "Investment failed.");
    } finally {
      setProcessingLoanId(null);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
            <p className="text-sm">Loading investment marketplace…</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const availableBalance = Number(wallet?.available_balance || 0);
  const walletEmpty = availableBalance < 100;

  return (
    <AppLayout>
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-green-700">
            Investment Marketplace
          </h1>

          <p className="mt-1 text-gray-600">
            Invest in land-backed loans reviewed by SecuredLanding.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate("/investor-wallet")}
            className="rounded-lg bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700"
          >
            Back to Wallet
          </button>

          <button
            type="button"
            onClick={logout}
            className="rounded-lg bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Zero-balance NMI call-to-action */}
      {walletEmpty && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="font-bold text-amber-800">
            💳 Your wallet balance is {money(availableBalance)} — too low to invest from wallet.
          </p>
          <p className="mt-1 text-sm text-amber-700">
            Enter an investment amount below and click <strong>Pay with Card (NMI)</strong> to fund directly with a credit or debit card. Your investment is recorded automatically after payment.
          </p>
          <button
            type="button"
            onClick={() => navigate("/investor-wallet")}
            className="mt-3 rounded-xl bg-amber-500 px-5 py-2 text-sm font-bold text-white hover:bg-amber-600"
          >
            Add Funds to Wallet First →
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {errorMessage}
        </div>
      )}

      {message && (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 font-bold text-green-700">
          {message}
        </div>
      )}

      <div className="mt-6 rounded-xl bg-white p-5 shadow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500">
              Available Wallet Cash
            </p>

            <p className="mt-1 text-2xl font-bold">
              {money(wallet?.available_balance)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/investor-wallet")}
            className="rounded-lg border border-green-600 px-4 py-2 font-bold text-green-700 hover:bg-green-50"
          >
            Deposit Funds
          </button>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={() => loadMarketplace()}
          disabled={refreshing}
          className="rounded-lg bg-gray-700 px-4 py-2 font-bold text-white disabled:opacity-50"
        >
          {refreshing ? "Refreshing..." : "Refresh Opportunities"}
        </button>
      </div>

      {loans.length === 0 ? (
        <div className="mt-6 rounded-xl bg-white p-6 shadow">
          <p className="text-gray-600">
            No investment opportunities are currently available.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-6">
          {loans.map((loan) => {
            const goal = getLoanGoal(loan);
            const funded = getAmountFunded(loan);
            const remaining = getAmountRemaining(loan);
            const percentage = getFundingPercentage(loan);
            const investmentAmount = Number(amounts[loan.id] || 0);

            const isProcessing = processingLoanId === loan.id;

            const exceedsBalance =
              investmentAmount > 0 &&
              investmentAmount > availableBalance;

            const exceedsRemaining =
              investmentAmount > 0 &&
              investmentAmount > remaining;

            return (
              <div
                key={loan.id}
                className="rounded-xl bg-white p-5 shadow sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="text-2xl font-bold text-green-700">
                    {loan.business_name || "No Business Name"}
                  </h2>

                  <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-bold text-blue-800">
                    {loan.status || "Open"}
                  </span>
                </div>

                {loan.borrower_video_status === "approved" && loan.borrower_video_path && (
                  <ApprovedBorrowerVideo storagePath={loan.borrower_video_path} />
                )}

                <div className="mt-5 grid gap-4 text-gray-700 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p>
                      <strong>Borrower:</strong>{" "}
                      {loan.borrower_name || "Not provided"}
                    </p>

                    <p>
                      <strong>APN:</strong>{" "}
                      {loan.apn || "Not provided"}
                    </p>

                    <p>
                      <strong>State:</strong>{" "}
                      {loan.state || "Not provided"}
                    </p>

                    <p>
                      <strong>Acres:</strong>{" "}
                      {loan.acreage ?? "Not provided"}
                    </p>

                    <p>
                      <strong>Risk Score:</strong>{" "}
                      {loan.risk_score || "Not rated"}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p>
                      <strong>Land Value:</strong>{" "}
                      {money(loan.land_value)}
                    </p>

                    <p>
                      <strong>Loan Amount:</strong>{" "}
                      {money(goal)}
                    </p>

                    <p>
                      <strong>Investor Return:</strong>{" "}
                      {Number(
                        loan.investor_interest_rate || 9
                      ).toFixed(2)}
                      %
                    </p>

                    <p>
                      <strong>Amount Remaining:</strong>{" "}
                      {money(remaining)}
                    </p>

                    <p>
                      <strong>Loan ID:</strong>{" "}
                      {loan.loan_number ?? loan.loan_application_id}
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex justify-between gap-4 text-sm">
                    <span>Funding Progress</span>

                    <span className="font-bold">
                      {percentage.toFixed(0)}%
                    </span>
                  </div>

                  <div
                    className="mt-2 h-4 w-full overflow-hidden rounded-full bg-gray-200"
                    role="progressbar"
                    aria-valuenow={percentage}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-4 rounded-full bg-green-600 transition-all"
                      style={{
                        width: `${percentage}%`,
                      }}
                    />
                  </div>

                  <div className="mt-2 flex justify-between gap-4 text-sm">
                    <span>{money(funded)} funded</span>
                    <span>{money(goal)} goal</span>
                  </div>
                </div>

                <div className="mt-5">
                  <label
                    htmlFor={`investment-${loan.id}`}
                    className="mb-2 block font-bold text-gray-700"
                  >
                    Investment amount
                  </label>

                  <input
                    id={`investment-${loan.id}`}
                    type="number"
                    min="100"
                    step="1"
                    max={remaining}
                    placeholder="Minimum investment $100"
                    value={amounts[loan.id] || ""}
                    onChange={(event) =>
                      setAmounts((current) => ({
                        ...current,
                        [loan.id]: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  />

                  {exceedsBalance && !exceedsRemaining && (
                    <p className="mt-2 text-sm font-bold text-amber-700">
                      Wallet balance too low — use <strong>Pay with Card (NMI)</strong> below to fund this investment directly.
                    </p>
                  )}

                  {exceedsRemaining && (
                    <p className="mt-2 text-sm font-bold text-red-600">
                      This amount exceeds the loan's remaining funding need of{" "}
                      {money(remaining)}.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => investFromWallet(loan)}
                  disabled={
                    isProcessing ||
                    remaining <= 0 ||
                    availableBalance < 100 ||
                    exceedsBalance ||
                    exceedsRemaining
                  }
                  className="mt-4 w-full rounded-lg bg-green-600 py-3 font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {isProcessing
                    ? "Processing Investment..."
                    : remaining <= 0
                      ? "Loan Fully Funded"
                      : "Invest From Wallet"}
                </button>

                {remaining > 0 && investmentAmount >= 100 && !exceedsRemaining && (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/payment?loanId=${loan.loan_number ?? loan.loan_application_id}&amount=${investmentAmount}`
                      )
                    }
                    className="mt-2 w-full rounded-lg bg-blue-600 py-3 font-bold text-white hover:bg-blue-700"
                  >
                    {walletEmpty ? "💳 Pay with Card (NMI) — No Wallet Needed" : "Pay with Card (NMI)"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
    </AppLayout>
  );
}