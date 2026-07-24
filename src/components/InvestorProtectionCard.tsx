import { useEffect, useMemo, useState } from "react";
import {
  ProtectedInvestment,
  getProtectionTime,
  requestInvestmentRefund,
} from "../features/investorProtection/investorProtectionService";

interface Props {
  investment: ProtectedInvestment;
  onUpdated?: () => void;
}

export default function InvestorProtectionCard({ investment, onUpdated }: Props) {
  const [now, setNow] = useState(Date.now());
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const protection = useMemo(
    () => getProtectionTime(investment.refund_deadline),
    [investment.refund_deadline, now]
  );

  const refundable =
    investment.refund_policy_enabled &&
    investment.status === "protection_period" &&
    protection.eligible;

  async function handleRefund() {
    if (!refundable || loading) return;
    if (!window.confirm("Cancel this investment and request a full refund?")) return;

    setLoading(true);
    setMessage("");
    try {
      await requestInvestmentRefund(investment.id, reason);
      setMessage("Refund request submitted.");
      onUpdated?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Refund request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            7-Day Investment Protection
          </p>
          <h3 className="mt-1 text-lg font-bold text-slate-900">
            ${Number(investment.amount).toLocaleString()} investment
          </h3>
          <p className="text-sm text-slate-600">Loan #{investment.loan_application_id}</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">
          {investment.status.replaceAll("_", " ")}
        </span>
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 p-4">
        <p className="font-semibold text-slate-900">{protection.label}</p>
        {investment.refund_deadline && (
          <p className="mt-1 text-sm text-slate-600">
            Refund deadline: {new Date(investment.refund_deadline).toLocaleString()}
          </p>
        )}
      </div>

      {refundable && (
        <div className="mt-4 space-y-3">
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason for cancellation (optional)"
            className="min-h-24 w-full rounded-xl border border-slate-300 p-3"
          />
          <button
            type="button"
            onClick={handleRefund}
            disabled={loading}
            className="w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Submitting..." : "Request Full Investment Refund"}
          </button>
        </div>
      )}

      <p className="mt-4 text-xs leading-5 text-slate-500">
        This protection applies only to this investor investment. It does not give
        borrowers a loan cancellation or refund right.
      </p>

      {message && <p className="mt-3 text-sm font-medium text-slate-800">{message}</p>}
    </section>
  );
}
