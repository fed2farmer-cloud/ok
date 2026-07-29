import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { supabase } from "../lib/supabase";

type TaxDocument = {
  id: number;
  user_id: string;
  recipient_role: string;
  tax_year: number;
  form_type: string;
  title: string;
  status: string;
  storage_path: string | null;
  issued_at: string | null;
  created_at: string;
};

export default function AdminTaxDashboard() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<TaxDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [form, setForm] = useState({ userId: "", role: "borrower", year: String(new Date().getFullYear()), formType: "Annual Interest Statement", title: "", status: "available" });
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login", { replace: true }); return; }
    const { data: admin } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!admin) { navigate("/", { replace: true }); return; }
    const { data, error } = await supabase.from("tax_documents").select("id,user_id,recipient_role,tax_year,form_type,title,status,storage_path,issued_at,created_at").order("created_at", { ascending: false }).limit(250);
    if (error) setErrorMessage(error.message);
    setDocuments((data as TaxDocument[] | null) ?? []);
    setLoading(false);
  }, [navigate]);

  useEffect(() => { void load(); }, [load]);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !file) return;
    setSaving(true); setMessage(""); setErrorMessage("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Admin session expired.");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `${form.userId}/${form.year}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("tax-documents").upload(path, file, { contentType: file.type || "application/pdf", upsert: false });
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from("tax_documents").insert({
        user_id: form.userId.trim(), recipient_role: form.role, tax_year: Number(form.year), form_type: form.formType.trim(), title: form.title.trim() || form.formType.trim(), status: form.status, storage_path: path, issued_at: form.status === "available" ? new Date().toISOString() : null, created_by: user.id,
      });
      if (insertError) throw insertError;
      setMessage("Tax document uploaded and assigned successfully.");
      setFile(null); setForm((current) => ({ ...current, userId: "", title: "" }));
      await load();
    } catch (error: any) {
      setErrorMessage(error?.message || "Unable to upload the tax document.");
    } finally { setSaving(false); }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="rounded-3xl bg-slate-950 p-7 text-white shadow-xl"><p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">Administration</p><h1 className="mt-2 text-3xl font-black">Tax Reporting Center</h1><p className="mt-2 text-sm text-slate-300">Upload issued forms, assign recipients, manage corrections, and review delivery status.</p></div>
        {message && <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{message}</div>}
        {errorMessage && <div className="mt-5 rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-800">{errorMessage}</div>}
        <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
          <form onSubmit={upload} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">Issue a tax document</h2>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-bold">Recipient user UUID<input required value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal" /></label>
              <div className="grid grid-cols-2 gap-3"><label className="text-sm font-bold">Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal"><option value="borrower">Borrower</option><option value="investor">Investor</option></select></label><label className="text-sm font-bold">Tax year<input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal" /></label></div>
              <label className="block text-sm font-bold">Form type<input required value={form.formType} onChange={(e) => setForm({ ...form, formType: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal" /></label>
              <label className="block text-sm font-bold">Document title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal" /></label>
              <label className="block text-sm font-bold">Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal"><option value="available">Available</option><option value="pending">Pending</option><option value="corrected">Corrected</option></select></label>
              <label className="block text-sm font-bold">PDF file<input required type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-2 block w-full text-sm" /></label>
              <button disabled={saving || !file} className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-black text-white disabled:bg-slate-300">{saving ? "Uploading…" : "Upload and issue"}</button>
            </div>
          </form>
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">Issued documents</h2>
            {loading ? <p className="py-10 text-slate-500">Loading…</p> : <div className="mt-5 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">Year</th><th className="px-3 py-3">Recipient</th><th className="px-3 py-3">Form</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Issued</th></tr></thead><tbody>{documents.map((doc) => <tr key={doc.id} className="border-b border-slate-100"><td className="px-3 py-4 font-bold">{doc.tax_year}</td><td className="max-w-[180px] truncate px-3 py-4">{doc.user_id}</td><td className="px-3 py-4"><div className="font-semibold">{doc.form_type}</div><div className="text-xs text-slate-500">{doc.recipient_role}</div></td><td className="px-3 py-4 capitalize">{doc.status}</td><td className="px-3 py-4">{doc.issued_at ? new Date(doc.issued_at).toLocaleDateString() : "—"}</td></tr>)}</tbody></table></div>}
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
