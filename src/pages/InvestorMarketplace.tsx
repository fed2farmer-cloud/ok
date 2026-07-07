import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function InvestorMarketplace() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<any[]>([]);
  const [amounts, setAmounts] = useState<Record<number, string>>({});

  useEffect(() => {
    loadLoans();
  }, []);

  async function loadLoans() {
    if (!supabase) return;

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

  function investNow(loan: any) {
    const amount = Number(amounts[loan.id] || 0);
    const remaining = Number(loan.amount_remaining || loan.funding_goal || 0);

    if (!amount || amount <= 0) {
      alert("Enter an investment amount.");
      return;
    }

    if (amount > remaining) {
      alert("Investment amount cannot be more than the amount remaining.");
      return;
    }

    navigate(`/payment?loanId=${loan.id}&amount=${amount}`);
  }

  if (loading) {
    return <div className="p-8 text-xl">Loading Marketplace...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-green-700 mb-2">
        Investment Marketplace
      </h1>

      <p className="text-gray-600 mb-6">
        Invest in land-backed loans reviewed by SecuredLanding.
      </p>

      {loans.length === 0 ? (
        <p>No investment opportunities available.</p>
      ) : (
        loans.map((loan) => {
          const fundingGoal = Number(loan.funding_goal || loan.loan_amount || 0);
          const funded = Number(loan.amount_funded || 0);
          const remaining = Number(loan.amount_remaining || fundingGoal - funded);
          const percent = fundingGoal > 0 ? Math.min((funded / fundingGoal) * 100, 100) : 0;

          return (
            <div key={loan.id} className="bg-white rounded-xl shadow p-6 mb-6">
              <h2 className="text-2xl font-bold text-green-700">
                {loan.business_name}
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
                  <span>{money(fundingGoal)} goal</span>
                </div>
              </div>

              <div className="mt-5">
                <input
                  type="number"
                  min="1"
                  max={remaining}
                  placeholder="Investment amount"
                  value={amounts[loan.id] || ""}
                  onChange={(e) =>
                    setAmounts({ ...amounts, [loan.id]: e.target.value })
                  }
                  className="w-full border p-3 rounded mb-3"
                />

                <button
                  onClick={() => investNow(loan)}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-bold"
                >
                  Invest Now
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}