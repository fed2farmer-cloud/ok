import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { supabase } from "../lib/supabase";

type TaxDocument = {
  id: number;
  tax_year: number;
  form_type: string;
  title: string;
  status: string;
  storage_path: string | null;
  loan_application_id: number | null;
  investment_id: number | null;
  issued_at: string | null;
  corrected_at: string | null;
  created_at: string;
};

type TaxProfile = {
  legal_name: string | null;
  business_name: string | null;
  taxpayer_type: string | null;
  tin_last4: string | null;
  mailing_address: string | null;
  electronic_delivery_consent: boolean;
  profile_status: string | null;
};

const currentYear = new Date().getFullYear();
const statusClass: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-800",
  corrected: "bg-blue-100 text-blue-800",
  pending: "bg-amber-100 text-amber-800",
  voided: "bg-rose-100 text-rose-800",
};

export default function TaxCenter() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<TaxDocument[]>([]);
  const [profile, setProfile] = useState<TaxProfile | null>(null);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setErrorMessage("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    const [{ data: docs, error: docsError }, { data: taxProfile }] = await Promise.all([
      supabase
        .from("tax_documents")
        .select("id,tax_year,form_type,title,status,storage_path,loan_application_id,investment_id,issued_at,corrected_at,created_at")
        .eq("user_id", user.id)
        .order("tax_year", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("tax_profiles")
        .select("legal_name,business_name,taxpayer_type,tin_last4,mailing_address,electronic_delivery_consent,profile_status")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (docsError) setErrorMessage(docsError.message);
    setDocuments((docs as TaxDocument[] | null) ?? []);
    setProfile((taxProfile as TaxProfile | null) ?? null);
    setLoading(false);
  }, [navigate]);

  useEffect(() => { void load(); }, [load]);

  const years = useMemo(() => {
    const values = new Set<number>([currentYear, currentYear - 1]);
    documents.forEach((document) => values.add(document.tax_year));
    return [...values].sort((a, b) => b - a);
  }, [documents]);

  const visible = documents.filter((document) => document.tax_year === selectedYear);

  async function downloadDocument(document: TaxDocument) {
    if (!supabase || !document.storage_path) return;
    setDownloadingId(document.id);
    setErrorMessage("");
    try {
      const { data, error } = await supabase.storage
        .from("tax-documents")
        .createSignedUrl(document.storage_path, 120);
      if (error) throw error;
      if (!data?.signedUrl) throw new Error("A secure download link could not be created.");

      await supabase.from("tax_download_history").insert({
        tax_document_id: document.id,
        download_source: "tax_center",
        user_agent: navigator.userAgent,
      });
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      setErrorMessage(error?.message || "Unable to download this tax document.");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-7 text-white shadow-xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-300">Secure document vault</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Tax Center</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Download annual tax forms, interest summaries, and prior-year statements. Documents are delivered through short-lived secure links.
          </p>
        </div>

        {errorMessage && <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{errorMessage}</div>}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-950">Your tax documents</h2>
                <p className="mt-1 text-sm text-slate-500">Forms issued by SecuredLanding for the selected tax year.</p>
              </div>
              <select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-bold text-slate-800">
                {years.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </div>

            {loading ? (
              <p className="py-12 text-center text-slate-500">Loading tax documents…</p>
            ) : visible.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="font-bold text-slate-800">No tax documents are available for {selectedYear}.</p>
                <p className="mt-2 text-sm text-slate-500">Documents will appear here after they are issued by the tax administrator.</p>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {visible.map((document) => (
                  <article key={document.id} className="rounded-2xl border border-slate-200 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-slate-950">{document.form_type}</span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass[document.status] || "bg-slate-100 text-slate-700"}`}>{document.status}</span>
                      </div>
                      <p className="mt-2 font-semibold text-slate-800">{document.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Issued {document.issued_at ? new Date(document.issued_at).toLocaleDateString() : "pending"}
                        {document.loan_application_id ? ` · Loan ${document.loan_application_id}` : ""}
                      </p>
                    </div>
                    <button type="button" disabled={!document.storage_path || downloadingId === document.id} onClick={() => void downloadDocument(document)} className="mt-4 w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300 sm:mt-0 sm:w-auto">
                      {downloadingId === document.id ? "Preparing…" : "Download PDF"}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-5">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">Tax profile</h2>
              <p className="mt-2 text-sm text-slate-500">Only the final four digits of your taxpayer ID are displayed.</p>
              <dl className="mt-5 space-y-3 text-sm">
                <div><dt className="font-bold text-slate-500">Name</dt><dd className="mt-1 text-slate-900">{profile?.legal_name || "Not completed"}</dd></div>
                <div><dt className="font-bold text-slate-500">Taxpayer ID</dt><dd className="mt-1 text-slate-900">{profile?.tin_last4 ? `•••-••-${profile.tin_last4}` : "Not provided"}</dd></div>
                <div><dt className="font-bold text-slate-500">Delivery</dt><dd className="mt-1 text-slate-900">{profile?.electronic_delivery_consent ? "Electronic delivery enabled" : "Consent not recorded"}</dd></div>
              </dl>
            </section>

            <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
              <h2 className="font-black text-amber-950">Important</h2>
              <p className="mt-2 text-sm leading-6 text-amber-900/80">Tax documents are provided for recordkeeping. Consult a qualified tax professional about deductibility, reporting, or filing requirements.</p>
            </section>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}
