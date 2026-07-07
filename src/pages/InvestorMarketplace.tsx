import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function InvestorMarketplace() {
  const [loans, setLoans] = useState<any[]>([]);

  useEffect(() => {
    loadLoans();
  }, []);

  async function loadLoans() {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("marketplace_loans")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setLoans(data || []);
  }

  function money(value: number) {
    return "$" + Number(value || 0).toLocaleString();
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-green-700 mb-6">
        Investment Marketplace
      </h1>

      {loans.length === 0 ? (
        <p>No investment opportunities available.</p>
      ) : (
        loans.map((loan) => (
          <div key={loan.id} className="bg-white rounded-xl shadow p-6 mb-6">
            <h2 className="text-2xl font-bold text-green-700">
              {loan.business_name}
            </h2>

            <p><strong>Borrower:</strong> {loan.borrower_name}</p>
            <p><strong>APN:</strong> {loan.apn}</p>
            <p><strong>State:</strong> {loan.state}</p>
            <p><strong>Acres:</strong> {loan.acreage}</p>
            <p><strong>Land Value:</strong> {money(loan.land_value)}</p>
            <p><strong>Loan Amount:</strong> {money(loan.loan_amount)}</p>
            <p><strong>Investor Rate:</strong> {loan.investor_interest_rate}%</p>
            <p><strong>Risk:</strong> {loan.risk_score}</p>

            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-green-600 h-4 rounded-full"
                  style={{
                    width: `${(loan.amount_funded / loan.funding_goal) * 100}%`,
                  }}
                />
              </div>

              <p className="mt-2">
                {money(loan.amount_funded)} funded of{" "}
                {money(loan.funding_goal)}
              </p>
            </div>

            <button className="mt-6 bg-green-600 text-white px-6 py-3 rounded-lg">
              Invest Now
            </button>
          </div>
        ))
      )}
    </div>
  );
}