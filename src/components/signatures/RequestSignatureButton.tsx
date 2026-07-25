import { useState } from "react";
import { supabase } from "../../lib/supabase";

type RequestSignatureButtonProps = {
  generatedDocumentId: string;
  onRequested?: () => void;
};

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const value = (error as Record<string, unknown>).message;
    if (typeof value === "string") return value;
  }

  return "Unable to request the borrower signature.";
}

export default function RequestSignatureButton({
  generatedDocumentId,
  onRequested,
}: RequestSignatureButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function requestSignature() {
    if (!supabase) {
      setMessage("Supabase is not configured.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.rpc("request_borrower_signature", {
        p_generated_document_id: generatedDocumentId,
        p_expires_at: null,
      });

      if (error) throw error;

      setMessage("Borrower signature requested.");
      onRequested?.();
    } catch (error: unknown) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={loading}
        onClick={() => void requestSignature()}
        className="rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white disabled:opacity-50"
      >
        {loading ? "Requesting…" : "Request Borrower Signature"}
      </button>

      {message && (
        <p className="mt-2 text-sm font-semibold text-slate-300">{message}</p>
      )}
    </div>
  );
}
