import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type ReviewStatus = "submitted" | "under_review" | "approved" | "more_information" | "rejected";

type KYCSubmission = {
  id: string;
  user_id: string;
  full_legal_name: string | null;
  date_of_birth: string | null;
  ssn_last4: string | null;
  address: string | null;
  id_type: string | null;
  id_doc_path: string | null;
  selfie_path: string | null;
  status: string | null;
  admin_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export default function AdminKYCReview() {
  const [rows, setRows] = useState<KYCSubmission[]>([]);
  const [urls, setUrls] = useState<Record<string, { id?: string; selfie?: string }>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("kyc_submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }

    const submissions = (data ?? []) as KYCSubmission[];
    setRows(submissions);
    setNotes(Object.fromEntries(submissions.map((row) => [row.id, row.admin_notes ?? ""])));

    const nextUrls: Record<string, { id?: string; selfie?: string }> = {};
    await Promise.all(
      submissions.map(async (row) => {
        const entry: { id?: string; selfie?: string } = {};
        if (row.id_doc_path) {
          const { data } = await supabase.storage.from("kyc-documents").createSignedUrl(row.id_doc_path, 900);
          entry.id = data?.signedUrl;
        }
        if (row.selfie_path) {
          const { data } = await supabase.storage.from("kyc-documents").createSignedUrl(row.selfie_path, 900);
          entry.selfie = data?.signedUrl;
        }
        nextUrls[row.id] = entry;
      })
    );
    setUrls(nextUrls);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function review(row: KYCSubmission, status: ReviewStatus) {
    if (!supabase) return;
    setSaving(row.id);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: updateError } = await supabase
        .from("kyc_submissions")
        .update({
          status,
          admin_notes: notes[row.id]?.trim() || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id ?? null,
        })
        .eq("id", row.id);
      if (updateError) throw updateError;
      await load();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "KYC review could not be saved.");
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">Loading private KYC/AML queue…</section>;

  return (
    <section className="mt-6 rounded-3xl border border-violet-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Private compliance queue</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">KYC / AML identity review</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">Government IDs, selfies, birth dates and SSN last four are restricted to authorized administrators. They are never exposed to investors.</p>
        </div>
        <button onClick={() => void load()} className="rounded-xl border border-violet-200 px-4 py-2 text-sm font-bold text-violet-800 hover:bg-violet-50">Refresh KYC</button>
      </div>

      {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div>}

      {rows.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">No KYC/AML submissions are waiting for review.</p>
      ) : (
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          {rows.map((row) => (
            <article key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-slate-950">{row.full_legal_name || "Unnamed applicant"}</h3>
                  <p className="mt-1 text-xs text-slate-500">Submitted {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}</p>
                </div>
                <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black capitalize text-violet-800">{String(row.status || "submitted").replace(/_/g, " ")}</span>
              </div>

              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="font-bold text-slate-500">Date of birth</dt><dd className="text-slate-900">{row.date_of_birth || "—"}</dd></div>
                <div><dt className="font-bold text-slate-500">SSN</dt><dd className="text-slate-900">•••-••-{row.ssn_last4 || "••••"}</dd></div>
                <div><dt className="font-bold text-slate-500">ID type</dt><dd className="capitalize text-slate-900">{String(row.id_type || "—").replace(/_/g, " ")}</dd></div>
                <div><dt className="font-bold text-slate-500">Address</dt><dd className="text-slate-900">{row.address || "—"}</dd></div>
              </dl>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {urls[row.id]?.id ? <a href={urls[row.id].id} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-200 bg-white p-3 text-center text-sm font-bold text-emerald-700">Open government ID</a> : <div className="rounded-xl border border-dashed border-slate-300 p-3 text-center text-sm text-slate-500">No ID uploaded</div>}
                {urls[row.id]?.selfie ? <a href={urls[row.id].selfie} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-200 bg-white p-3 text-center text-sm font-bold text-emerald-700">Open verification selfie</a> : <div className="rounded-xl border border-dashed border-slate-300 p-3 text-center text-sm text-slate-500">No selfie uploaded</div>}
              </div>

              <textarea value={notes[row.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))} rows={2} placeholder="Private compliance notes" className="mt-4 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm" />
              <div className="mt-3 flex flex-wrap gap-2">
                <button disabled={saving === row.id} onClick={() => void review(row, "approved")} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Approve KYC</button>
                <button disabled={saving === row.id} onClick={() => void review(row, "more_information")} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Request Information</button>
                <button disabled={saving === row.id} onClick={() => void review(row, "rejected")} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Reject</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
