import { useEffect, useMemo, useState } from "react";
import AppLayout from "../components/AppLayout";
import { supabase } from "../lib/supabase";
import PromissoryNoteDocument from "../components/PromissoryNoteDocument";

type GeneratedDocument = { id:string; document_type:string; title:string; status:string; terms_snapshot:Record<string, any>; acknowledged_at?:string|null };

const labels: Record<string,string> = {
  promissory_note: "Promissory Note",
  deed_of_trust: "Security Instrument",
  payment_schedule: "Payment Schedule",
  borrower_certification: "Borrower Certification",
  esign_consent: "Electronic Signature Consent",
  closing_summary: "Closing Summary",
};

export default function LoanForms(){
  const requestedLoanId = new URLSearchParams(window.location.search).get("loanId") || "";
  const [loanId, setLoanId] = useState(requestedLoanId);
  const [docs,setDocs]=useState<GeneratedDocument[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [selected,setSelected]=useState<string>("");

  useEffect(()=>{ void load(); },[loanId]);
  async function load(){
    if(!supabase){ setError("Supabase is not configured."); setLoading(false); return; }
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){ window.location.href="/login"; return; }

    let resolvedLoanId = loanId;
    if(!resolvedLoanId){
      const { data: latestLoan, error: loanError } = await supabase
        .from("loan_applications")
        .select("id")
        .eq("user_id", user.id)
        .in("status", ["Approved", "Funded", "approved", "funded"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if(loanError){ setError(loanError.message); setLoading(false); return; }
      if(!latestLoan?.id){ setError("No approved loan was found for this account."); setLoading(false); return; }
      resolvedLoanId = String(latestLoan.id);
      setLoanId(resolvedLoanId);
      window.history.replaceState({}, "", `/loan-forms?loanId=${encodeURIComponent(resolvedLoanId)}`);
      return;
    }

    const {data,error}=await supabase.from("generated_loan_documents").select("*").eq("loan_application_id",resolvedLoanId).order("created_at");
    if(error){ setError(error.message); setLoading(false); return; }
    const rows=(data as GeneratedDocument[]|null)||[]; setDocs(rows); setSelected(rows[0]?.id||""); setLoading(false);
  }
  const doc=useMemo(()=>docs.find(d=>d.id===selected)||docs[0],[docs,selected]);
  async function acknowledge(){ if(!supabase||!doc)return; const now=new Date().toISOString(); const {error}=await supabase.from("generated_loan_documents").update({status:"reviewed",acknowledged_at:now,updated_at:now}).eq("id",doc.id); if(error){setError(error.message);return;} await load(); }
  return <AppLayout title="Loan Forms" subtitle="Review the forms generated from your approved terms.">
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"><strong>Draft closing forms:</strong> State-specific security instruments and disclosures must be reviewed by qualified counsel before production use.</div>
      {loading?<p>Loading forms…</p>:error?<p className="rounded-xl bg-rose-50 p-4 text-rose-700">{error}</p>:!docs.length?<div className="rounded-2xl border bg-white p-8 text-center"><h2 className="text-xl font-black">Forms are not ready yet</h2><p className="mt-2 text-slate-600">Ask the administrator to approve the loan again after installing the document-delivery update.</p></div>:
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-2xl border bg-white p-3 shadow-sm">{docs.map(d=><button key={d.id} onClick={()=>setSelected(d.id)} className={`mb-2 w-full rounded-xl p-3 text-left ${selected===d.id?"bg-emerald-900 text-white":"bg-slate-50 hover:bg-slate-100"}`}><span className="block font-bold">{d.document_type === "deed_of_trust" ? `${String(d.terms_snapshot?.state || "State")} Security Instrument` : (labels[d.document_type]||d.title)}</span><span className="text-xs opacity-75">{d.status.replaceAll("_"," ")}</span></button>)}</aside>
        {doc&&<DocumentView doc={doc} onAcknowledge={acknowledge}/>} 
      </div>}
    </div>
  </AppLayout>;
}

function DocumentView({doc,onAcknowledge}:{doc:GeneratedDocument;onAcknowledge:()=>void}){
  const t=doc.terms_snapshot||{}; const money=(v:any)=>Number(v||0).toLocaleString(undefined,{style:"currency",currency:"USD"});
  return <article className="rounded-2xl border bg-white p-5 shadow-sm sm:p-8">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-5"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-700">Secured Landing</p><h1 className="mt-1 text-2xl font-black">{doc.title}</h1><p className="text-sm text-slate-500">Loan #{t.loan_number}</p></div><button onClick={()=>window.print()} className="rounded-lg border px-4 py-2 font-bold">Print / Save PDF</button></div>
    <div className="mt-6 grid gap-3 sm:grid-cols-2"><Field k="Borrower" v={t.borrower_name}/><Field k="Business" v={t.business_name||"Not provided"}/><Field k="Property" v={t.property_address}/><Field k="APN" v={t.apn}/><Field k="County / State" v={`${t.county||""}, ${t.state||""}`}/><Field k="Principal" v={money(t.approved_loan_amount)}/><Field k="Interest rate" v={`${t.borrower_interest_rate}%`}/><Field k="Term" v={`${t.repayment_term_months} months`}/><Field k="Estimated monthly payment" v={money(t.monthly_payment)}/></div>
    <div className="mt-7 rounded-xl bg-slate-50 p-5 text-sm leading-7 text-slate-700"><DocumentBody type={doc.document_type} t={t}/></div>
    <div className="mt-6 flex flex-wrap items-center gap-3"><button onClick={onAcknowledge} className="rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white">I reviewed this form</button>{doc.acknowledged_at&&<span className="font-bold text-emerald-700">✓ Reviewed {new Date(doc.acknowledged_at).toLocaleDateString()}</span>}</div>
  </article>
}
function Field({k,v}:{k:string;v:any}){return <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{k}</p><p className="mt-1 font-bold text-slate-900">{v||"Not provided"}</p></div>}
function DocumentBody({type,t}:{type:string;t:Record<string,any>}){
 const amount=Number(t.approved_loan_amount||0).toLocaleString(undefined,{style:"currency",currency:"USD"});
 if(type==="promissory_note") return <PromissoryNoteDocument terms={t}/>;
 if(type==="deed_of_trust") return <><h2 className="font-black">Security Instrument Draft</h2><p>The property identified above is intended to secure repayment of the loan. The final security instrument must contain the complete legal description, secured-party or trustee information, recording language, and all provisions required by the state where the property is located.</p><p className="font-bold text-amber-800">State-specific attorney review and any required notarization are required before recording.</p></>;
 if(type==="payment_schedule") return <><h2 className="font-black">Payment Summary</h2><p>Estimated monthly payment: {Number(t.monthly_payment||0).toLocaleString(undefined,{style:"currency",currency:"USD"})}. Final dates and amounts will be established at closing.</p></>;
 if(type==="borrower_certification") return <><h2 className="font-black">Borrower Certification</h2><p>The borrower certifies that application, ownership, property, and financial information supplied to Secured Landing is accurate and complete, subject to final verification.</p></>;
 if(type==="esign_consent") return <><h2 className="font-black">Electronic Records Consent</h2><p>The borrower consents to receive, review, and sign permitted records electronically and may request paper copies where applicable.</p></>;
 return <><h2 className="font-black">Closing Summary</h2><p>This form summarizes the approved principal, rate, term, collateral, and next steps. Funding remains subject to final documentation, signatures, verification, investor funding, and authorization.</p></>;
}
