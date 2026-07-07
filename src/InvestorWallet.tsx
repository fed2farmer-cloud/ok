import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

export default function InvestorWallet() {
  const [investments, setInvestments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWallet();
  }, []);

  function money(value: number | null | undefined) {
    return "$" + Number(value || 0).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  }

  function monthlyReturn(amount: number, annualRate: number) {
    return (Number(amount || 0) * (Number(annualRate || 0) / 100)) / 12;
  }

  async function loadWallet() {
    if (!supabase) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("investments")
      .select("*")
      .eq("investor_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
    }

    setInvestments(data || []);
    setLoading(false);
  }

  const totalInvested = investments.reduce(
    (sum, inv) => sum + Number(inv.amount || 0),
    0
  );

  const expectedMonthly = investments.reduce(
    (sum, inv) =>
      sum + monthlyReturn(inv.amount, inv.investor_interest_rate || 9),
    0
  );

  const expectedTotalInterest = investments.reduce((sum, inv) => {
    const monthly = monthlyReturn(inv.amount, inv.investor_interest_rate || 9);
    return sum + monthly * Number(inv.term_months || 36);
  }, 0);

  if (loading) return <div className="p-8 text-xl">Loading investor wallet...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-green-700 mb-6">
        Investor Wallet
      </h1>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-gray-500">Available Cash</p>
          <h2 className="text-2xl font-bold">$0</h2>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-gray-500">Money Invested</p>
          <h2 className="text-2xl font-bold">{money(totalInvested)}</h2>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-gray-500">Expected Monthly Return</p>
          <h2 className="text-2xl font-bold">{money(expectedMonthly)}</h2>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-gray-500">Expected Total Interest</p>
          <h2 className="text-2xl font-bold">{money(expectedTotalInterest)}</h2>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-gray-500">Lifetime Earnings</p>
          <h2 className="text-2xl font-bold">{money(expectedTotalInterest)}</h2>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-xl shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Actions</h2>

        <div className="flex flex-wrap gap-3">
          <button className="bg-green-600 text-white px-5 py-3 rounded-lg font-bold">
            Deposit Funds
          </button>

          <button className="bg-blue-600 text-white px-5 py-3 rounded-lg font-bold">
            Withdraw Funds
          </button>

          <button
            onClick={() => (window.location.href = "/investor")}
            className="bg-gray-800 text-white px-5 py-3 rounded-lg font-bold"
          >
            Browse Investments
          </button>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-xl shadow p-6">
        <h2 className="text-2xl font-bold mb-4">My Investments</h2>

        {investments.length === 0 ? (
          <p>No investments yet.</p>
        ) : (
          <div className="grid gap-4">
            {investments.map((investment) => {
              const amount = Number(investment.amount || 0);
              const rate = Number(investment.investor_interest_rate || 9);
              const term = Number(investment.term_months || 36);
              const monthly = monthlyReturn(amount, rate);
              const totalInterest = monthly * term;

              return (
                <div key={investment.id} className="border rounded-lg p-4">
                  <p><strong>Loan ID:</strong> {investment.loan_id}</p>
                  <p><strong>Amount Invested:</strong> {money(amount)}</p>
                  <p><strong>Investor Rate:</strong> {rate}%</p>
                  <p><strong>Term:</strong> {term} months</p>
                  <p><strong>Expected Monthly Return:</strong> {money(monthly)}</p>
                  <p><strong>Expected Total Interest:</strong> {money(totalInterest)}</p>
                  <p><strong>Status:</strong> {investment.status}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}