import { useEffect, useMemo, useState } from "react";
import {
  PortfolioInvestment,
  getRefundCountdown,
  requestPortfolioRefund,
} from "../features/investorProtection/investorProtectionService";

export default function PortfolioInvestmentCard({
  investment,
  onUpdated,
}: {
  investment: PortfolioInvestment;
  onUpdated?: () => void;
}) {
  const [clock, setClock] = useState(Date.now());
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const countdown = useMemo(
    () => getRefundCountdown(investment.refund_deadline),
    [investment.refund_deadline, clock]
  );

  const refundable =
    investment.refund_policy_enabled &&
    investment.status === "protection_period" &&
    countdown.eligible;

  async function requestRefund() {
    if (!refundable || submitting) return;

    const confirmed = window.confirm(
      "Cancel this investment and return the full principal to available cash?"
    );

    if (!confirmed) return;

    setSubmitting(true);
    setMessage("");

    try {
      await requestPortfolioRefund(investment.id, reason);
      setMessage("Refund request submitted.");
      onUpdated?.();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Refund request failed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article className="rounded-2xl border border-emerald-900/40 bg-[#111] p-5 text-white">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">
            7-Day Investment Protection
          </p>
          <h3 className="mt-2 text-xl font-bold">
            Loan #{investment.loan_id}
          </h3>
          <p className="mt-1 text-2xl font-bold text-emerald-400">
            ${Number(investment.amount).toLocaleString()}
          </p>
        </div>

        <span className="rounded-full bg-emerald-950 px-3 py-1 text-sm font-semibold capitalize text-emerald-300">
          {investment.status.replaceAll("_", " ")}
        </span>
      </div>

      <div className="mt-4 rounded-xl bg-slate-900 p-4">
        <p className="font-semibold">{countdown.label}</p>
        {investment.refund_deadline && (
          <p className="mt-1 text-sm text-slate-400">
            Deadline: {new Date(investment.refund_deadline).toLocaleString()}
          </p>
        )}
      </div>

      {refundable && (
        <div className="mt-4 space-y-3">
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason for refund (optional)"
            className="min-h-20 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white"
          />

          <button
            type="button"
            disabled={submitting}
            onClick={requestRefund}
            className="w-full rounded-xl bg-red-600 px-4 py-3 font-bold text-white disabled:opacity-60"
          >
            {submitting ? "Submitting..." : "Request Full Refund"}
          </button>
        </div>
      )}

      {investment.status === "refund_requested" && (
        <p className="mt-4 rounded-xl bg-amber-950 p-3 font-semibold text-amber-300">
          Refund requested
        </p>
      )}

      {investment.status === "refunded" && (
        <p className="mt-4 rounded-xl bg-emerald-950 p-3 font-semibold text-emerald-300">
          Principal returned to available cash
        </p>
      )}

      <p className="mt-4 text-xs text-slate-500">
        Investor protection only. Borrowers do not receive this refund option.
      </p>

      {message && <p className="mt-3 text-sm font-semibold">{message}</p>}
    </article>
  );
}
