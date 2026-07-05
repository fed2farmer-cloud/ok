import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

type Wallet = {
  available_balance: number;
  invested_balance: number;
  interest_earned: number;
  principal_returned: number;
  lifetime_earned: number;
};

export default function InvestorWallet() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
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

  async function loadWallet() {
    if (!supabase) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    let { data: walletData } = await supabase
      .from("investor_wallets")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!walletData) {
      const { data: newWallet, error } = await supabase
        .from("investor_wallets")
        .insert({ user_id: user.id })
        .select()
        .single();

      if (error) {
        alert(error.message);
        setLoading(false);
        return;
      }

      walletData = newWallet;
    }

    setWallet(walletData);

    const { data: investmentData } = await supabase
      .from("investments")
      .select("*")
      .eq("investor_id", user.id)
      .order("created_at", { ascending: false });

    setInvestments(investmentData || []);
    setLoading(false);
  }

  if (loading) {
    return <div className="p-8 text-xl">Loading investor wallet...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-green-700 mb-6">
        Investor Wallet
      </h1>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-gray-500">Available Cash</p>
          <h2 className="text-2xl font-bold">
            {money(wallet?.available_balance)}
          </h2>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-gray-500">Money Invested</p>
          <h2 className="text-2xl font-bold">
            {money(wallet?.invested_balance)}
          </h2>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-gray-500">Interest Earned</p>
          <h2 className="text-2xl font-bold">
            {money(wallet?.interest_earned)}
          </h2>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-gray-500">Principal Returned</p>
          <h2 className="text-2xl font-bold">
            {money(wallet?.principal_returned)}
          </h2>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-gray-500">Lifetime Earnings</p>
          <h2 className="text-2xl font-bold">
            {money(wallet?.lifetime_earned)}
          </h2>
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
            {investments.map((investment) => (
              <div key={investment.id} className="border rounded-lg p-4">
                <p><strong>Loan ID:</strong> {investment.loan_id}</p>
                <p><strong>Amount:</strong> {money(investment.investment_amount)}</p>
                <p><strong>Ownership:</strong> {investment.ownership_percent}%</p>
                <p><strong>Expected Return:</strong> {investment.expected_return_percent}%</p>
                <p><strong>Status:</strong> {investment.status}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}