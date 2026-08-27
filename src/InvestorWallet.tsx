import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NmiPayments } from "@nmipayments/nmi-pay-react";
import { supabase } from "./lib/supabase";
import PlaidConnectButton from "./components/PlaidConnectButton";
import AppLayout from "./components/AppLayout";
import { useToast } from "./context/ToastContext";
import { getNmiTokenizationKey } from "./lib/nmi";
import SecondaryMarketSellForm from "./components/SecondaryMarketSellForm";

export default function InvestorWallet() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [wallet, setWallet] = useState<any>(null);
  const [investments, setInvestments] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sellOpenId, setSellOpenId] = useState<number | null>(null);

  const [depositBankId, setDepositBankId] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawBankId, setWithdrawBankId] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  // NMI card deposit state
  const [cardDepositAmount, setCardDepositAmount] = useState("");
  const [cardPayStatus, setCardPayStatus] = useState("");
  const [showCardDeposit, setShowCardDeposit] = useState(false);

  useEffect(() => {
    loadWallet();
  }, []);

  // Realtime wallet updates
  useEffect(() => {
    if (!supabase) return;
    let cleanup: (() => void) | undefined;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || !supabase) return;
      const ch = supabase
        .channel("wallet-realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "investor_wallets", filter: `user_id=eq.${user.id}` },
          (p) => setWallet(p.new))
        .subscribe();
      cleanup = () => { supabase?.removeChannel(ch); };
    });
    return () => cleanup?.();
  }, []);

  function money(value: any) {
    return Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
  }

  function formatDate(value: string) {
    if (!value) return "—";
    return new Date(value).toLocaleDateString();
  }

  function bankLabel(account: any) {
    const bank = account.bank_name || account.institution_name || "Bank";
    const name = account.account_name || account.account_subtype || "Account";
    const mask = account.account_mask || account.account_number?.slice(-4) || "";
    return `${bank} – ${name}${mask ? " ••••" + mask : ""}`;
  }

  async function getToken() {
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  async function loadWallet() {
    if (!supabase) return;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }

    let { data: walletData } = await supabase.from("investor_wallets").select("*").eq("user_id", user.id).maybeSingle();
    if (!walletData) {
      const { data: nw } = await supabase.from("investor_wallets").insert({ user_id: user.id }).select().single();
      walletData = nw;
    }
    setWallet(walletData);

    // Portfolio ownership follows current_owner_id after a transfer; investor_id remains
    // the original purchaser. Only active positions belong in the invested balance.
    const { data: investmentData } = await supabase
      .from("investments")
      .select("*")
      .or(`investor_id.eq.${user.id},current_owner_id.eq.${user.id}`)
      .eq("status", "active")
      .order("created_at", { ascending: false });
    const rawInvestments = investmentData || [];
    const loanIds = [...new Set(rawInvestments.map((inv: any) => inv.loan_id).filter(Boolean))];
    let loanNumberById = new Map<any, any>();
    if (loanIds.length > 0) {
      const { data: loanRows } = await supabase
        .from("loan_applications")
        .select("id, loan_number")
        .in("id", loanIds);
      loanNumberById = new Map((loanRows || []).map((loan: any) => [loan.id, loan.loan_number]));
    }
    const investmentIds = rawInvestments.map((inv: any) => inv.id).filter(Boolean);
    let positionByInvestmentId = new Map<any, any>();
    if (investmentIds.length > 0) {
      const { data: positionRows } = await supabase
        .from("investor_positions")
        .select("investment_id, original_principal, current_principal, status")
        .in("investment_id", investmentIds)
        .eq("status", "active");
      positionByInvestmentId = new Map(
        (positionRows || []).map((position: any) => [position.investment_id, position])
      );
    }

    setInvestments(rawInvestments
      .filter((inv: any) => (inv.current_owner_id ?? inv.investor_id) === user.id)
      .map((inv: any) => {
        const position = positionByInvestmentId.get(inv.id);
        return {
          ...inv,
          public_loan_number: loanNumberById.get(inv.loan_id) ?? inv.loan_number ?? inv.loan_id,
          original_principal: Number(position?.original_principal ?? inv.amount ?? 0),
          current_principal: Number(position?.current_principal ?? inv.amount ?? 0),
          has_active_position: Boolean(position),
        };
      }));

    const { data: txData } = await supabase.from("wallet_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setTransactions(txData || []);

    const token = await getToken();
    if (token) {
      const res = await fetch("/api/bank-accounts", { headers: { Authorization: `****** ` } });
      const result = await res.json();
      if (res.ok) setBankAccounts(result.accounts || []);
    }
    setLoading(false);
  }

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    const token = await getToken();
    if (!token || !depositBankId || !depositAmount || Number(depositAmount) < 1) {
      addToast("error", "Invalid deposit", "Select a bank account and enter a valid amount.");
      return;
    }
    const res = await fetch("/api/deposit-funds", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `****** ` },
      body: JSON.stringify({ bank_account_id: depositBankId, amount: Number(depositAmount) }),
    });
    const result = await res.json();
    if (!res.ok) { addToast("error", "Deposit failed", result.error); return; }
    addToast("success", "Deposit complete", `${money(depositAmount)} added to your wallet.`);
    setDepositAmount("");
    await loadWallet();
  }

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    const token = await getToken();
    if (!token || !withdrawBankId || !withdrawAmount || Number(withdrawAmount) < 1) {
      addToast("error", "Invalid withdrawal", "Select a bank account and enter a valid amount.");
      return;
    }
    if (Number(withdrawAmount) > Number(wallet?.available_balance || 0)) {
      addToast("error", "Insufficient balance", `Available: ${money(wallet?.available_balance)}`);
      return;
    }
    const res = await fetch("/api/withdraw-funds", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `****** ` },
      body: JSON.stringify({ bank_account_id: withdrawBankId, amount: Number(withdrawAmount) }),
    });
    const result = await res.json();
    if (!res.ok) { addToast("error", "Withdrawal failed", result.error); return; }
    addToast("success", "Withdrawal requested");
    setWithdrawAmount("");
    await loadWallet();
  }

  async function handleCardDeposit(paymentToken: string) {
    const amount = Number(cardDepositAmount || 0);
    if (amount < 10) { setCardPayStatus("Minimum card deposit is $10."); return "Minimum $10"; }

    const token = await getToken();
    if (!token) { setCardPayStatus("Please sign in again."); return "Authentication required"; }

    setCardPayStatus("Processing card deposit...");
    const res = await fetch("/api/process-wallet-card-deposit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ paymentToken, amount }),
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      const msg = data.error || "Card deposit failed.";
      setCardPayStatus(msg);
      addToast("error", data.paymentApproved ? "Payment needs reconciliation" : "Card deposit failed", msg);
      return msg;
    }

    addToast("success", "Card deposit successful", `${money(amount)} added to your wallet. New available balance: ${money(data.availableBalance)}. NMI #${data.transactionId}`);
    setCardPayStatus(`Payment successful — available balance ${money(data.availableBalance)} — NMI #${data.transactionId}`);
    setCardDepositAmount("");
    setShowCardDeposit(false);
    await loadWallet();
    return true;
  }

  const totalInvested = investments.reduce((s, i) => s + Number(i.amount || 0), 0);
  const monthlyReturn = investments.reduce((s, i) => s + (Number(i.amount || 0) * Number(i.investor_interest_rate || 9)) / 100 / 12, 0);
  const totalPortfolio = Number(wallet?.available_balance || 0) + totalInvested;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Header */}
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-7 text-white shadow-2xl sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">Investor Wallet</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight">Capital Command Center</h1>
          <div className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-4">
            {[
              ["Available Cash", money(wallet?.available_balance), "emerald"],
              ["Invested", money(totalInvested), ""],
              ["Pending", money(wallet?.pending_balance), "amber"],
              ["Portfolio Total", money(totalPortfolio), "blue"],
            ].map(([label, value, color]) => (
              <div key={label as string}>
                <p className="text-xs text-slate-400">{label}</p>
                <p className={`mt-1 text-xl font-black ${color === "emerald" ? "text-emerald-400" : color === "amber" ? "text-amber-400" : color === "blue" ? "text-blue-400" : "text-white"}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={() => navigate("/marketplace")} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-500">Browse Marketplace</button>
            <button onClick={() => navigate("/investor")} className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/20">View Portfolio</button>
          </div>
        </section>

        {/* Stats */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Positions</p>
            <p className="mt-2 text-2xl font-black text-slate-950">{investments.length}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Est. Monthly Yield</p>
            <p className="mt-2 text-2xl font-black text-emerald-700">{money(monthlyReturn)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Transactions</p>
            <p className="mt-2 text-2xl font-black text-slate-950">{transactions.length}</p>
          </div>
        </div>

        {/* Deposit / Withdraw / Card Deposit */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Bank Deposit */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Deposit via Bank (Plaid/ACH)</h2>
            <form onSubmit={handleDeposit} className="mt-4 space-y-3">
              <select value={depositBankId} onChange={(e) => setDepositBankId(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500">
                <option value="">Select bank account</option>
                {bankAccounts.map((a) => <option key={a.id} value={a.id}>{bankLabel(a)}</option>)}
              </select>
              <input type="number" min="1" step="0.01" placeholder="Amount" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500" />
              <button type="submit" className="w-full rounded-xl bg-emerald-600 py-2.5 font-bold text-white hover:bg-emerald-700">Deposit to Wallet</button>
            </form>
            <div className="mt-4">
              <PlaidConnectButton />
            </div>
          </div>

          {/* Withdraw */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Withdraw to Bank</h2>
            <p className="mt-1 text-xs text-slate-500">Available: <strong>{money(wallet?.available_balance)}</strong></p>
            <form onSubmit={handleWithdraw} className="mt-4 space-y-3">
              <select value={withdrawBankId} onChange={(e) => setWithdrawBankId(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500">
                <option value="">Select bank account</option>
                {bankAccounts.map((a) => <option key={a.id} value={a.id}>{bankLabel(a)}</option>)}
              </select>
              <input type="number" min="1" step="0.01" placeholder="Amount" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500" />
              <button type="submit" className="w-full rounded-xl bg-blue-600 py-2.5 font-bold text-white hover:bg-blue-700">Withdraw to Bank</button>
            </form>
          </div>

          {/* NMI Card Deposit — works from zero balance */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Deposit via Credit/Debit Card</h2>
            <p className="mt-1 text-xs text-slate-500">Fund your wallet instantly with a card — no bank account required.</p>
            {!showCardDeposit ? (
              <button onClick={() => setShowCardDeposit(true)} className="mt-4 w-full rounded-xl bg-amber-500 py-2.5 font-bold text-white hover:bg-amber-600">
                Add Funds with Card
              </button>
            ) : (
              <div className="mt-4 space-y-3">
                <input
                  type="number"
                  min="10"
                  step="0.01"
                  placeholder="Amount (min $10)"
                  value={cardDepositAmount}
                  onChange={(e) => setCardDepositAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-amber-500"
                />
                {cardPayStatus && (
                  <p className={`text-xs font-semibold ${cardPayStatus.includes("success") ? "text-emerald-600" : "text-rose-600"}`}>{cardPayStatus}</p>
                )}
                <NmiPayments
                  tokenizationKey={getNmiTokenizationKey()}
                  paymentMethods={["card"]}
                  onPay={handleCardDeposit}
                />
                <button type="button" onClick={() => setShowCardDeposit(false)} className="w-full rounded-xl border border-slate-300 py-2 text-sm font-medium text-slate-600">Cancel</button>
              </div>
            )}
          </div>
        </div>

        {/* Bank accounts */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">Connected Bank Accounts</h2>
          {bankAccounts.length === 0 ? (
            <div className="mt-4 flex flex-col items-start gap-3">
              <p className="text-sm text-slate-500">No accounts connected. Link a bank account to deposit or withdraw via ACH.</p>
              <PlaidConnectButton />
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {bankAccounts.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                  <div>
                    <p className="font-semibold text-slate-800">{bankLabel(a)}</p>
                    <p className="text-xs text-slate-500">Verified: {a.is_verified ? "✓ Yes" : "Pending"}</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">Connected</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Transactions */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-base font-bold text-slate-900">Transaction History</h2>
          </div>
          {transactions.length === 0 ? (
            <p className="p-6 text-sm text-slate-400">No transactions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {["Date", "Type", "Description", "Amount", "Status"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-5 py-3 text-slate-500">{formatDate(tx.created_at)}</td>
                      <td className="px-5 py-3 capitalize text-slate-700">{String(tx.transaction_type || tx.type || "—").replace(/_/g, " ")}</td>
                      <td className="px-5 py-3 text-slate-500">{tx.description || "—"}</td>
                      <td className={`px-5 py-3 font-black ${Number(tx.amount) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {Number(tx.amount) >= 0 ? "+" : ""}{money(tx.amount)}
                      </td>
                      <td className="px-5 py-3 capitalize text-slate-500">{tx.status || "completed"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Investments */}
        {investments.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-bold text-slate-900">My Investments</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {investments.map((inv) => {
                const amount = Number(inv.amount || 0);
                const rate = Number(inv.investor_interest_rate || 9);
                const months = Number(inv.term_months || 36);
                return (
                  <div key={inv.id} className="px-6 py-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-slate-800">Loan #{inv.public_loan_number ?? inv.loan_id}</p>
                        <p className="text-xs text-slate-500">{rate}% · {months} months</p>
                        {inv.certificate_number && (
                          <p className="mt-2 break-all font-mono text-[11px] font-bold text-amber-700">
                            Certificate: {inv.certificate_number}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-black text-emerald-700">{money(amount)}</p>
                        <span className={`text-xs font-bold ${inv.status === "active" ? "text-emerald-600" : "text-slate-500"}`}>
                          {String(inv.status || "issued").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                        </span>
                      </div>
                    </div>
                    {inv.certificate_number && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/investment-certificate/${encodeURIComponent(inv.certificate_number)}`)}
                          className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                        >
                          View Certificate
                        </button>
                        <button
                          type="button"
                          onClick={() => setSellOpenId(sellOpenId === Number(inv.id) ? null : Number(inv.id))}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500"
                        >
                          {sellOpenId === Number(inv.id) ? "Close Resale" : "Sell / Resell Certificate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(inv.certificate_number)}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          Copy Number
                        </button>
                      </div>
                    )}
                    {inv.certificate_number && sellOpenId === Number(inv.id) && (
                      <div className="mt-4 rounded-xl border border-emerald-900/30 bg-slate-50 p-4">
                        <SecondaryMarketSellForm
                          investmentId={Number(inv.id)}
                          certificateNumber={inv.certificate_number}
                          originalPrincipal={Number(inv.original_principal || amount)}
                          currentPrincipal={Number(inv.current_principal || amount)}
                          onListed={() => navigate("/secondary-market")}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
