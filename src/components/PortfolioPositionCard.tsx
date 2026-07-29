import { useEffect, useMemo, useState } from "react";
import {
  PortfolioRow,
  getProtectionCountdown,
  requestRefundV29,
} from "../features/investorprotection/portfolioV29Service";

export default function PortfolioPositionCard({
  investment,
  onUpdated,
}: {
  investment: PortfolioRow;
  onUpdated?: () => void;
}) {
  const [clock, setClock] = useState(Date.now());
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const countdown = useMemo(
    () => getProtectionCountdown(investment.protection_expires_at),
    [investment.protection_expires_at, clock]
  );

  const refundable =
    investment.refund_eligible &&
    investment.status === "protection_period" &&
    countdown.active;

  async function handleRefund() {
    if (!refundable || submitting) return;
    if (
      !window.confirm(
        `Request a full refund for ${investment.certificate_number}?`
      )
    ) {
      return;
    }

    setSubmitting(true);
    setMessage("");
    try {
      await requestRefundV29(investment.investment_id, reason);
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

  async function copyCertificate() {
    try {
      await navigator.clipboard.writeText(investment.certificate_number);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setMessage("Unable to copy the certificate number.");
    }
  }

  return (
    <article className="rounded-3xl border border-slate-800 bg-[#111] p-6 text-white shadow-xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-400">
            {investment.business_name}
          </p>
          <h2 className="mt-2 text-2xl font-black">
            Loan #{investment.public_loan_number}
          </h2>
          <p className="mt-2 text-3xl font-black text-emerald-400">
            {Number(investment.amount).toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
            })}
          </p>
        </div>

        <span className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-emerald-300">
          {investment.display_status}
        </span>
      </div>

      <section className="mt-5 rounded-2xl border border-emerald-800/60 bg-emerald-950/25 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-400">
              Investment Certificate
            </p>
            <p className="mt-2 break-all font-mono text-lg font-black text-white">
              {investment.certificate_number}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Permanent ID • Issued {new Date(investment.certificate_issued_at).toLocaleDateString()}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void copyCertificate()}
            className="rounded-xl border border-emerald-700 px-3 py-2 text-sm font-bold text-emerald-300"
          >
            {copied ? "Copied" : "Copy Number"}
          </button>
        </div>

        <div className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
          <p>
            <strong className="text-white">Ownership:</strong> Current owner
          </p>
          <p>
            <strong className="text-white">Transfers:</strong> {investment.transfer_count}
          </p>
          <p>
            <strong className="text-white">Resale eligibility:</strong>{" "}
            {investment.transfer_locked ? "Locked" : "Registry ready"}
          </p>
          <p>
            <strong className="text-white">Certificate UUID:</strong>{" "}
            <span className="font-mono text-xs">{investment.certificate_uuid.slice(0, 8)}…</span>
          </p>
        </div>
      </section>

      {investment.status === "protection_period" && (
        <div className="mt-5 rounded-2xl border border-emerald-900 bg-emerald-950/40 p-4">
          <p className="font-bold text-emerald-300">
            🛡️ 7-Day Investment Protection
          </p>
          <p className="mt-2 text-lg font-black">{countdown.label}</p>
          {investment.protection_expires_at && (
            <p className="mt-1 text-sm text-slate-400">
              Ends {new Date(investment.protection_expires_at).toLocaleString()}
            </p>
          )}
        </div>
      )}

      <div className="mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
        <p>
          <strong className="text-white">Rate:</strong>{" "}
          {Number(investment.investor_interest_rate || 0).toFixed(2)}%
        </p>
        <p>
          <strong className="text-white">Term:</strong>{" "}
          {investment.term_months || 0} months
        </p>
      </div>

      {refundable && (
        <div className="mt-5 space-y-3">
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason for refund (optional)"
            className="min-h-20 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white"
          />
          <button
            type="button"
            disabled={submitting}
            onClick={handleRefund}
            className="w-full rounded-xl bg-red-600 px-4 py-3 font-black text-white disabled:opacity-60"
          >
            {submitting ? "Submitting..." : "Request Full Refund"}
          </button>
        </div>
      )}

      <p className="mt-5 text-xs text-slate-500">
        The certificate identifies this specific investment under Loan #{investment.public_loan_number}. Future secondary-market transfers should change ownership records without changing this certificate number.
      </p>

      {message && <p className="mt-4 text-sm font-semibold">{message}</p>}
    </article>
  );
}
