import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { supabase } from "../lib/supabase";
import {
  loadSecondaryListings,
  type SecondaryListing,
} from "../lib/secondaryMarket";

type LoanPerformance = {
  paid: number;
  onTime: number;
  late: number;
  scheduled: number;
  nextDate: string | null;
  nextTotal: number | null;
  remainingInterest: number;
  loanAmount: number;
};

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

function percent(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(2)}%` : "—";
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

function Metric({
  label,
  value,
  accent = false,
  note,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
  note?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <p className="text-[10px] font-bold uppercase leading-tight tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p
        className={`mt-1 break-words text-sm font-black leading-tight sm:text-base ${
          accent ? "text-emerald-700" : "text-slate-950"
        }`}
      >
        {value}
      </p>
      {note && <p className="mt-1 text-[10px] leading-tight text-slate-500">{note}</p>}
    </div>
  );
}

export default function SecondaryMarket() {
  const [rows, setRows] = useState<SecondaryListing[]>([]);
  const [performance, setPerformance] = useState<Record<number, LoanPerformance>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadPerformance(listings: SecondaryListing[]) {
    if (!supabase || !listings.length) {
      setPerformance({});
      return;
    }

    const loanNumbers = [...new Set(listings.map((row) => Number(row.loan_number)))];
    const results = await Promise.all(
      loanNumbers.map(async (loanNumber) => {
        const { data, error } = await supabase.rpc("get_secondary_loan_performance_v1", {
          p_loan_number: loanNumber,
        });
        if (error) throw error;
        return { loanNumber, data: data || {} };
      })
    );

    const next: Record<number, LoanPerformance> = {};
    for (const { loanNumber, data } of results) {
      next[loanNumber] = {
        paid: Number(data.paid || 0),
        onTime: Number(data.on_time || 0),
        late: Number(data.late_missed || 0),
        scheduled: Number(data.scheduled || 0),
        nextDate: data.next_date || null,
        nextTotal: data.next_total == null ? null : Number(data.next_total),
        remainingInterest: Number(data.remaining_interest || 0),
        loanAmount: Number(data.loan_amount || 0),
      };
    }
    setPerformance(next);
  }

  async function refresh() {
    setLoading(true);
    setMessage("");
    try {
      const listings = await loadSecondaryListings();
      setRows(listings);
      await loadPerformance(listings);
    } catch (error: any) {
      setMessage(error?.message || "Unable to load the secondary market.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-5 py-5 text-white shadow-xl sm:px-7 sm:py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
                Secondary Market
              </p>
              <h1 className="mt-1.5 text-2xl font-black tracking-tight sm:text-3xl">
                Loan Security Certificates
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
                Compare seller price, remaining principal and verified loan performance before buying.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-right">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Open listings</p>
              <p className="text-xl font-black text-emerald-300">{rows.length}</p>
            </div>
          </div>
        </section>

        {message && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            {message}
          </div>
        )}

        {loading ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            Loading certificate listings…
          </div>
        ) : (
          <div className="mt-4 grid gap-4">
            {rows.map((listing) => {
              const loanPerformance = performance[Number(listing.loan_number)];
              const certificateShare =
                loanPerformance?.loanAmount > 0
                  ? Number(listing.original_principal || 0) / loanPerformance.loanAmount
                  : 0;
              const expectedRemainingValue = loanPerformance
                ? Number(listing.current_principal || 0) +
                  loanPerformance.remainingInterest * certificateShare
                : null;
              const nextCertificatePayment =
                loanPerformance?.nextTotal != null && certificateShare > 0
                  ? loanPerformance.nextTotal * certificateShare
                  : null;

              return (
                <article
                  key={listing.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3.5 sm:px-5">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                        Resale Certificate
                      </p>
                      <Link
                        to={`/investment-certificate/${encodeURIComponent(
                          listing.certificate_number
                        )}`}
                        className="mt-1 block break-all text-base font-black text-slate-950 underline decoration-emerald-400 underline-offset-4 sm:text-lg"
                      >
                        {listing.certificate_number}
                      </Link>
                      <Link
                        to={`/secondary-market/loan/${listing.loan_number}`}
                        className="mt-1.5 inline-flex text-xs font-bold text-emerald-700 hover:text-emerald-600"
                      >
                        View Original Loan #{listing.loan_number} →
                      </Link>
                    </div>
                    <div className="rounded-xl bg-emerald-50 px-3 py-2 text-right ring-1 ring-emerald-200">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-800">
                        Asking price
                      </p>
                      <p className="text-xl font-black text-emerald-700">
                        {money(listing.asking_price)}
                      </p>
                    </div>
                  </header>

                  <div className="bg-slate-50/70 p-3 sm:p-4">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                      <Metric label="Original" value={money(listing.original_principal)} />
                      <Metric label="Principal left" value={money(listing.current_principal)} />
                      <Metric
                        label="Seller price"
                        value={money(listing.asking_price)}
                        accent
                      />
                      <Metric
                        label="Discount"
                        value={percent(
                          Number.isFinite(Number(listing.discount_to_original_percent))
                            ? listing.discount_to_original_percent
                            : Number(listing.original_principal) > 0
                              ? (1 - Number(listing.asking_price) / Number(listing.original_principal)) * 100
                              : null
                        )}
                        note="vs. original"
                      />
                      <Metric
                        label="Est. remaining*"
                        value={money(expectedRemainingValue)}
                      />
                    </div>

                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-100/80 p-2.5">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <h2 className="text-xs font-black uppercase tracking-[0.12em] text-slate-700">
                          Loan performance
                        </h2>
                        <Link
                          to={`/secondary-market/loan/${listing.loan_number}`}
                          className="text-[11px] font-bold text-emerald-700"
                        >
                          Full details →
                        </Link>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                        <Metric label="Paid" value={loanPerformance?.paid ?? "—"} />
                        <Metric
                          label="On time"
                          value={
                            loanPerformance
                              ? `${loanPerformance.onTime} of ${loanPerformance.paid}`
                              : "—"
                          }
                        />
                        <Metric label="Late / missed" value={loanPerformance?.late ?? "—"} />
                        <Metric
                          label="Next date"
                          value={date(loanPerformance?.nextDate)}
                        />
                        <Metric
                          label="Est. cert. share"
                          value={money(nextCertificatePayment)}
                        />
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr]">
                      <Link
                        to={`/investment-certificate/${encodeURIComponent(
                          listing.certificate_number
                        )}`}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-black text-slate-800 hover:bg-slate-100"
                      >
                        View Certificate
                      </Link>
                      <Link
                        to={`/secondary-market/purchase/${listing.id}`}
                        className="rounded-xl bg-gradient-to-r from-emerald-600 to-blue-700 px-4 py-3 text-center text-sm font-black text-white shadow-md hover:from-emerald-500 hover:to-blue-600"
                      >
                        Buy Certificate — {money(listing.asking_price)}
                      </Link>
                    </div>

                    <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                      *Estimate equals current principal plus this certificate’s estimated share of scheduled unpaid interest. It is not guaranteed.
                    </p>
                  </div>
                </article>
              );
            })}

            {!rows.length && !message && (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
                No certificates are currently listed for resale.
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
