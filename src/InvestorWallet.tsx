import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import PlaidConnectButton from "./components/PlaidConnectButton";

export default function InvestorWallet() {
  const [wallet, setWallet] = useState<any>(null);
  const [investments, setInvestments] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [depositBankId, setDepositBankId] = useState("");
  const [depositAmount, setDepositAmount] = useState("");

  const [withdrawBankId, setWithdrawBankId] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  useEffect(() => {
    loadWallet();
  }, []);

  function money(value: any) {
    return "$" + Number(value || 0).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  }

  function formatDate(value: string) {
    if (!value) return "—";
    return new Date(value).toLocaleDateString();
  }

  function bankLabel(account: any) {
    const bank = account.bank_name || account.institution_name || "Bank";
    const name = account.account_name || account.account_subtype || "Account";
    const mask =
      account.account_mask ||
      account.account_number?.slice(-4) ||
      account.plaid_account_id?.slice(-4) ||
      "";
    return `${bank} - ${name}${mask ? " ••••" + mask : ""}`;
  }

  async function getToken() {
    if (!supabase) return null;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || null;
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

    const { data: investmentData } = await supabase
      .from("investments")
      .select("*")
      .eq("investor_id", user.id)
      .order("created_at", { ascending: false });

    setInvestments(investmentData || []);

    const { data: transactionData } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setTransactions(transactionData || []);

    const token = await getToken();

    if (token) {
      const response = await fetch("/api/bank-accounts", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (response.ok) {
        setBankAccounts(result.accounts || []);
      }
    }

    setLoading(false);
  }

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();

    const token = await getToken();

    if (!token) {
      alert("Please log in.");
      return;
    }

    if (!depositBankId) {
      alert("Select a bank account.");
      return;
    }

    if (!depositAmount || Number(depositAmount) < 1) {
      alert("Enter a valid deposit amount.");
      return;
    }

    const response = await fetch("/api/deposit-funds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        bank_account_id: depositBankId,
        amount: Number(depositAmount),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Deposit failed.");
      return;
    }

    alert("Deposit completed.");
    setDepositAmount("");
    await loadWallet();
  }

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();

    const token = await getToken();

    if (!token) {
      alert("Please log in.");
      return;
    }

    if (!withdrawBankId) {
      alert("Select a bank account.");
      return;
    }

    if (!withdrawAmount || Number(withdrawAmount) < 1) {
      alert("Enter a valid withdrawal amount.");
      return;
    }

    if (Number(withdrawAmount) > Number(wallet?.available_balance || 0)) {
      alert("Withdrawal amount exceeds available cash.");
      return;
    }

    const response = await fetch("/api/withdraw-funds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        bank_account_id: withdrawBankId,
        amount: Number(withdrawAmount),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Withdrawal failed.");
      return;
    }

    alert("Withdrawal requested.");
    setWithdrawAmount("");
    await loadWallet();
  }

  const totalInvested = investments.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const expectedMonthlyReturn = investments.reduce((sum, item) => {
    const amount = Number(item.amount || 0);
    const rate = Number(item.investor_interest_rate || 9);
    return sum + (amount * rate) / 100 / 12;
  }, 0);

  const expectedTotalInterest = investments.reduce((sum, item) => {
    const amount = Number(item.amount || 0);
    const rate = Number(item.investor_interest_rate || 9);
    const months = Number(item.term_months || 36);
    return sum + amount * (rate / 100) * (months / 12);
  }, 0);

  const averageRate =
    investments.length === 0
      ? 0
      : investments.reduce(
          (sum, item) => sum + Number(item.investor_interest_rate || 9),
          0
        ) / investments.length;

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
          <p className="text-gray-500">Pending Balance</p>
          <h2 className="text-2xl font-bold">
            {money(wallet?.pending_balance)}
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
          <p className="text-gray-500">Average Investor Rate</p>
          <h2 className="text-2xl font-bold">{averageRate.toFixed(2)}%</h2>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-xl shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Connected Bank Accounts</h2>

        {bankAccounts.length === 0 ? (
          <p>No connected bank accounts yet.</p>
        ) : (
          <div className="grid gap-3">
            {bankAccounts.map((account) => (
              <div key={account.id} className="border rounded-lg p-4">
                <p className="font-bold">✅ {bankLabel(account)}</p>
                <p className="text-sm text-gray-600">
                  Verified: {account.is_verified ? "Yes" : "No"}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4">
          <PlaidConnectButton />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-8">
        <form
          onSubmit={handleDeposit}
          className="bg-white rounded-xl shadow p-6"
        >
          <h2 className="text-2xl font-bold mb-4 text-green-700">
            Deposit Funds
          </h2>

          <select
            value={depositBankId}
            onChange={(e) => setDepositBankId(e.target.value)}
            className="w-full border p-3 rounded mb-4"
          >
            <option value="">Select bank account</option>
            {bankAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {bankLabel(account)}
              </option>
            ))}
          </select>

          <input
            type="number"
            min="1"
            step="0.01"
            placeholder="Deposit amount"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            className="w-full border p-3 rounded mb-4"
          />

          <button className="w-full bg-green-600 text-white py-3 rounded-lg font-bold">
            Deposit to Wallet
          </button>
        </form>

        <form
          onSubmit={handleWithdraw}
          className="bg-white rounded-xl shadow p-6"
        >
          <h2 className="text-2xl font-bold mb-4 text-blue-700">
            Withdraw Funds
          </h2>

          <p className="mb-3 text-gray-600">
            Available Cash:{" "}
            <strong>{money(wallet?.available_balance)}</strong>
          </p>

          <select
            value={withdrawBankId}
            onChange={(e) => setWithdrawBankId(e.target.value)}
            className="w-full border p-3 rounded mb-4"
          >
            <option value="">Select bank account</option>
            {bankAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {bankLabel(account)}
              </option>
            ))}
          </select>

          <input
            type="number"
            min="1"
            step="0.01"
            placeholder="Withdrawal amount"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            className="w-full border p-3 rounded mb-4"
          />

          <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">
            Withdraw to Bank
          </button>
        </form>
      </div>

      <div className="mt-8 bg-white rounded-xl shadow p-6">
        <button
          onClick={() => (window.location.href = "/marketplace")}
          className="bg-gray-800 text-white px-5 py-3 rounded-lg font-bold"
        >
          Browse Investments
        </button>
      </div>

      <div className="mt-8 bg-white rounded-xl shadow p-6 overflow-x-auto">
        <h2 className="text-2xl font-bold mb-4">Wallet Transactions</h2>

        {transactions.length === 0 ? (
          <p>No wallet transactions yet.</p>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b">
                <th className="p-2">Date</th>
                <th className="p-2">Type</th>
                <th className="p-2">Description</th>
                <th className="p-2">Amount</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>

            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b">
                  <td className="p-2">{formatDate(tx.created_at)}</td>
                  <td className="p-2 capitalize">
                    {tx.transaction_type || "transaction"}
                  </td>
                  <td className="p-2">{tx.description || "—"}</td>
                  <td className="p-2 font-bold">{money(tx.amount)}</td>
                  <td className="p-2 capitalize">
                    {tx.status || "completed"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
                  <p>
                    <strong>Loan ID:</strong> {investment.loan_id}
                  </p>
                  <p>
                    <strong>Amount Invested:</strong> {money(amount)}
                  </p>
                  <p>
                    <strong>Investor Rate:</strong> {rate}%
                  </p>
                  <p>
                    <strong>Term:</strong> {months} months
                  </p>
                  <p>
                    <strong>Expected Monthly Return:</strong>{" "}
                    {money(monthlyReturn)}
                  </p>
                  <p>
                    <strong>Expected Total Interest:</strong>{" "}
                    {money(totalInterest)}
                  </p>
                  <p>
                    <strong>Status:</strong> {investment.status}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}