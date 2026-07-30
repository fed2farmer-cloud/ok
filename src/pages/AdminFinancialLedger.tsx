import { useCallback, useEffect, useMemo, useState } from "react";
import AppLayout from "../components/AppLayout";
import {
  FundingHoldRow,
  LedgerSummaryRow,
  ReconciliationRow,
  disburseLoanFunds,
  loadFundingHolds,
  loadLedgerSummary,
  loadReconciliationEvents,
  releaseExpiredFundingHolds,
} from "../lib/financialLedger";

const money = (value: number | null | undefined) => Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString() : "—";

export default function AdminFinancialLedger() {
  const [accounts, setAccounts] = useState<LedgerSummaryRow[]>([]);
  const [holds, setHolds] = useState<FundingHoldRow[]>([]);
  const [events, setEvents] = useState<ReconciliationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [loanId, setLoanId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const [accountRows, holdRows, eventRows] = await Promise.all([
        loadLedgerSummary(),
        loadFundingHolds(),
        loadReconciliationEvents(),
      ]);
      setAccounts(accountRows);
      setHolds(holdRows);
      setEvents(eventRows);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load financial ledger.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => ({
    available: accounts.filter((a) => a.account_type === "investor_available_cash").reduce((t, a) => t + a.balance, 0),
    protected: accounts.filter((a) => a.account_type === "investor_protected_funds").reduce((t, a) => t + a.balance, 0),
    disbursable: accounts.filter((a) => a.account_type === "loan_disbursable_funds").reduce((t, a) => t + a.balance, 0),
    borrowerCash: accounts.filter((a) => a.account_type === "borrower_disbursed_cash").reduce((t, a) => t + a.balance, 0),
  }), [accounts]);

  async function settleHolds() {
    setWorking(true); setMessage("");
    try {
      const result = await releaseExpiredFundingHolds();
      setMessage(`Expired holds processed: ${Number(result?.released_count ?? result ?? 0)}.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to release expired holds.");
    } finally { setWorking(false); }
  }

  async function submitDisbursement(event: React.FormEvent) {
    event.preventDefault();
    const parsedLoanId = Number(loanId);
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedLoanId) || parsedLoanId <= 0 || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setMessage("Enter a valid loan application ID and amount.");
      return;
    }
    if (!window.confirm(`Disburse ${money(parsedAmount)} for loan application ${parsedLoanId}?`)) return;
    setWorking(true); setMessage("");
    try {
      await disburseLoanFunds(parsedLoanId, parsedAmount, note);
      setMessage("Disbursement recorded successfully.");
      setLoanId(""); setAmount(""); setNote("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to disburse loan funds.");
    } finally { setWorking(false); }
  }

  return (
    <AppLayout>
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Financial Operations</p>
            <h1 className="mt-2 text-4xl font-black text-slate-950">Ledger & Funding</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">Double-entry balances, investor protection holds, eligible borrower funds, disbursements, and reconciliation exceptions.</p>
          </div>
          <button type="button" disabled={working} onClick={settleHolds} className="rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-50">Release Expired Holds</button>
        </div>

        {message && <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-800 shadow-sm">{message}</div>}
        {loading && <p className="mt-6 text-slate-600">Loading financial records…</p>}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Investor Available Cash", totals.available],
            ["Protected Funds", totals.protected],
            ["Eligible for Disbursement", totals.disbursable],
            ["Borrower Disbursed", totals.borrowerCash],
          ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{money(Number(value))}</p></div>)}
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <form onSubmit={submitDisbursement} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">Record Borrower Disbursement</h2>
            <p className="mt-1 text-sm text-slate-500">The RPC prevents disbursement above settled, nonrefundable funding.</p>
            <div className="mt-5 space-y-4">
              <input value={loanId} onChange={(e) => setLoanId(e.target.value)} inputMode="numeric" placeholder="Loan application ID" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="Disbursement amount" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Disbursement note or processor reference" className="min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3" />
              <button disabled={working} className="w-full rounded-xl bg-blue-700 px-5 py-3 font-black text-white disabled:opacity-50">Post Disbursement</button>
            </div>
          </form>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5"><h2 className="text-xl font-black">Funding Holds</h2></div>
            <div className="max-h-[430px] overflow-auto">
              <table className="w-full text-left text-sm"><thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-500"><tr><th className="p-3">Investment</th><th className="p-3">Loan</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Hold until</th></tr></thead><tbody>
                {holds.map((hold) => <tr key={hold.id} className="border-t border-slate-100"><td className="p-3">#{hold.investment_id}</td><td className="p-3">#{hold.loan_application_id}</td><td className="p-3 font-bold">{money(hold.amount)}</td><td className="p-3 capitalize">{hold.status.replaceAll("_", " ")}</td><td className="p-3">{dateTime(hold.hold_until)}</td></tr>)}
                {!holds.length && !loading && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No funding holds found.</td></tr>}
              </tbody></table>
            </div>
          </div>
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5"><h2 className="text-xl font-black">Reconciliation Events</h2></div>
          <div className="overflow-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-500"><tr><th className="p-3">Created</th><th className="p-3">Event</th><th className="p-3">Reference</th><th className="p-3">Expected</th><th className="p-3">Actual</th><th className="p-3">Difference</th><th className="p-3">Status</th></tr></thead><tbody>
            {events.map((row) => <tr key={row.id} className="border-t border-slate-100"><td className="p-3">{dateTime(row.created_at)}</td><td className="p-3">{row.event_type.replaceAll("_", " ")}</td><td className="p-3">{row.reference_type || "—"} {row.reference_id || ""}</td><td className="p-3">{money(row.expected_amount)}</td><td className="p-3">{money(row.actual_amount)}</td><td className={`p-3 font-bold ${Number(row.difference_amount || 0) !== 0 ? "text-red-700" : "text-emerald-700"}`}>{money(row.difference_amount)}</td><td className="p-3 capitalize">{row.status}</td></tr>)}
            {!events.length && !loading && <tr><td colSpan={7} className="p-6 text-center text-slate-500">No reconciliation events found.</td></tr>}
          </tbody></table></div>
        </section>
      </main>
    </AppLayout>
  );
}
