import { useState } from "react";
import { supabase } from "../lib/supabase";

interface LoanApplication {
  id: string | number;
  loan_number?: string | number | null;
  requested_loan_amount?: number | string | null;
  approved_loan_amount?: number | string | null;
  land_value?: number | string | null;
  counteroffer_status?: string | null;
  counteroffer_admin_notes?: string | null;
}

interface Props {
  loan: LoanApplication;
  onChanged?: () => void | Promise<void>;
}

function amount(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export default function BorrowerCounterofferNotice({
  loan,
  onChanged,
}: Props) {
  const [saving, setSaving] = useState(false);

  if (
    loan.counteroffer_status !== "pending_borrower_acceptance"
  ) {
    return null;
  }

  const requested = amount(loan.requested_loan_amount);
  const approved = amount(loan.approved_loan_amount);
  const landValue = amount(loan.land_value);
  const ltv = landValue > 0 ? (approved / landValue) * 100 : 0;

  async function respond(accepted: boolean) {
    if (!supabase) return;

    setSaving(true);
    try {
      const now = new Date().toISOString();

      if (accepted) {
        const { error } = await supabase
          .from("loan_applications")
          .update({
            loan_amount: approved,
            amount_remaining: approved,
            approved_loan_amount: approved,
            counteroffer_status: "accepted",
            counteroffer_responded_at: now,
            status: "Pending",
            published_to_marketplace: false,
          })
          .eq("id", loan.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("loan_applications")
          .update({
            counteroffer_status: "declined",
            counteroffer_responded_at: now,
            status: "Counteroffer Declined",
            published_to_marketplace: false,
          })
          .eq("id", loan.id);

        if (error) throw error;
      }

      await supabase
        .from("loan_counteroffers")
        .update({
          status: accepted ? "accepted" : "declined",
          responded_at: now,
        })
        .eq("loan_application_id", loan.id)
        .eq("status", "pending_borrower_acceptance");

      await onChanged?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-blue-400 bg-blue-50 p-5 text-blue-950">
      <h2 className="text-xl font-bold">Revised loan offer</h2>
      <p className="mt-2">
        Original request: {money(requested)}
      </p>
      <p>Revised offer: {money(approved)}</p>
      <p>Resulting LTV: {ltv.toFixed(2)}%</p>

      {loan.counteroffer_admin_notes && (
        <p className="mt-4">{loan.counteroffer_admin_notes}</p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => respond(true)}
          disabled={saving}
          className="rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white"
        >
          Accept Revised Offer
        </button>
        <button
          type="button"
          onClick={() => respond(false)}
          disabled={saving}
          className="rounded-xl bg-red-700 px-4 py-3 font-bold text-white"
        >
          Decline Offer
        </button>
      </div>
    </section>
  );
}
