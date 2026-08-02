import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Investment = {
  id: number;
  loan_id: number;
  investor_id: string;
  current_owner_id: string | null;
  amount: number;
  created_at: string;
  investor_interest_rate: number | null;
  term_months: number | null;
  status: string | null;
  refund_policy_enabled: boolean | null;
  refund_period_days: number | null;
  refund_deadline: string | null;
  refund_requested_at: string | null;
  refunded_at: string | null;
  certificate_number: string | null;
};

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value || 0));
}

function eligibleForRefund(row: Investment) {
  if (!row.refund_policy_enabled || !row.refund_deadline) return false;
  if (row.refunded_at) return false;

  const blocked = ["refunded", "settled", "cancelled", "canceled", "processing"];
  if (blocked.includes(String(row.status || "").toLowerCase())) return false;

  return Date.now() <= new Date(row.refund_deadline).getTime();
}

function daysHoursLeft(deadline: string | null) {
  if (!deadline) return "";
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "Refund window expired";
  const hours = Math.ceil(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  const remainder = hours % 24;
  return days > 0 ? `${days}d ${remainder}h remaining` : `${hours}h remaining`;
}

export default function InvestorPortfolio() {
  const [rows, setRows] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setRows([]);
      setMessage("Please sign in to view your investments.");
      setLoading(false);
      return;
    }

    const uid = authData.user.id;
    const { data, error } = await supabase
      .from("investments")
      .select(
        "id,loan_id,investor_id,current_owner_id,amount,created_at,investor_interest_rate,term_months,status,refund_policy_enabled,refund_period_days,refund_deadline,refund_requested_at,refunded_at,certificate_number"
      )
      .or(`current_owner_id.eq.${uid},investor_id.eq.${uid}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setRows([]);
      setMessage(error.message);
    } else {
      setRows((data || []) as Investment[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeTotal = useMemo(
    () =>
      rows
        .filter((x) => !["refunded", "cancelled", "canceled"].includes(String(x.status || "").toLowerCase()))
        .reduce((sum, x) => sum + Number(x.amount || 0), 0),
    [rows]
  );

  async function requestRefund(row: Investment) {
    if (!eligibleForRefund(row)) return;

    const ok = window.confirm(
      `Cancel this ${money(row.amount)} investment?\n\n` +
        "The funds will be returned to your available wallet cash. This action cannot be undone."
    );
    if (!ok) return;

    setProcessingId(row.id);
    setMessage("");

    const { data, error } = await supabase.rpc("cancel_investment_with_refund", {
      p_investment_id: row.id,
    });

    if (error) {
      console.error(error);
      setMessage(error.message || "The investment could not be cancelled.");
      setProcessingId(null);
      await load();
      return;
    }

    const amount = Number((data as any)?.amount_refunded || row.amount);
    setMessage(`${money(amount)} was returned to your available wallet cash.`);
    setProcessingId(null);
    await load();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Secured Landing
            </p>
            <h1 className="text-3xl font-bold text-emerald-950">My Investments</h1>
            <p className="mt-1 text-sm text-slate-600">
              Portfolio, certificates, and investor-only cancellation status.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/investor-wallet"
              className="rounded-xl border border-emerald-700 bg-white px-4 py-2 font-semibold text-emerald-800"
            >
              Wallet
            </Link>
            <Link
              to="/investor-marketplace"
              className="rounded-xl bg-emerald-800 px-4 py-2 font-semibold text-white"
            >
              Marketplace
            </Link>
          </div>
        </div>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Active portfolio principal</p>
          <p className="mt-1 text-3xl font-bold text-emerald-950">{money(activeTotal)}</p>
          <p className="mt-2 text-xs text-slate-500">
            Eligible investments may be cancelled only during their original 7-day refund window.
          </p>
        </section>

        {message && (
          <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">Loading investments…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            You do not have any investments yet.
          </div>
        ) : (
          <div className="grid gap-4">
            {rows.map((row) => {
              const eligible = eligibleForRefund(row);
              const status = String(row.status || "active");
              return (
                <article
                  key={row.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Loan #{row.loan_id}
                      </p>
                      <p className="mt-1 text-2xl font-bold text-emerald-950">
                        {money(row.amount)}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-700">
                      {status}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                    <div>
                      <p className="text-slate-500">Investor rate</p>
                      <p className="font-semibold">{Number(row.investor_interest_rate || 0)}%</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Term</p>
                      <p className="font-semibold">{row.term_months || "—"} months</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Purchased</p>
                      <p className="font-semibold">{new Date(row.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Certificate</p>
                      <p className="break-all font-semibold">{row.certificate_number || "Pending"}</p>
                    </div>
                  </div>

                  {row.refund_policy_enabled && (
                    <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-bold text-amber-950">7-Day Investor Cancellation</p>
                          <p className="mt-1 text-sm text-amber-900">
                            {row.refunded_at
                              ? `Refund completed ${new Date(row.refunded_at).toLocaleString()}`
                              : eligible
                              ? `Deadline: ${new Date(row.refund_deadline!).toLocaleString()} • ${daysHoursLeft(row.refund_deadline)}`
                              : "Cancellation period expired or this investment is no longer eligible."}
                          </p>
                        </div>

                        {eligible && (
                          <button
                            type="button"
                            disabled={processingId === row.id}
                            onClick={() => void requestRefund(row)}
                            className="rounded-xl bg-rose-700 px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {processingId === row.id ? "Processing…" : "Cancel Investment / Refund"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
