import { useEffect, useMemo, useRef, useState } from "react";
import AppLayout from "../components/AppLayout";
import { supabase } from "../lib/supabase";
import PromissoryNoteDocument from "../components/PromissoryNoteDocument";

type LoanOption = {
  id: string;
  loan_number?: number | null;
  business_name?: string | null;
  loan_amount?: number | null;
  status?: string | null;
};

type GeneratedDocument = {
  id: string;
  document_type: string;
  title: string;
  status: string;
  terms_snapshot: Record<string, any>;
  acknowledged_at?: string | null;
  signed_storage_path?: string | null;
  signed_uploaded_at?: string | null;
  signed_review_status?: string | null;
};

const labels: Record<string, string> = {
  promissory_note: "Promissory Note",
  deed_of_trust: "Security Instrument",
  payment_schedule: "Payment Schedule",
  borrower_certification: "Borrower Certification",
  esign_consent: "Electronic Signature Consent",
  closing_summary: "Closing Summary",
};

export default function LoanForms() {
  const requestedLoanId = new URLSearchParams(window.location.search).get("loanId") || "";
  const [loanId, setLoanId] = useState(requestedLoanId);
  const [loans, setLoans] = useState<LoanOption[]>([]);
  const [docs, setDocs] = useState<GeneratedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");

  useEffect(() => { void loadLoans(); }, []);
  useEffect(() => { if (loanId) void loadDocuments(loanId); }, [loanId]);

  async function loadLoans() {
    if (!supabase) { setError("Supabase is not configured."); setLoading(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }

    const { data, error: loanError } = await supabase
      .from("loan_applications")
      .select("id,loan_number,business_name,loan_amount,status,created_at")
      .eq("user_id", user.id)
      .in("status", ["Approved", "Funded", "approved", "funded"])
      .order("created_at", { ascending: false });

    if (loanError) { setError(loanError.message); setLoading(false); return; }
    const rows = (data as LoanOption[] | null) || [];
    setLoans(rows);
    if (!rows.length) { setError("No approved loan was found for this account."); setLoading(false); return; }

    const validRequested = requestedLoanId && rows.some((loan) => String(loan.id) === requestedLoanId);
    const resolved = validRequested ? requestedLoanId : String(rows[0].id);
    setLoanId(resolved);
    window.history.replaceState({}, "", `/loan-forms?loanId=${encodeURIComponent(resolved)}`);
  }

  async function loadDocuments(id: string) {
    if (!supabase) return;
    setLoading(true);
    setError("");
    const { data, error: documentError } = await supabase
      .from("generated_loan_documents")
      .select("*")
      .eq("loan_application_id", id)
      .order("created_at");
    if (documentError) { setError(documentError.message); setLoading(false); return; }
    const rows = (data as GeneratedDocument[] | null) || [];
    setDocs(rows);
    setSelected((current) => rows.some((row) => row.id === current) ? current : (rows[0]?.id || ""));
    setLoading(false);
  }

  function changeLoan(nextId: string) {
    setLoanId(nextId);
    setSelected("");
    window.history.replaceState({}, "", `/loan-forms?loanId=${encodeURIComponent(nextId)}`);
  }

  const doc = useMemo(() => docs.find((d) => d.id === selected) || docs[0], [docs, selected]);

  async function acknowledge() {
    if (!supabase || !doc) return;
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("generated_loan_documents")
      .update({ status: "reviewed", acknowledged_at: now, updated_at: now })
      .eq("id", doc.id);
    if (updateError) { setError(updateError.message); return; }
    await loadDocuments(loanId);
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl p-4 sm:p-6">
        <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Draft closing forms:</strong> State-specific security instruments and disclosures must be reviewed by qualified counsel before production use.
        </div>

        {!!loans.length && (
          <div className="mb-5 rounded-2xl border bg-white p-4 shadow-sm">
            <label htmlFor="loan-form-selector" className="block text-sm font-black text-slate-900">Select loan closing package</label>
            <select
              id="loan-form-selector"
              value={loanId}
              onChange={(event) => changeLoan(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900"
            >
              {loans.map((loan) => (
                <option key={loan.id} value={loan.id}>
                  Loan #{loan.loan_number ?? loan.id} — {loan.business_name || "Land-backed loan"} — {Number(loan.loan_amount || 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
                </option>
              ))}
            </select>
          </div>
        )}

        {loading ? <p>Loading forms…</p> : error ? (
          <p className="rounded-xl bg-rose-50 p-4 text-rose-700">{error}</p>
        ) : !docs.length ? (
          <div className="rounded-2xl border bg-white p-8 text-center">
            <h2 className="text-xl font-black">Forms are not ready yet</h2>
            <p className="mt-2 text-slate-600">Ask the administrator to approve this loan again after installing the document-delivery update.</p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
            <aside className="rounded-2xl border bg-white p-3 shadow-sm">
              {docs.map((d) => (
                <button key={d.id} onClick={() => setSelected(d.id)} className={`mb-2 w-full rounded-xl p-3 text-left ${selected === d.id ? "bg-emerald-900 text-white" : "bg-slate-50 hover:bg-slate-100"}`}>
                  <span className="block font-bold">{d.document_type === "deed_of_trust" ? `${String(d.terms_snapshot?.state || "State")} Security Instrument` : (labels[d.document_type] || d.title)}</span>
                  <span className="text-xs opacity-75">{String(d.signed_review_status || d.status).replaceAll("_", " ")}</span>
                </button>
              ))}
            </aside>
            {doc && <DocumentView doc={doc} loanId={loanId} onAcknowledge={acknowledge} onUploaded={() => loadDocuments(loanId)} />}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function DocumentView({ doc, loanId, onAcknowledge, onUploaded }: { doc: GeneratedDocument; loanId: string; onAcknowledge: () => void; onUploaded: () => void }) {
  const t = doc.terms_snapshot || {};
  const money = (v: any) => Number(v || 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function uploadSigned(file: File) {
    if (!supabase) return;
    if (file.size > 25 * 1024 * 1024) { setUploadError("The signed document must be 25 MB or smaller."); return; }
    setUploading(true);
    setUploadError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in again.");
      const ext = file.name.split(".").pop() || "pdf";
      const path = `${user.id}/${loanId}/signed-${doc.document_type}-${Date.now()}.${ext}`;
      const { error: storageError } = await supabase.storage.from("signed-loan-documents").upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (storageError) throw storageError;
      const now = new Date().toISOString();
      const { error: updateError } = await supabase.from("generated_loan_documents").update({
        signed_storage_path: path,
        signed_uploaded_at: now,
        signed_review_status: "uploaded",
        status: "signed_uploaded",
        updated_at: now,
      }).eq("id", doc.id);
      if (updateError) {
        await supabase.storage.from("signed-loan-documents").remove([path]);
        throw updateError;
      }
      onUploaded();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Signed document upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <article className="rounded-2xl border bg-white p-5 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-5">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-700">Secured Landing</p><h1 className="mt-1 text-2xl font-black">{doc.title}</h1><p className="text-sm text-slate-500">Loan #{t.loan_number}</p></div>
        <button onClick={() => window.print()} className="rounded-lg border px-4 py-2 font-bold">Print / Save PDF</button>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2"><Field k="Borrower" v={t.borrower_name}/><Field k="Business" v={t.business_name || "Not provided"}/><Field k="Property" v={t.property_address}/><Field k="APN" v={t.apn}/><Field k="County / State" v={`${t.county || ""}, ${t.state || ""}`}/><Field k="Principal" v={money(t.approved_loan_amount)}/><Field k="Interest rate" v={`${t.borrower_interest_rate}%`}/><Field k="Term" v={`${t.repayment_term_months} months`}/><Field k="Estimated monthly payment" v={money(t.monthly_payment)}/></div>
      <div className="mt-7 rounded-xl bg-slate-50 p-5 text-sm leading-7 text-slate-700"><DocumentBody type={doc.document_type} t={t}/></div>

      <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950">
        <h2 className="font-black">Required next steps before processing</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Print and carefully review the complete document.</li>
          <li>Sign and date every required signature line.</li>
          <li>Have the document notarized whenever the document or applicable state law requires it.</li>
          <li>Scan the complete signed document, or create clear photos of every page.</li>
          <li>Upload the signed and, when required, notarized copy below.</li>
        </ol>
        <p className="mt-3 font-bold">Necessary processing and funding cannot be completed until required executed documents are uploaded, reviewed, and approved.</p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button onClick={onAcknowledge} className="rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white">I reviewed this form</button>
        {doc.acknowledged_at && <span className="font-bold text-emerald-700">✓ Reviewed {new Date(doc.acknowledged_at).toLocaleDateString()}</span>}
      </div>

      <div className="mt-5 rounded-2xl border p-5">
        <h2 className="font-black text-slate-900">Upload signed document</h2>
        <p className="mt-1 text-sm text-slate-600">Accepted: PDF, JPG, PNG, or WebP. Maximum 25 MB.</p>
        <input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadSigned(file); event.currentTarget.value = ""; }} />
        <button disabled={uploading} onClick={() => inputRef.current?.click()} className="mt-3 rounded-xl bg-slate-950 px-5 py-3 font-bold text-white disabled:opacity-50">{uploading ? "Uploading…" : doc.signed_storage_path ? "Replace signed copy" : "Upload signed copy"}</button>
        {doc.signed_storage_path && <p className="mt-3 font-bold text-emerald-700">✓ Signed copy uploaded — {String(doc.signed_review_status || "uploaded").replaceAll("_", " ")}</p>}
        {uploadError && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{uploadError}</p>}
      </div>
    </article>
  );
}

function Field({ k, v }: { k: string; v: any }) { return <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{k}</p><p className="mt-1 font-bold text-slate-900">{v || "Not provided"}</p></div>; }
function DocumentBody({ type, t }: { type: string; t: Record<string, any> }) {
  if (type === "promissory_note") return <PromissoryNoteDocument terms={t}/>;
  if (type === "deed_of_trust") return <><h2 className="font-black">Security Instrument Draft</h2><p>The property identified above is intended to secure repayment of the loan. The final security instrument must contain the complete legal description, secured-party or trustee information, recording language, and all provisions required by the state where the property is located.</p><p className="font-bold text-amber-800">State-specific attorney review and any required notarization are required before recording.</p></>;
  if (type === "payment_schedule") return <><h2 className="font-black">Payment Summary</h2><p>Estimated monthly payment: {Number(t.monthly_payment || 0).toLocaleString(undefined, { style: "currency", currency: "USD" })}. Final dates and amounts will be established at closing.</p></>;
  if (type === "borrower_certification") return <><h2 className="font-black">Borrower Certification</h2><p>The borrower certifies that application, ownership, property, and financial information supplied to Secured Landing is accurate and complete, subject to final verification.</p></>;
  if (type === "esign_consent") return <><h2 className="font-black">Electronic Records Consent</h2><p>The borrower consents to receive, review, and sign permitted records electronically and may request paper copies where applicable.</p></>;
  return <><h2 className="font-black">Closing Summary</h2><p>This form summarizes the approved principal, rate, term, collateral, and next steps. Funding remains subject to final documentation, signatures, verification, investor funding, and authorization.</p></>;
}
