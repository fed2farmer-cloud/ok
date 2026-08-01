import { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type RevisionItem =
  | "property_address"
  | "county"
  | "state"
  | "apn"
  | "acreage"
  | "property_value_documentation"
  | "proof_of_ownership"
  | "government_identification"
  | "loan_purpose"
  | "borrower_video"
  | "other";

interface LoanApplication {
  id: string | number;
  user_id?: string | null;
  loan_number?: string | number | null;
  full_name?: string | null;
  business_name?: string | null;
  state?: string | null;
  land_value?: number | string | null;
  loan_amount?: number | string | null;
  borrower_interest_rate?: number | null;
  repayment_term_months?: number | null;
  status?: string | null;
}

interface Props {
  loan: LoanApplication;
  onChanged?: () => void | Promise<void>;
  addToast?: (
    message: string,
    type?: "success" | "error" | "info",
  ) => void;
}

const REVISION_OPTIONS: Array<{
  value: RevisionItem;
  label: string;
}> = [
  { value: "property_address", label: "Property address" },
  { value: "county", label: "County" },
  { value: "state", label: "State" },
  { value: "apn", label: "APN" },
  { value: "acreage", label: "Acreage" },
  {
    value: "property_value_documentation",
    label: "Property value documentation",
  },
  { value: "proof_of_ownership", label: "Proof of ownership" },
  {
    value: "government_identification",
    label: "Government identification",
  },
  { value: "loan_purpose", label: "Loan purpose" },
  { value: "borrower_video", label: "Borrower introduction video" },
  { value: "other", label: "Other" },
];

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function numberValue(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function monthlyPayment(
  principal: number,
  annualRatePercent: number,
  months: number,
): number {
  if (principal <= 0 || months <= 0) return 0;
  const monthlyRate = annualRatePercent / 100 / 12;
  if (monthlyRate === 0) return principal / months;

  return (
    (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1)
  );
}

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

export default function AdminLoanReviewActions({
  loan,
  onChanged,
  addToast,
}: Props) {
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [counterofferOpen, setCounterofferOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<RevisionItem[]>([]);
  const [revisionMessage, setRevisionMessage] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [approvedAmount, setApprovedAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const landValue = numberValue(loan.land_value);
  const requestedAmount = numberValue(loan.loan_amount);
  const maxAtFiftyPercent = landValue * 0.5;
  const requestedLtv =
    landValue > 0 ? (requestedAmount / landValue) * 100 : 0;

  const proposedAmount = numberValue(approvedAmount);
  const proposedLtv =
    landValue > 0 ? (proposedAmount / landValue) * 100 : 0;

  const estimatedPayment = useMemo(
    () =>
      monthlyPayment(
        proposedAmount,
        numberValue(loan.borrower_interest_rate),
        numberValue(loan.repayment_term_months),
      ),
    [
      proposedAmount,
      loan.borrower_interest_rate,
      loan.repayment_term_months,
    ],
  );

  function notify(
    message: string,
    type: "success" | "error" | "info" = "info",
  ) {
    if (addToast) addToast(message, type);
    else window.alert(message);
  }

  async function refresh() {
    await onChanged?.();
  }

  function toggleRevisionItem(item: RevisionItem) {
    setSelectedItems((current) =>
      current.includes(item)
        ? current.filter((value) => value !== item)
        : [...current, item],
    );
  }

  async function sendRevisionRequest() {
    if (!supabase) {
      notify("Supabase is not configured.", "error");
      return;
    }

    if (selectedItems.length === 0) {
      notify("Select at least one item for revision.", "error");
      return;
    }

    if (!revisionMessage.trim()) {
      notify("Enter a message for the borrower.", "error");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error: requestError } = await supabase
        .from("loan_revision_requests")
        .insert({
          loan_application_id: Number(loan.id),
          borrower_user_id: loan.user_id ?? null,
          requested_by: user?.id ?? null,
          revision_items: selectedItems,
          message: revisionMessage.trim(),
          status: "requested",
          requested_at: new Date().toISOString(),
        });

      if (requestError) throw requestError;

      const { error: loanError } = await supabase
        .from("loan_applications")
        .update({
          status: "Revision Requested",
          revision_status: "pending_borrower",
          revision_requested_at: new Date().toISOString(),
          revision_message: revisionMessage.trim(),
          revision_items: selectedItems,
          revision_count: 1,
          published_to_marketplace: false,
        })
        .eq("id", loan.id);

      if (loanError) throw loanError;

      await supabase.from("borrower_notifications").insert({
        loan_application_id: Number(loan.id),
        user_id: loan.user_id ?? null,
        notification_type: "revision_requested",
        title: "Action required: revise your loan application",
        message: revisionMessage.trim(),
        metadata: {
          requested_items: selectedItems,
          loan_number: loan.loan_number ?? null,
        },
      });

      notify("Revision request sent to the borrower.", "success");
      setRevisionOpen(false);
      setSelectedItems([]);
      setRevisionMessage("");
      await refresh();
    } catch (error: unknown) {
      console.error("Send revision request failed:", error);
      notify(
        errorMessage(error, "Unable to send revision request."),
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  function openCounteroffer() {
    const capped = Math.min(requestedAmount, maxAtFiftyPercent);
    setApprovedAmount(capped.toFixed(2));
    setCounterofferOpen(true);
  }

  async function sendCounteroffer() {
    if (!supabase) {
      notify("Supabase is not configured.", "error");
      return;
    }

    if (landValue <= 0) {
      notify("A valid land value is required.", "error");
      return;
    }

    if (proposedAmount <= 0) {
      notify("Enter a valid approved amount.", "error");
      return;
    }

    if (proposedAmount > maxAtFiftyPercent + 0.005) {
      notify(
        `Approved amount cannot exceed ${money(maxAtFiftyPercent)} at 50% LTV.`,
        "error",
      );
      return;
    }

    if (!adminNotes.trim()) {
      notify("Enter a message explaining the revised offer.", "error");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error: offerError } = await supabase
        .from("loan_counteroffers")
        .insert({
          loan_application_id: Number(loan.id),
          borrower_user_id: loan.user_id ?? null,
          created_by: user?.id ?? null,
          original_loan_amount: requestedAmount,
          proposed_loan_amount: proposedAmount,
          land_value: landValue,
          maximum_ltv_percent: 50,
          resulting_ltv_percent: proposedLtv,
          borrower_interest_rate:
            loan.borrower_interest_rate ?? null,
          repayment_term_months:
            loan.repayment_term_months ?? null,
          estimated_monthly_payment: estimatedPayment,
          explanation: adminNotes.trim(),
          status: "pending",
          sent_at: new Date().toISOString(),
        });

      if (offerError) throw offerError;

      const { error: loanError } = await supabase
        .from("loan_applications")
        .update({
          requested_loan_amount: requestedAmount,
          approved_loan_amount: proposedAmount,
          counteroffer_status: "pending_borrower_acceptance",
          counteroffer_sent_at: new Date().toISOString(),
          counteroffer_admin_notes: adminNotes.trim(),
          status: "Counteroffer Pending",
          published_to_marketplace: false,
        })
        .eq("id", loan.id);

      if (loanError) throw loanError;

      const { error: notificationError } = await supabase
        .from("borrower_notifications")
        .insert({
          loan_application_id: Number(loan.id),
          user_id: loan.user_id ?? null,
          notification_type: "counteroffer_sent",
          title: "Revised loan offer available",
          message: adminNotes.trim(),
          metadata: {
            requested_amount: requestedAmount,
            proposed_amount: proposedAmount,
            land_value: landValue,
            proposed_ltv: proposedLtv,
            estimated_monthly_payment: estimatedPayment,
            loan_number: loan.loan_number ?? null,
          },
        });

      if (notificationError) throw notificationError;

      if (!user?.id || !loan.user_id) {
        throw new Error(
          "The administrator or borrower user ID is missing, so the message thread could not be created.",
        );
      }

      const messageBody = [
        `A revised loan offer is ready for Loan #${loan.loan_number ?? loan.id}.`,
        `Original request: ${money(requestedAmount)}`,
        `Revised offer: ${money(proposedAmount)}`,
        `Land value: ${money(landValue)}`,
        `Resulting LTV: ${proposedLtv.toFixed(2)}%`,
        `Interest rate: ${numberValue(loan.borrower_interest_rate).toFixed(2)}%`,
        `Term: ${numberValue(loan.repayment_term_months)} months`,
        `Estimated monthly payment: ${money(estimatedPayment)}`,
        "",
        adminNotes.trim(),
        "",
        "Open Messages to accept, decline, or ask a question about this offer.",
      ].join("\n");

      const { error: messageError } = await supabase
        .from("messages")
        .insert({
          // Keep both legacy and current participant columns populated.
          // The production messages table requires sender_user_id/recipient_user_id.
          sender_user_id: user.id,
          recipient_user_id: loan.user_id,
          sender_id: user.id,
          recipient_id: loan.user_id,
          sender_role: "admin",
          message_type: "counteroffer",
          subject: `Revised loan offer - Loan #${loan.loan_number ?? loan.id}`,
          loan_application_id: Number(loan.id),
          body: messageBody,
          read: false,
        });

      if (messageError) throw messageError;

      notify("Revised loan offer sent to the borrower.", "success");
      setCounterofferOpen(false);
      setApprovedAmount("");
      setAdminNotes("");
      await refresh();
    } catch (error: unknown) {
      console.error("Send revised offer failed:", error);
      notify(
        errorMessage(error, "Unable to send revised loan offer."),
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-700 bg-slate-950 p-4">
      <h3 className="text-lg font-bold text-white">
        Underwriting actions
      </h3>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setRevisionOpen(true)}
          className="rounded-xl bg-amber-500 px-4 py-3 font-bold text-slate-950"
        >
          Request Revision
        </button>

        <button
          type="button"
          onClick={openCounteroffer}
          className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white"
        >
          Send Revised Loan Offer
        </button>
      </div>

      {requestedLtv > 50 && (
        <div className="mt-4 rounded-xl border border-red-500/40 bg-red-950/40 p-4">
          <p className="font-bold text-red-200">
            Requested LTV exceeds 50%
          </p>
          <p className="mt-1 text-sm text-red-100">
            Requested: {money(requestedAmount)} · Land value:{" "}
            {money(landValue)} · LTV: {requestedLtv.toFixed(2)}%
          </p>
          <p className="mt-1 text-sm text-red-100">
            Maximum at 50% LTV: {money(maxAtFiftyPercent)}
          </p>
        </div>
      )}

      {revisionOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4">
          <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-slate-600 bg-slate-900 p-5">
            <h2 className="text-2xl font-bold text-white">
              Request Borrower Revision
            </h2>
            <p className="mt-2 text-slate-300">
              Select everything the borrower must correct or provide.
            </p>

            <div className="mt-5 grid gap-3">
              {REVISION_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 p-3 text-white"
                >
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(option.value)}
                    onChange={() => toggleRevisionItem(option.value)}
                    className="h-5 w-5"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>

            <label className="mt-5 block">
              <span className="font-semibold text-white">
                Message to borrower
              </span>
              <textarea
                value={revisionMessage}
                onChange={(event) =>
                  setRevisionMessage(event.target.value)
                }
                rows={5}
                className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-white"
                placeholder="Explain exactly what is missing and what the borrower should submit."
              />
            </label>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={sendRevisionRequest}
                disabled={saving}
                className="rounded-xl bg-amber-500 px-5 py-3 font-bold text-slate-950 disabled:opacity-50"
              >
                {saving ? "Sending..." : "Send to Borrower"}
              </button>
              <button
                type="button"
                onClick={() => setRevisionOpen(false)}
                disabled={saving}
                className="rounded-xl border border-slate-600 px-5 py-3 font-bold text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {counterofferOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4">
          <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-slate-600 bg-slate-900 p-5">
            <h2 className="text-2xl font-bold text-white">
              Send Revised Loan Offer
            </h2>

            <div className="mt-5 grid gap-3 rounded-xl bg-slate-800 p-4 text-slate-200">
              <p>Original request: {money(requestedAmount)}</p>
              <p>Land value: {money(landValue)}</p>
              <p>Maximum at 50% LTV: {money(maxAtFiftyPercent)}</p>
            </div>

            <label className="mt-5 block">
              <span className="font-semibold text-white">
                Proposed approved amount
              </span>
              <input
                type="number"
                min="0"
                max={maxAtFiftyPercent}
                step="0.01"
                value={approvedAmount}
                onChange={(event) =>
                  setApprovedAmount(event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-white"
              />
            </label>

            <div className="mt-4 rounded-xl border border-blue-500/30 bg-blue-950/40 p-4 text-blue-100">
              <p>Resulting LTV: {proposedLtv.toFixed(2)}%</p>
              <p>
                Estimated monthly payment: {money(estimatedPayment)}
              </p>
            </div>

            <label className="mt-5 block">
              <span className="font-semibold text-white">
                Explanation to borrower
              </span>
              <textarea
                value={adminNotes}
                onChange={(event) => setAdminNotes(event.target.value)}
                rows={5}
                className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-white"
                placeholder="Explain why the amount or terms were revised."
              />
            </label>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={sendCounteroffer}
                disabled={saving}
                className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-50"
              >
                {saving ? "Sending..." : "Send Revised Offer"}
              </button>
              <button
                type="button"
                onClick={() => setCounterofferOpen(false)}
                disabled={saving}
                className="rounded-xl border border-slate-600 px-5 py-3 font-bold text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
