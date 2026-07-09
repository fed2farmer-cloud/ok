import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function InvestorMarketplace() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<any[]>([]);
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [wallet, setWallet] = useState<any>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    if (!supabase) return;

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: walletData } = await supabase
        .from("investor_wallets")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      setWallet(walletData);
    }

    const { data, error } = await supabase
      .from("marketplace_loans")
      .select("*")
      .eq("status", "Open")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setLoans(data || []);
    setLoading(false);
  }

  function money(value: any) {
    return "$" + Number(value || 0).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  }

  async function investNow(loan: any) {
    const amount = Number(amounts[loan.id] || 0);
    const remaining = Number(loan.amount_remaining || loan.funding_goal || 0);
    const walletBalance = Number(wallet?.available_balance || 0);

    if (!amount || amount < 100) {
      alert("Minimum investment is $100.");
      return;
    }

    if (amount > remaining) {
      alert("Investment cannot be more than the amount remaining.");
      return;
    }

    if (walletBalance < amount) {
      alert(
        `Wallet balance is too low. Available: ${money(
          walletBalance
        )}. You can deposit funds or pay another way.`
      );

      navigate(`/payment?loanId=${loan.loan_application_id}&amount=${amount}`);
      return;
    }

    const confirmInvestment = confirm(
      `Invest ${money(amount)} from your wallet into ${
        loan.business_name || "this loan"
      }?`
    );

    if (!confirmInvestment) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      alert("Please log in again.");
      navigate("/login");
      return;
    }

    setProcessingId(loan.id);

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
    setProcessingId(null);

    if (!response.ok) {
      alert(result.error || "Investment failed.");
      return;
    }

    alert("Investment funded from wallet.");
    setAmounts({ ...amounts, [loan.id]: "" });
    await loadPage();
  }

  if (loading) return <div className="p-8 text-xl">Loading Marketplace...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-green-700 mb-2">
        Investment Marketplace
      </h1>

      <p className="text-gray-600 mb-4">
        Invest in land-backed loans reviewed by SecuredLanding.
      </p>

      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <p className="text-gray-500">Available Wallet Cash</p>
        <h2 className="text-2xl font-bold">
          {money(wallet?.available_balance)}
        </h2>
      </div>

      {loans.length === 0 ? (
        <p>No investment opportunities available.</p>
      ) : (
        loans.map((loan) => {
          const goal = Number(loan.funding_goal || loan.loan_amount || 0);
          const funded = Number(loan.amount_funded || 0);
          const remaining = Number(loan.amount_remaining || goal - funded);
          const percent = goal > 0 ? Math.min((funded / goal) * 100, 100) : 0;

          return (
            <div key={loan.id} className="bg-white rounded-xl shadow p-6 mb-6">
              <h2 className="text-2xl font-bold text-green-700">
                {loan.business_name || "Land Investment"}
              </h2>

              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div>
                  <p><strong>Borrower:</strong> {loan.borrower_name}</p>
                  <p><strong>APN:</strong> {loan.apn}</p>
                  <p><strong>State:</strong> {loan.state}</p>
                  <p><strong>Acres:</strong> {loan.acreage}</p>
                  <p><strong>Risk Score:</strong> {loan.risk_score}</p>
                </div>

                <div>
                  <p><strong>Land Value:</strong> {money(loan.land_value)}</p>
                  <p><strong>Loan Amount:</strong> {money(loan.loan_amount)}</p>
                  <p><strong>Investor Return:</strong> {loan.investor_interest_rate}%</p>
                  <p><strong>Amount Remaining:</strong> {money(remaining)}</p>
                  <p><strong>Status:</strong> {loan.status}</p>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex justify-between text-sm mb-1">
                  <span>Funding Progress</span>
                  <span>{percent.toFixed(0)}%</span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-green-600 h-4 rounded-full"
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <div className="flex justify-between text-sm mt-1">
                  <span>{money(funded)} funded</span>
                  <span>{money(goal)} goal</span>
                </div>
              </div>

              <input
                type="number"
                min="100"
                max={remaining}
                placeholder="Enter investment amount"
                value={amounts[loan.id] || ""}
                onChange={(e) =>
                  setAmounts({ ...amounts, [loan.id]: e.target.value })
                }
                className="mt-5 w-full border p-3 rounded"
              />

              <button
                onClick={() => investNow(loan)}
                disabled={processingId === loan.id}
                className="mt-3 w-full bg-green-600 text-white py-3 rounded-lg font-bold disabled:bg-gray-400"
              >
                {processingId === loan.id ? "Processing..." : "Invest From Wallet"}
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}