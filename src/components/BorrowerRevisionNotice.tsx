import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

interface LoanApplication {
  id: string | number;
  loan_number?: string | number | null;
  status?: string | null;
  revision_message?: string | null;
  revision_items?: string[] | null;
}

interface Props {
  loan: LoanApplication;
  editApplicationPath?: string;
  uploadDocumentsPath?: string;
  onSubmitted?: () => void | Promise<void>;
}

function itemLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function BorrowerRevisionNotice({
  loan,
  editApplicationPath = "/loan-application",
  uploadDocumentsPath = "/loan-documents",
  onSubmitted,
}: Props) {
  const [submitting, setSubmitting] = useState(false);

  if (
    loan.status !== "Revision Requested" &&
    loan.status !== "Resubmitted for Review"
  ) {
    return null;
  }

  async function submitForReview() {
    if (!supabase || loan.status !== "Revision Requested") return;

    setSubmitting(true);
    try {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from("loan_applications")
        .update({
          status: "Resubmitted for Review",
          revision_status: "resubmitted",
          revision_submitted_at: now,
          published_to_marketplace: false,
        })
        .eq("id", loan.id);

      if (error) throw error;

      await supabase
        .from("loan_revision_requests")
        .update({
          status: "resubmitted",
          borrower_submitted_at: now,
        })
        .eq("loan_application_id", loan.id)
        .eq("status", "pending");

      await onSubmitted?.();
    } finally {
      setSubmitting(false);
    }
  }

  const isResubmitted = loan.status === "Resubmitted for Review";

  return (
    <section className="rounded-2xl border border-amber-400 bg-amber-50 p-5 text-amber-950">
      <h2 className="text-xl font-bold">
        {isResubmitted
          ? "Corrections submitted for review"
          : "Action required: update your application"}
      </h2>

      <p className="mt-2">
        {isResubmitted
          ? "The underwriting team will review your updates."
          : loan.revision_message ||
            "The underwriting team needs additional information."}
      </p>

      {!isResubmitted && Boolean(loan.revision_items?.length) && (
        <ul className="mt-4 list-inside list-disc">
          {loan.revision_items!.map((item) => (
            <li key={item}>{itemLabel(item)}</li>
          ))}
        </ul>
      )}

      {!isResubmitted && (
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            to={`${editApplicationPath}?loan=${loan.id}`}
            className="rounded-xl bg-slate-950 px-4 py-3 font-bold text-white"
          >
            Edit Application
          </Link>
          <Link
            to={`${uploadDocumentsPath}?loan=${loan.id}`}
            className="rounded-xl border border-amber-900 px-4 py-3 font-bold"
          >
            Upload Documents
          </Link>
          <button
            type="button"
            onClick={submitForReview}
            disabled={submitting}
            className="rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit for Review"}
          </button>
        </div>
      )}
    </section>
  );
}
