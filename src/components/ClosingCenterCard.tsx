import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import VideoUpload from "./VideoUpload";

type Task = { id: string; task_key: string; title: string; status: string; sort_order: number };
type Closing = { id: string; stage: string; progress_percent: number; monthly_payment: number | null; borrower_interest_rate: number | null; repayment_term_months: number | null };

type Props = {
  loanApplicationId: string;
  loanNumber: number | string;
  loanAmount: number;
  borrowerRate: number;
  termMonths: number;
  videoPath?: string | null;
  videoStatus?: string | null;
  onVideoUploaded?: () => void;
};

export default function ClosingCenterCard({ loanApplicationId, loanNumber, loanAmount, borrowerRate, termMonths, videoPath, videoStatus, onVideoUploaded }: Props) {
  const [closing, setClosing] = useState<Closing | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase) return;
      setLoading(true);
      const { data: closingData } = await supabase.from("loan_closings").select("*").eq("loan_application_id", loanApplicationId).maybeSingle();
      const { data: taskData } = await supabase.from("closing_tasks").select("*").eq("loan_application_id", loanApplicationId).order("sort_order");
      if (active) {
        setClosing((closingData as Closing | null) ?? null);
        setTasks((taskData as Task[] | null) ?? []);
        setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [loanApplicationId]);

  const monthlyPayment = useMemo(() => {
    if (closing?.monthly_payment) return Number(closing.monthly_payment);
    const monthlyRate = borrowerRate / 100 / 12;
    if (!monthlyRate) return loanAmount / Math.max(termMonths, 1);
    return (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));
  }, [borrowerRate, closing?.monthly_payment, loanAmount, termMonths]);

  const completed = tasks.filter((t) => t.status === "complete").length;
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : Number(closing?.progress_percent || 12);

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-amber-50 shadow-sm">
      <div className="border-b border-emerald-100 bg-emerald-900 px-5 py-4 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">Loan Closing Center</p>
        <h4 className="mt-1 text-xl font-black">Your loan is approved — complete the next steps</h4>
        <p className="mt-1 text-sm text-emerald-100">Loan #{loanNumber}</p>
      </div>

      <div className="p-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="Approved amount" value={loanAmount.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })} />
          <Metric label="Interest rate" value={`${borrowerRate}%`} />
          <Metric label="Term" value={`${termMonths} months`} />
          <Metric label="Est. payment" value={monthlyPayment.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 })} />
        </div>

        <div className="mt-5">
          <div className="flex justify-between text-sm font-bold text-slate-700"><span>Closing progress</span><span>{progress}%</span></div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${Math.min(progress, 100)}%` }} /></div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h5 className="font-black text-slate-900">Closing checklist</h5>
            {loading ? <p className="mt-3 text-sm text-slate-500">Loading checklist…</p> : (
              <div className="mt-3 space-y-2">
                {(tasks.length ? tasks : [
                  { id: "1", task_key: "approved", title: "Underwriting approved", status: "complete", sort_order: 1 },
                  { id: "2", task_key: "video", title: "Upload borrower introduction video", status: videoPath ? "submitted" : "pending", sort_order: 2 },
                  { id: "3", task_key: "documents", title: "Review and upload required documents", status: "pending", sort_order: 3 },
                  { id: "4", task_key: "signatures", title: "Sign closing documents", status: "pending", sort_order: 4 },
                  { id: "5", task_key: "funding", title: "Investor funding", status: "pending", sort_order: 5 },
                ]).map((task) => (
                  <div key={task.id} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-black ${task.status === "complete" ? "bg-emerald-600 text-white" : task.status === "submitted" ? "bg-amber-400 text-slate-950" : "bg-slate-200 text-slate-600"}`}>{task.status === "complete" ? "✓" : task.status === "submitted" ? "•" : "○"}</span>
                    <span className="font-semibold text-slate-700">{task.title}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => { window.location.href = `/closing-center?loanId=${loanApplicationId}`; }} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600">Open Closing Center</button>
              <button onClick={() => { window.location.href = `/loan-documents?loanId=${loanApplicationId}`; }} className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-50">Upload Supporting Documents</button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h5 className="font-black text-slate-900">Tell investors your story</h5>
            <p className="mt-1 text-sm text-slate-500">Upload a short introduction explaining your project, land use and repayment plan.</p>
            <VideoUpload loanApplicationId={loanApplicationId} existingPath={videoPath} existingStatus={videoStatus} onUploaded={() => onVideoUploaded?.()} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 font-black text-slate-950">{value}</p></div>;
}
