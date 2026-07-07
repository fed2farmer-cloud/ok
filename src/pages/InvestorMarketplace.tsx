import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function InvestorMarketplace() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<any[]>([]);

  useEffect(() => {
    loadLoans();
  }, []);

  async function loadLoans() {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("marketplace_loans")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert(error.message);
      setLoading(false);
      return;
    }

    setLoans(data ?? []);
    setLoading(false);
  }

  function money(value: any) {
    return "$" + Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-xl">
        Loading Marketplace...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-green-700 mb-2">
          Investment Marketplace
        </h1>

        <p className="text-gray-600 mb-8">
          Invest in land-backed loans reviewed by SecuredLanding.
        </p>

        {loans.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center">
            <h2 className="text-2xl font-bold mb-3">
              No Investment Opportunities
            </h2>

            <p className="text-gray-600">
              Approved loans will appear here after an administrator publishes
              them.
            </p>
          </div>
        ) : (
          loans.map((loan) => {
            const fundingGoal = Number(loan.funding_goal || loan.loan_amount || 0);
            const funded = Number(loan.amount_funded || 0);

            const percent =
              fundingGoal > 0
                ? Math.min((funded / fundingGoal) * 100, 100)
                : 0;

            return (
              <div
                key={loan.id}
                className="bg-white rounded-xl shadow-lg p-6 mb-8"
              >
                <h2 className="text-2xl font-bold text-green-700">
                  {loan.business_name || "Land Investment"}
                </h2>

                <div className="grid md:grid-cols-2 gap-6 mt-5">
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
                    <p><strong>Status:</strong> {loan.status}</p>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex justify-between mb-2">
                    <span>Funding Progress</span>
                    <span>{percent.toFixed(0)}%</span>
                  </div>

                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className="bg-green-600 h-4 rounded-full"
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <div className="flex justify-between mt-2 text-sm">
                    <span>{money(funded)} Funded</span>
                    <span>{money(fundingGoal)} Goal</span>
                  </div>
                </div>

                <button
                  onClick={() =>
                    navigate("/investor-wallet", {
                      state: {
                        loanId: loan.id,
                        amount: loan.loan_amount,
                      },
                    })
                  }
                  className="mt-6 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold w-full"
                >
                  Invest Now
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}