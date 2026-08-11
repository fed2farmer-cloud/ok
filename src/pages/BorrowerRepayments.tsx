import { useCallback, useEffect, useMemo, useState } from "react";
import AppLayout from "../components/AppLayout";
import { supabase } from "../lib/supabase";

type LoanRow = {
  loan_number: number;
  business_name: string | null;
  loan_amount: number | string | null;
  amount_funded: number | string | null;
  status: string | null;
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

type PaymentRow = {
  id: string;
  payment_number: number | null;
  loan_number: number;
  schedule_id: string | null;
  amount: number | string;
  status: string;
  processor: string | null;
  created_at: string | null;
  settled_at: string | null;
};

function money(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function dateOnly(value: string | null | undefined) {
  if (!value) return "—";
  return value.slice(0, 10);
}

function statusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "paid" || normalized === "settled") return "bg-emerald-100 text-emerald-800";
  if (normalized === "missed" || normalized === "late") return "bg-rose-100 text-rose-800";
  if (normalized === "due" || normalized === "partial") return "bg-amber-100 text-amber-900";
  return "bg-slate-100 text-slate-700";
}

export default function BorrowerRepayments() {
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!supabase) {
      setMessage("Supabase environment keys are missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      setMessage("Sign in to view your repayment schedule.");
      setLoading(false);
      return;
    }

    const loanResult = await supabase
      .from("loan_applications")
      .select("loan_number, business_name, loan_amount, amount_funded, status")
      .eq("user_id", user.id)
      .not("loan_number", "is", null)
      .order("loan_number", { ascending: false });

    const borrowerLoans = (loanResult.data || []) as LoanRow[];
    setLoans(borrowerLoans);
    const loanNumbers = borrowerLoans.map((loan) => loan.loan_number).filter(Boolean);

    if (loanNumbers.length === 0) {
      setSchedule([]);
      setPayments([]);
      setLoading(false);
      return;
    }

    const [scheduleResult, paymentResult] = await Promise.all([
      supabase
        .from("loan_payment_schedule")
        .select("id, loan_number, installment_number, due_date, expected_principal, expected_interest, expected_total, collected_principal, collected_interest, status")
        .in("loan_number", loanNumbers)
        .order("due_date", { ascending: true }),
      supabase
        .from("borrower_payments")
        .select("id, payment_number, loan_number, schedule_id, amount, status, processor, created_at, settled_at")
        .in("loan_number", loanNumbers)
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

    setSchedule((scheduleResult.data || []) as ScheduleRow[]);
    setPayments((paymentResult.data || []) as PaymentRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalDue = useMemo(() => schedule
    .filter((row) => ["due", "missed", "late", "partial"].includes(String(row.status).toLowerCase()))
    .reduce((sum, row) => sum + Math.max(Number(row.expected_total || 0) - Number(row.collected_principal || 0) - Number(row.collected_interest || 0), 0), 0), [schedule]);

  function firstOpenInstallment(loanNumber: number) {
    return schedule.find((row) => row.loan_number === loanNumber && !["paid", "waived"].includes(String(row.status).toLowerCase()));
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-700">Borrower center</p>
            <h1 className="text-3xl font-black text-slate-950">Loan Repayment Center</h1>
            <p className="mt-2 max-w-3xl text-slate-600">Review scheduled payments, principal/interest collection, and begin repayment through the connected processor.</p>
          </div>
          <button onClick={() => void load()} className="rounded-xl bg-slate-950 px-4 py-2 font-black text-white shadow-sm hover:bg-slate-800">Refresh</button>
        </div>

        {message && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{message}</div>}

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-bold text-slate-500">Active Loans</p><p className="mt-2 text-3xl font-black">{loans.length}</p></div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-bold text-slate-500">Open Due / Missed Total</p><p className="mt-2 text-3xl font-black text-amber-700">{money(totalDue)}</p></div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-bold text-slate-500">Payments Recorded</p><p className="mt-2 text-3xl font-black text-emerald-700">{payments.length}</p></div>
        </div>

        {loans.map((loan) => {
          const loanSchedule = schedule.filter((row) => row.loan_number === loan.loan_number);
          const nextPayment = firstOpenInstallment(loan.loan_number);
          const nextHref = nextPayment
            ? `/payment?purpose=repayment&loan=${loan.loan_number}&schedule=${nextPayment.id}&amount=${Number(nextPayment.expected_total || 0).toFixed(2)}`
            : `/payment?purpose=repayment&loan=${loan.loan_number}`;

          return (
            <section key={loan.loan_number} className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
              <div className="border-b bg-slate-100 px-5 py-4">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                  <div>
                    <h2 className="text-xl font-black">Loan #{loan.loan_number}</h2>
                    <p className="text-sm text-slate-600">{loan.business_name || "Borrower loan"} · {money(loan.loan_amount)} · {loan.status || "status pending"}</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <a href={nextHref} className="rounded-xl bg-emerald-600 px-4 py-3 font-black text-white shadow-sm hover:bg-emerald-500">Pay next with NMI</a>
                    <button disabled title="Square repayment requires production Web Payments keys and server-side settlement wiring." className="rounded-xl bg-slate-300 px-4 py-3 font-black text-slate-600">Square pending config</button>
                  </div>
                </div>
              </div>

              {nextPayment && (
                <div className="m-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-black uppercase tracking-wide text-emerald-800">Next open installment</p>
                  <p className="mt-1 text-lg font-black text-slate-950">Payment {nextPayment.installment_number}: {money(nextPayment.expected_total)} due {dateOnly(nextPayment.due_date)}</p>
                  <p className="text-sm text-slate-600">Principal {money(nextPayment.expected_principal)} · Interest {money(nextPayment.expected_interest)}</p>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="text-slate-500">
                    <tr>
                      {['Inst.', 'Due Date', 'Expected', 'Principal Collected', 'Interest Collected', 'Status'].map((heading) => <th className="p-3 font-black" key={heading}>{heading}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {loanSchedule.slice(0, 12).map((row) => (
                      <tr key={row.id} className="border-t">
                        <td className="p-3 font-black">{row.installment_number}</td>
                        <td className="p-3">{dateOnly(row.due_date)}</td>
                        <td className="p-3">{money(row.expected_total)}</td>
                        <td className="p-3">{money(row.collected_principal)}</td>
                        <td className="p-3">{money(row.collected_interest)}</td>
                        <td className="p-3"><span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${statusClass(row.status)}`}>{row.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!loading && loanSchedule.length === 0 && <p className="p-5 text-slate-500">No payment schedule has been generated for this loan yet.</p>}
            </section>
          );
        })}

        <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b bg-slate-100 px-5 py-4">
            <h2 className="text-xl font-black">Recent payment history</h2>
            <p className="text-sm text-slate-600">Settled, reversed, and pending processor records display here.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  {['Payment #', 'Loan #', 'Amount', 'Status', 'Processor', 'Created', 'Settled'].map((heading) => <th className="p-3 font-black" key={heading}>{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-t">
                    <td className="p-3 font-black">{payment.payment_number ?? '—'}</td>
                    <td className="p-3">#{payment.loan_number}</td>
                    <td className="p-3">{money(payment.amount)}</td>
                    <td className="p-3"><span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${statusClass(payment.status)}`}>{payment.status}</span></td>
                    <td className="p-3">{payment.processor || '—'}</td>
                    <td className="p-3">{dateOnly(payment.created_at)}</td>
                    <td className="p-3">{dateOnly(payment.settled_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && payments.length === 0 && <p className="p-5 text-slate-500">No borrower payments recorded yet.</p>}
        </section>
      </div>
    </AppLayout>
  );
}
