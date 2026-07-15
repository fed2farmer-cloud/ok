import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import ClosingChecklist from "../components/ClosingChecklist";
import FundingCountdown from "../components/FundingCountdown";
import { supabase } from "../lib/supabase";

type Application = { id: string; loan_number?: number | null; business_name?: string | null; full_name?: string | null; loan_amount?: number | null; status?: string | null };
type Closing = { id: string; stage?: string | null; progress_percent?: number | null; funding_deadline?: string | null; closing_status?: string | null };
type Task = { id: string; title: string; status?: string | null; sort_order?: number | null };
type GeneratedDocument = { id: string | number; title?: string | null; document_name?: string | null; document_type?: string | null; status?: string | null; acknowledged_at?: string | null; signed_at?: string | null; storage_path?: string | null };
type Market = { funding_goal?: number | null; amount_funded?: number | null; funding_deadline?: string | null };

export default function ClosingCenter() {
  const [params] = useSearchParams();
  const loanId = params.get("loanId") || "";
  const [application, setApplication] = useState<Application | null>(null);
  const [closing, setClosing] = useState<Closing | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!supabase || !loanId) return;
    setLoading(true); setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      const [applicationResult, closingResult, taskResult, documentResult, marketResult] = await Promise.all([
        supabase.from("loan_applications").select("id,loan_number,business_name,full_name,loan_amount,status,user_id").eq("id", Number(loanId)).eq("user_id", user.id).single(),
        supabase.from("loan_closings").select("*").eq("loan_application_id", Number(loanId)).maybeSingle(),
        supabase.from("closing_tasks").select("id,title,status,sort_order").eq("loan_application_id", Number(loanId)).order("sort_order"),
        supabase.from("generated_loan_documents").select("id,title,document_name,document_type,status,acknowledged_at,signed_at,storage_path").eq("loan_application_id", Number(loanId)).order("created_at"),
        supabase.from("marketplace_loans").select("funding_goal,amount_funded,funding_deadline").eq("loan_application_id", Number(loanId)).maybeSingle(),
      ]);
      if (applicationResult.error) throw applicationResult.error;
      setApplication(applicationResult.data as Application);
      setClosing((closingResult.data as Closing | null) || null);
      setTasks((taskResult.data as Task[] | null) || []);
      setDocuments((documentResult.data as GeneratedDocument[] | null) || []);
      setMarket((marketResult.data as Market | null) || null);
    } catch (e: any) { setError(e?.message || "Unable to load the Closing Center."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [loanId]);

  const completedDocuments = useMemo(() => documents.filter((doc) => ["accepted", "signed", "completed"].includes(String(doc.status || "").toLowerCase())).length, [documents]);

  if (!loanId) return <AppLayout><div className="mx-auto max-w-4xl p-6 text-white">Choose a loan from your borrower dashboard.</div></AppLayout>;

  return (
    <AppLayout>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-7 text-white shadow-2xl sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">Borrower Closing Center</p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">{application?.business_name || application?.full_name || "Your approved loan"}</h1>
          <p className="mt-2 text-slate-300">Loan #{application?.loan_number ?? loanId} · {application?.status || "Approved"}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={() => window.location.href = `/loan-forms?loanId=${loanId}`} className="rounded-xl bg-emerald-600 px-5 py-3 font-bold hover:bg-emerald-500">Review signing documents</button>
            <button onClick={() => window.location.href = `/loan-documents?loanId=${loanId}`} className="rounded-xl bg-white/10 px-5 py-3 font-bold hover:bg-white/20">Upload supporting documents</button>
          </div>
        </section>

        {error && <div className="mt-5 rounded-xl border border-rose-300 bg-rose-50 p-4 font-semibold text-rose-700">{error}</div>}
        {loading ? <p className="mt-6 text-slate-400">Loading closing information…</p> : (
          <>
            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <ClosingChecklist tasks={tasks} />
              <FundingCountdown deadline={market?.funding_deadline || closing?.funding_deadline} funded={Number(market?.amount_funded || 0)} goal={Number(market?.funding_goal || application?.loan_amount || 0)} />
            </div>

            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Signing documents</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">{completedDocuments} of {documents.length} completed</h2>
                </div>
                <button onClick={() => window.location.href = `/loan-forms?loanId=${loanId}`} className="rounded-xl bg-slate-950 px-4 py-2 font-bold text-white">Open document center</button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {documents.length ? documents.map((doc) => (
                  <article key={String(doc.id)} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="font-black text-slate-900">{doc.title || doc.document_name || doc.document_type || "Closing document"}</h3>
                    <p className="mt-1 text-sm capitalize text-slate-500">{String(doc.status || "ready for review").replaceAll("_", " ")}</p>
                    <button onClick={() => window.location.href = `/loan-forms?loanId=${loanId}`} className="mt-3 text-sm font-bold text-emerald-700">Review document →</button>
                  </article>
                )) : <p className="text-sm text-slate-500">No closing documents have been generated yet. Contact the administrator if the loan is already approved.</p>}
              </div>
            </section>

            <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
              <strong>Important:</strong> This in-app acknowledgement workflow is a platform prototype. State-specific loan instruments and legally binding electronic signatures must be reviewed by qualified counsel and may require an approved e-signature provider.
            </div>
          </>
        )}
      </main>
    </AppLayout>
  );
}
