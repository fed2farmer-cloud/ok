import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { supabase } from "../lib/supabase";

function money(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      })
    : "—";
}

function date(value: string | null | undefined) {
  return value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "None scheduled";
}

function Detail({
  label,
  value,
  full = false,
}: {
  label: string;
  value: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 ${
        full ? "col-span-2 sm:col-span-3" : ""
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-black leading-tight text-slate-950 sm:text-base">
        {value}
      </p>
    </div>
  );
}

export default function SecondaryLoanDetails() {
  const { loanNumber } = useParams();
  const [loan, setLoan] = useState<any>(null);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase || !loanNumber) {
        if (active) {
          setError("The database connection or loan number is unavailable.");
          setLoading(false);
        }
        return;
      }

      const [{ data: loanRow, error: loanError }, { data: scheduleRows, error: scheduleError }] =
        await Promise.all([
          supabase
            .from("loan_applications")
            .select("*")
            .eq("loan_number", Number(loanNumber))
            .maybeSingle(),
          supabase
            .from("loan_payment_schedule")
            .select(
              "installment_number,due_date,expected_total,status,paid_at"
            )
            .eq("loan_number", Number(loanNumber))
            .order("installment_number"),
        ]);

      if (!active) return;
      if (loanError) setError(loanError.message);
      else if (scheduleError) setError(scheduleError.message);
      else if (!loanRow) setError("The underlying loan could not be found.");
      setLoan(loanRow);
      setSchedule(scheduleRows || []);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [loanNumber]);

  const paid = schedule.filter((row) => row.status === "paid");
  const onTime = paid.filter(
    (row) =>
      row.paid_at &&
      new Date(row.paid_at).getTime() <=
        new Date(`${row.due_date}T23:59:59`).getTime()
  ).length;
  const nextPayment = schedule.find(
    (row) => !["paid", "waived"].includes(row.status)
  );
  const property = [loan?.property_address, loan?.county, loan?.state]
    .filter(Boolean)
    .join(", ");

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-8">
        <section className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-5 py-5 text-white shadow-xl sm:px-7 sm:py-6">
          <Link
            to="/secondary-market"
            className="text-xs font-bold text-emerald-300 hover:text-emerald-200"
          >
            ← Secondary Market
          </Link>
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
            Underlying Loan
          </p>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              Loan #{loanNumber}
            </h1>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-slate-200">
              {loan?.status || "Loading"}
            </span>
          </div>
        </section>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Loading original loan information…
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-base font-black text-slate-950">Original loan information</h2>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Detail label="Loan amount" value={money(loan?.loan_amount)} />
                <Detail label="Status" value={loan?.status || "—"} />
                <Detail
                  label="Term"
                  value={
                    loan?.repayment_term_months
                      ? `${loan.repayment_term_months} months`
                      : "—"
                  }
                />
                <Detail label="Land type" value={loan?.land_type || "—"} />
                <Detail label="Acreage" value={loan?.acreage ?? "—"} />
                <Detail label="Property" value={property || "On file"} />
                <Detail label="Loan purpose" value={loan?.purpose || "—"} full />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-base font-black text-slate-950">Payment performance</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Detail label="Payments made" value={paid.length} />
                <Detail label="Paid on time" value={`${onTime} of ${paid.length}`} />
                <Detail label="Late / missed" value={paid.length - onTime} />
                <Detail label="Scheduled" value={schedule.length} />
                <Detail label="Next date" value={date(nextPayment?.due_date)} />
                <Detail
                  label="Next payment"
                  value={nextPayment ? money(nextPayment.expected_total) : "—"}
                />
              </div>
            </section>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
