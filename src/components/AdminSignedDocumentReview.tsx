import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type SignedDocument = {
  id: string;
  loan_application_id: string | number;
  document_type: string;
  title: string;
  signed_storage_path: string | null;
  signed_uploaded_at: string | null;
  signed_review_status: string | null;
  signed_admin_notes: string | null;
  terms_snapshot?: Record<string, unknown> | null;
};

export default function AdminSignedDocumentReview() {
  const [rows, setRows] = useState<SignedDocument[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("generated_loan_documents")
      .select("id,loan_application_id,document_type,title,signed_storage_path,signed_uploaded_at,signed_review_status,signed_admin_notes,terms_snapshot")
      .not("signed_storage_path", "is", null)
      .order("signed_uploaded_at", { ascending: false });
    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }
    const documents = (data as SignedDocument[] | null) || [];
    setRows(documents);
    setNotes(Object.fromEntries(documents.map((row) => [row.id, row.signed_admin_notes || ""])));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function openDocument(row: SignedDocument) {
    if (!supabase || !row.signed_storage_path) return;
    const { data, error: urlError } = await supabase.storage
      .from("signed-loan-documents")
      .createSignedUrl(row.signed_storage_path, 900);
    if (urlError || !data?.signedUrl) {
      setError(urlError?.message || "Unable to open signed document.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function review(row: SignedDocument, status: "approved" | "more_information" | "rejected") {
    if (!supabase) return;
    setSaving(row.id);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: updateError } = await supabase
        .from("generated_loan_documents")
        .update({
          signed_review_status: status,
          signed_admin_notes: notes[row.id]?.trim() || null,
          signed_reviewed_at: new Date().toISOString(),
          signed_reviewed_by: user?.id ?? null,
          status: status === "approved" ? "executed_approved" : status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (updateError) throw updateError;
      await load();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Review could not be saved.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Closing document queue</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">Signed documents awaiting review</h2>
          <p className="mt-1 text-sm text-slate-600">Approve, reject, or request corrections before a loan is cleared for funding.</p>
        </div>
        <button onClick={() => void load()} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold">Refresh</button>
      </div>
      {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
      {loading ? <p className="mt-4 text-sm text-slate-500">Loading signed documents…</p> : rows.length === 0 ? (
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">No signed documents are waiting for review.</p>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {rows.map((row) => {
            const snapshot = row.terms_snapshot || {};
            return (
              <article key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Loan #{String(snapshot.loan_number || row.loan_application_id)}</p>
                    <h3 className="mt-1 font-black text-slate-950">{row.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">Uploaded {row.signed_uploaded_at ? new Date(row.signed_uploaded_at).toLocaleString() : "—"}</p>
                  </div>
                  <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black capitalize text-violet-800">{String(row.signed_review_status || "uploaded").replace(/_/g, " ")}</span>
                </div>
                <button onClick={() => void openDocument(row)} className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-emerald-700">Open signed document</button>
                <textarea rows={2} value={notes[row.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))} placeholder="Admin review notes" className="mt-3 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm" />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button disabled={saving === row.id} onClick={() => void review(row, "approved")} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Approve</button>
                  <button disabled={saving === row.id} onClick={() => void review(row, "more_information")} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Request corrections</button>
                  <button disabled={saving === row.id} onClick={() => void review(row, "rejected")} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Reject</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
