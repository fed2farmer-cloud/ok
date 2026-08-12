import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { supabase } from "../lib/supabase";

type ServicingRow = {
  loan_number: number;
  expected_total: number | string | null;
  collected_total: number | string | null;
  outstanding_total: number | string | null;
  overdue_installments: number | string | null;
  next_due_date: string | null;
};

type ScheduleRow = {
  id: string;
  loan_number: number;
  installment_number: number;
  due_date: string;
  expected_principal: number | string;
  expected_interest: number | string;
  expected_total: number | string;
  collected_principal: number | string;
  collected_interest: number | string;
  status: string;
};

type BorrowerPaymentRow = {
  id: string;
  payment_number: number | null;
  loan_number: number;
  schedule_id: string | null;
  amount: number | string;
  status: string;
  processor: string | null;
  processor_transaction_id: string | null;
  idempotency_key: string | null;
  created_at: string | null;
  settled_at: string | null;
};

type ExceptionRow = {
  id: string;
  loan_number: number | null;
  severity: string;
  exception_type: string;
  source_reference: string | null;
  status: string;
  created_at: string | null;
};

function money(value: number | string | null | undefined) {
  const n = Number(value || 0);
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function dateOnly(value: string | null | undefined) {
  if (!value) return "—";
  return value.slice(0, 10);
}

function compactJson(value: unknown) {
  if (!value || typeof value !== "object") return "No summary loaded yet.";
  return JSON.stringify(value, null, 2);
}

export default function AdminServicingDashboard() {
  const [rows, setRows] = useState<ServicingRow[]>([]);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [payments, setPayments] = useState<BorrowerPaymentRow[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState("");

  const load = useCallback(async (loanNumber?: number | null) => {
    if (!supabase) {
      setActionMessage("Supabase environment keys are missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setActionMessage("");
    const targetLoan = loanNumber ?? selectedLoan;

    const [summaryResult, servicingResult, exceptionResult, paymentResult] = await Promise.all([
      supabase.rpc("admin_servicing_summary_v4"),
      supabase.from("admin_servicing_summary").select("*").order("loan_number", { ascending: false }),
      supabase.from("financial_exceptions").select("id, loan_number, severity, exception_type, source_reference, status, created_at").eq("status", "open").order("created_at", { ascending: false }).limit(20),
      supabase.from("borrower_payments").select("id, payment_number, loan_number, schedule_id, amount, status, processor, processor_transaction_id, idempotency_key, created_at, settled_at").order("created_at", { ascending: false }).limit(25),
    ]);

    if (summaryResult.error) {
      setActionMessage(`Admin summary RPC not available yet: ${summaryResult.error.message}`);
    } else {
      setSummary((summaryResult.data || null) as Record<string, unknown> | null);
    }

    const servicingRows = (servicingResult.data || []) as ServicingRow[];
    setRows(servicingRows);
    setExceptions((exceptionResult.data || []) as ExceptionRow[]);
    // Direct paymentResult remains useful as a connectivity probe; selected-loan details are loaded through the admin-only RPC below.
    if (paymentResult.error) console.warn("Direct borrower payment read unavailable:", paymentResult.error.message);

    const nextLoan = targetLoan ?? servicingRows.find((row) => row.loan_number)?.loan_number ?? null;
    setSelectedLoan(nextLoan);

    if (nextLoan) {
      const detailResult = await supabase.rpc("admin_servicing_loan_detail_v4", { p_loan_number: nextLoan });
      if (detailResult.error) {
        setSchedule([]);
        setPayments([]);
        setActionMessage(`Servicing detail RPC not available yet: ${detailResult.error.message}. Run the v4.1.2 Supabase migration included in this package.`);
      } else {
        const detail = (detailResult.data || {}) as { schedule?: ScheduleRow[]; payments?: BorrowerPaymentRow[] };
        setSchedule(Array.isArray(detail.schedule) ? detail.schedule : []);
        setPayments(Array.isArray(detail.payments) ? detail.payments : []);
      }
    } else {
      setSchedule([]);
      setPayments([]);
    }

    setLoading(false);
  }, [selectedLoan]);

  useEffect(() => {
    void load(null);
  }, []);

  const totals = useMemo(() => rows.reduce((acc, row) => {
    acc.expected += Number(row.expected_total || 0);
    acc.collected += Number(row.collected_total || 0);
    acc.outstanding += Number(row.outstanding_total || 0);
    acc.late += Number(row.overdue_installments || 0);
    return acc;
  }, { expected: 0, collected: 0, outstanding: 0, late: 0 }), [rows]);

  async function markDuePayments() {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("mark_due_payments_v4");
    if (error) setActionMessage(`Mark due failed: ${error.message}`);
    else setActionMessage(`Marked ${data ?? 0} payment rows due/missed.`);
    await load(selectedLoan);
  }

  const selectedPayments = payments.filter((payment) => !selectedLoan || payment.loan_number === selectedLoan);

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-700">v4 servicing system</p>
            <h1 className="text-3xl font-black text-slate-950">Loan Servicing & Reconciliation</h1>
            <p className="mt-2 max-w-3xl text-slate-600">
              Admin view for expected payments, collected principal, collected interest, missed rows, borrower payments, allocation checks, and open financial exceptions.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/admin" className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-black text-slate-900 shadow-sm hover:bg-slate-100">← Admin Dashboard</Link>
            <button onClick={markDuePayments} className="rounded-xl bg-amber-500 px-4 py-2 font-black text-slate-950 shadow-sm hover:bg-amber-400">Mark due/missed</button>
            <button onClick={() => void load(selectedLoan)} className="rounded-xl bg-slate-950 px-4 py-2 font-black text-white shadow-sm hover:bg-slate-800">Refresh</button>
          </div>
        </div>

        {actionMessage && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{actionMessage}</div>}

        <div className="mt-6 grid gap-4 md:grid-cols-5">
          <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-bold text-slate-500">Expected Total</p><p className="mt-2 text-2xl font-black">{money(totals.expected)}</p></div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-bold text-slate-500">Collected</p><p className="mt-2 text-2xl font-black text-emerald-700">{money(totals.collected)}</p></div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-bold text-slate-500">Outstanding</p><p className="mt-2 text-2xl font-black">{money(totals.outstanding)}</p></div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-bold text-slate-500">Late/Missed Rows</p><p className="mt-2 text-2xl font-black text-rose-700">{totals.late}</p></div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-bold text-slate-500">Open Exceptions</p><p className="mt-2 text-2xl font-black">{exceptions.length}</p></div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="border-b bg-slate-100 px-5 py-4">
              <h2 className="text-xl font-black">Loans in servicing</h2>
              <p className="text-sm text-slate-600">Select a loan to inspect the payment schedule.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-white text-slate-500">
                  <tr>
                    {['Loan #', 'Expected', 'Collected', 'Outstanding', 'Late/Missed', 'Next Due'].map((heading) => <th className="p-3 font-black" key={heading}>{heading}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.loan_number} onClick={() => void load(row.loan_number)} className={`cursor-pointer border-t hover:bg-emerald-50 ${selectedLoan === row.loan_number ? 'bg-emerald-50' : ''}`}>
                      <td className="p-3 font-black">#{row.loan_number}</td>
                      <td className="p-3">{money(row.expected_total)}</td>
                      <td className="p-3 font-bold text-emerald-700">{money(row.collected_total)}</td>
                      <td className="p-3">{money(row.outstanding_total)}</td>
                      <td className="p-3">{row.overdue_installments ?? 0}</td>
                      <td className="p-3">{dateOnly(row.next_due_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && rows.length === 0 && <p className="p-6 text-slate-500">No servicing schedules yet. Approve/fund a loan and run generate_payment_schedule_v4.</p>}
          </section>

          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black">Open reconciliation exceptions</h2>
            {exceptions.length === 0 ? (
              <p className="mt-3 rounded-xl bg-emerald-50 p-4 font-bold text-emerald-800">Reconciled — no open exceptions.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {exceptions.map((exception) => (
                  <div key={exception.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <div className="font-black">{exception.exception_type}</div>
                    <div className="text-sm text-slate-700">Loan #{exception.loan_number ?? '—'} · {exception.severity}</div>
                    <div className="mt-1 break-all text-xs text-slate-500">{exception.source_reference || dateOnly(exception.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b bg-slate-100 px-5 py-4">
            <h2 className="text-xl font-black">Selected loan schedule {selectedLoan ? `#${selectedLoan}` : ''}</h2>
            <p className="text-sm text-slate-600">Shows all installments for the selected loan, including expected principal/interest, collections, and status.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  {['Inst.', 'Due Date', 'Principal', 'Interest', 'Expected', 'Principal Collected', 'Interest Collected', 'Status'].map((heading) => <th className="p-3 font-black" key={heading}>{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {schedule.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-3 font-black">{row.installment_number}</td>
                    <td className="p-3">{dateOnly(row.due_date)}</td>
                    <td className="p-3">{money(row.expected_principal)}</td>
                    <td className="p-3">{money(row.expected_interest)}</td>
                    <td className="p-3">{money(row.expected_total)}</td>
                    <td className="p-3">{money(row.collected_principal)}</td>
                    <td className="p-3">{money(row.collected_interest)}</td>
                    <td className="p-3"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-wide">{row.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && selectedLoan && schedule.length === 0 && <p className="p-6 text-slate-500">No payment schedule rows were returned for loan #{selectedLoan}.</p>}
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b bg-slate-100 px-5 py-4">
            <h2 className="text-xl font-black">Recent borrower payment records</h2>
            <p className="text-sm text-slate-600">Use this to verify NMI/manual payment idempotency, settled_at values, reversed duplicate rows, and schedule links.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  {['Payment #', 'Loan #', 'Amount', 'Status', 'Schedule', 'Processor', 'Created', 'Settled'].map((heading) => <th className="p-3 font-black" key={heading}>{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {selectedPayments.map((payment) => (
                  <tr key={payment.id} className="border-t">
                    <td className="p-3 font-black">{payment.payment_number ?? '—'}</td>
                    <td className="p-3">#{payment.loan_number}</td>
                    <td className="p-3">{money(payment.amount)}</td>
                    <td className="p-3">{payment.status}</td>
                    <td className="max-w-[240px] truncate p-3 text-xs">{payment.schedule_id || '—'}</td>
                    <td className="p-3">{payment.processor || '—'}</td>
                    <td className="p-3">{dateOnly(payment.created_at)}</td>
                    <td className="p-3">{dateOnly(payment.settled_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && selectedPayments.length === 0 && <p className="p-6 text-slate-500">No borrower payment records were returned for {selectedLoan ? `loan #${selectedLoan}` : "the selected loan"}.</p>}
        </section>

        <details className="mt-6 rounded-2xl border bg-slate-950 p-5 text-white shadow-sm">
          <summary className="cursor-pointer text-xl font-black">Developer diagnostics · Admin JSON summary RPC</summary>
          <p className="mt-3 text-sm text-slate-300">Backed by public.admin_servicing_summary_v4(). This raw response is collapsed by default.</p>
          <pre className="mt-4 max-h-[420px] overflow-auto rounded-xl bg-black/40 p-4 text-xs text-emerald-100">{compactJson(summary)}</pre>
        </details>
      </div>
    </AppLayout>
  );
}
