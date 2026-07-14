import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type GeneratedDocument = { id: string | number; title?: string | null; document_name?: string | null; document_type?: string | null; status?: string | null; storage_path?: string | null; created_at?: string | null };

export default function GeneratedDocumentsPanel({ applicationId }: { applicationId: string | number }) {
  const [rows, setRows] = useState<GeneratedDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    if (!supabase) return;
    setLoading(true); setError("");
    const { data, error } = await supabase.from("generated_loan_documents").select("id,title,document_name,document_type,status,storage_path,created_at").eq("loan_application_id", applicationId).order("created_at", { ascending: false });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setRows((data as GeneratedDocument[]) ?? []);
  }

  useEffect(() => { void refresh(); }, [applicationId]);

  async function open(row: GeneratedDocument) {
    if (!supabase || !row.storage_path) return;
    const { data, error } = await supabase.storage.from("loan-documents").createSignedUrl(row.storage_path, 3600);
    if (error) { setError(error.message); return; }
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex items-center justify-between gap-3"><div><h3 className="text-lg font-black text-slate-950">Generated loan documents</h3><p className="text-sm text-slate-600">{rows.length} generated file{rows.length === 1 ? "" : "s"}</p></div><button type="button" onClick={() => void refresh()} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white">{loading ? "Refreshing…" : "Refresh generated"}</button></div>
    {error && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
    <div className="mt-3 space-y-2">{rows.map((row) => <div key={String(row.id)} className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><div><p className="font-bold text-slate-900">{row.title || row.document_name || row.document_type || "Loan document"}</p><p className="text-xs uppercase text-slate-500">{row.status || "generated"}</p></div>{row.storage_path && <button type="button" onClick={() => void open(row)} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white">View</button>}</div>)}</div>
  </section>;
}
