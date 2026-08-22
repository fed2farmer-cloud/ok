import { useCallback, useEffect, useState } from "react";
import AppLayout from "../components/AppLayout";
import { supabase } from "../lib/supabase";

type Row = {
  id: string; loan_number: number; borrower_user_id: string | null; funding_goal: number | string;
  sold_amount: number | string; protected_amount: number | string; releasable_amount: number | string;
  status: string; processor: string | null; processor_reference: string | null; approved_at: string | null; released_at: string | null;
};
const money=(v:number|string|null|undefined)=>Number(v||0).toLocaleString(undefined,{style:"currency",currency:"USD"});

export default function AdminFundingDisbursement(){
  const [rows,setRows]=useState<Row[]>([]); const [message,setMessage]=useState(""); const [busy,setBusy]=useState<number|null>(null);
  const load=useCallback(async()=>{ if(!supabase)return; const {data,error}=await supabase.from("loan_funding_disbursements").select("*").order("updated_at",{ascending:false}); if(error)setMessage(error.message); else setRows((data||[]) as Row[]); },[]);
  useEffect(()=>{void load();},[load]);
  async function rpc(name:string,loan:number,args:Record<string,unknown>={}){ if(!supabase)return; setBusy(loan); setMessage(""); const {error}=await supabase.rpc(name,{p_loan_number:loan,...args}); setBusy(null); if(error)setMessage(error.message); else {setMessage(`${name.replaceAll("_"," ")} completed for Loan #${loan}.`); await load();}}
  async function release(loan:number){ const processor=window.prompt("Processor / bank rail used for borrower payout (example: ACH / NMI / manual bank):","ACH"); if(!processor)return; const ref=window.prompt("Enter the payout/transfer reference. Do not record a release until the external payout was actually initiated or confirmed."); if(!ref)return; await rpc("release_funding_disbursement_v1",loan,{p_processor:processor,p_processor_reference:ref}); }
  return <AppLayout><div className="mx-auto max-w-7xl p-6">
    <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-700">Money movement control</p>
    <h1 className="text-3xl font-black text-slate-950">Funding Disbursement</h1>
    <p className="mt-2 max-w-4xl text-slate-600">Funding must be fully sold and clear the investor-protection hold before release. Approval is internal; “Record release” requires the real external processor/bank reference and creates the repayment schedule.</p>
    {message&&<div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 font-semibold text-amber-900">{message}</div>}
    <div className="mt-6 grid gap-4">
      {rows.map(r=><section key={r.id} className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div><h2 className="text-xl font-black">Loan #{r.loan_number}</h2><p className="mt-1 text-sm text-slate-500">Status: <strong>{r.status.replaceAll("_"," ")}</strong></p></div>
        <div className="flex flex-wrap gap-2"><button disabled={busy===r.loan_number} onClick={()=>rpc("refresh_funding_disbursement_v1",r.loan_number)} className="rounded-xl border px-4 py-2 font-black">Refresh</button><button disabled={busy===r.loan_number||r.status!=="ready_for_release"} onClick={()=>rpc("approve_funding_disbursement_v1",r.loan_number)} className="rounded-xl bg-emerald-700 px-4 py-2 font-black text-white disabled:opacity-40">Approve</button><button disabled={busy===r.loan_number||r.status!=="approved"} onClick={()=>release(r.loan_number)} className="rounded-xl bg-slate-950 px-4 py-2 font-black text-white disabled:opacity-40">Record release</button></div></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-4"><Stat label="Funding goal" value={money(r.funding_goal)}/><Stat label="Sold" value={money(r.sold_amount)}/><Stat label="Protection hold" value={money(r.protected_amount)}/><Stat label="Releasable" value={money(r.releasable_amount)}/></div>
        {(r.processor_reference||r.released_at)&&<p className="mt-4 text-sm text-slate-600">Release: {r.processor||"—"} · {r.processor_reference||"—"} · {r.released_at?.slice(0,10)||"—"}</p>}
      </section>)}
      {rows.length===0&&<div className="rounded-2xl border bg-white p-6 text-slate-500">No disbursement records yet. Fully committed loans will appear after the v4.3.0 migration refreshes them.</div>}
    </div>
  </div></AppLayout>;
}
function Stat({label,value}:{label:string;value:string}){return <div className="rounded-xl bg-slate-100 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>}
