import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import FundingCountdown from "../components/FundingCountdown";
import { supabase } from "../lib/supabase";

type Campaign = { business_name?: string | null; borrower_name?: string | null; loan_number?: number | null; funding_goal?: number | null; amount_funded?: number | null; amount_remaining?: number | null; funding_deadline?: string | null; investor_count?: number | null; status?: string | null };

export default function FundingCampaign() {
  const [params] = useSearchParams();
  const loanId = params.get("loanId") || "";
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      if (!supabase || !loanId) return;
      const { data, error: loadError } = await supabase.from("marketplace_loans").select("*").eq("loan_application_id", Number(loanId)).maybeSingle();
      if (loadError) setError(loadError.message); else setCampaign(data as Campaign | null);
    }
    void load();
  }, [loanId]);

  return <AppLayout><main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
    <section className="rounded-3xl bg-slate-950 p-7 text-white shadow-2xl sm:p-10">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Funding campaign</p>
      <h1 className="mt-3 text-3xl font-black">{campaign?.business_name || "Land-backed opportunity"}</h1>
      <p className="mt-2 text-slate-300">Loan #{campaign?.loan_number ?? loanId} · {campaign?.investor_count || 0} participating investors</p>
    </section>
    {error && <p className="mt-5 rounded-xl bg-rose-50 p-4 text-rose-700">{error}</p>}
    <div className="mt-6"><FundingCountdown deadline={campaign?.funding_deadline} funded={Number(campaign?.amount_funded || 0)} goal={Number(campaign?.funding_goal || 0)} /></div>
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black text-slate-950">Campaign status</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Funded" value={Number(campaign?.amount_funded || 0)} />
        <Metric label="Remaining" value={Number(campaign?.amount_remaining || 0)} />
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-500">Status</p><p className="mt-1 text-xl font-black capitalize text-slate-900">{campaign?.status || "Open"}</p></div>
      </div>
    </section>
  </main></AppLayout>;
}
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 text-xl font-black text-slate-900">{value.toLocaleString(undefined,{style:"currency",currency:"USD",maximumFractionDigits:0})}</p></div>; }
