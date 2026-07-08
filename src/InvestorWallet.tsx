import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import PlaidConnectButton from "./components/PlaidConnectButton";

export default function InvestorWallet() {
  const [investments, setInvestments] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWallet();
  }, []);

  function money(value: any) {
    return "$" + Number(value || 0).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  }

  async function loadWallet() {
    if (!supabase) return;

    setLoading(true);

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
      .maybeSingle();

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

    const { data, error } = await supabase
      .from("investments")
      .select("*")
      .eq("investor_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setInvestments(data || []);
    setLoading(false);
  }

  async function handleDeposit() {
    if (!supabase) return;

    const amount = prompt("Enter deposit amount:");

    if (!amount) return;

    const depositAmount = Number(amount);

    if (!depositAmount || depositAmount < 1) {
      alert("Enter a valid deposit amount.");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      alert("Please log in.");
      return;
    }

    const response = await fetch("/api/deposit-funds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        amount: depositAmount,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Deposit failed.");
      return;
    }

    alert("Deposit completed successfully.");
    await loadWallet();
  }

  const totalInvested = investments.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const expectedTotalInterest = investments.reduce((sum, item) => {
    const amount = Number(item.amount || 0);
    const rate = Number(item.investor_interest_rate || 9);
    const months = Number(item.term_months || 36);
    return sum + amount * (rate / 100) * (months / 12);
  }, 0);

  const expectedMonthlyReturn = investments.reduce((sum, item) => {
    const amount = Number(item.amount || 0);
    const rate = Number(item.investor_interest_rate || 9);
    return sum + (amount * (rate / 100)) / 12;
  }, 0);

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
          <h2 className="text-2xl font-bold">{money(totalInvested)}</h2>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-gray-500">Expected Monthly Return</p>
          <h2 className="text-2xl font-bold">
            {money(expectedMonthlyReturn)}
          </h2>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-gray-500">Expected Total Interest</p>
          <h2 className="text-2xl font-bold">
            {money(expectedTotalInterest)}
          </h2>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-gray-500">Lifetime Earnings</p>
          <h2 className="text-2xl font-bold">
            {money(expectedTotalInterest)}
          </h2>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-xl shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Actions</h2>

        <div className="flex flex-wrap gap-3">
          <PlaidConnectButton />

          <button
            onClick={handleDeposit}
            className="bg-green-600 text-white px-5 py-3 rounded-lg font-bold"
          >
            Deposit Funds
          </button>

          <button className="bg-blue-600 text-white px-5 py-3 rounded-lg font-bold">
            Withdraw Funds
          </button>

          <button
            onClick={() => (window.location.href = "/marketplace")}
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
              const months = Number(investment.term_months || 36);
              const monthlyReturn = (amount * (rate / 100)) / 12;
              const totalInterest = amount * (rate / 100) * (months / 12);

              return (
                <div key={investment.id} className="border rounded-lg p-4">
                  <p><strong>Loan ID:</strong> {investment.loan_id}</p>
                  <p><strong>Amount Invested:</strong> {money(amount)}</p>
                  <p><strong>Investor Rate:</strong> {rate}%</p>
                  <p><strong>Term:</strong> {months} months</p>
                  <p><strong>Expected Monthly Return:</strong> {money(monthlyReturn)}</p>
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