import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type PropertyPhoto = {
  id: string;
  loan_application_id: string;
  user_id: string;
  storage_path: string;
  caption: string | null;
  is_cover: boolean | null;
  review_status: string | null;
  admin_notes: string | null;
  created_at: string | null;
  signed_url?: string;
};

export default function AdminPropertyPhotoReview() {
  const [rows, setRows] = useState<PropertyPhoto[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("property_photos")
      .select("id,loan_application_id,user_id,storage_path,caption,is_cover,review_status,admin_notes,created_at")
      .order("created_at", { ascending: false });
    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }
    const photos = (data as PropertyPhoto[] | null) || [];
    const hydrated = await Promise.all(photos.map(async (photo) => {
      const { data: signed } = await supabase!.storage.from("property-photos").createSignedUrl(photo.storage_path, 900);
      return { ...photo, signed_url: signed?.signedUrl || "" };
    }));
    setRows(hydrated);
    setNotes(Object.fromEntries(hydrated.map((row) => [row.id, row.admin_notes || ""])));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function review(photo: PropertyPhoto, status: "approved" | "more_information" | "rejected") {
    if (!supabase) return;
    setSaving(photo.id);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: updateError } = await supabase.from("property_photos").update({
        review_status: status,
        admin_notes: notes[photo.id]?.trim() || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id ?? null,
      }).eq("id", photo.id);
      if (updateError) throw updateError;
      await load();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Photo review could not be saved.");
    } finally {
      setSaving(null);
    }
  }

  async function setCover(photo: PropertyPhoto) {
    if (!supabase) return;
    setSaving(photo.id);
    try {
      await supabase.from("property_photos").update({ is_cover: false }).eq("loan_application_id", photo.loan_application_id);
      const { error: coverError } = await supabase.from("property_photos").update({ is_cover: true }).eq("id", photo.id);
      if (coverError) throw coverError;
      await load();
    } catch (coverError) {
      setError(coverError instanceof Error ? coverError.message : "Cover photo could not be saved.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Property media queue</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">Property photos awaiting review</h2>
          <p className="mt-1 text-sm text-slate-600">Approve photos before they are displayed to investors.</p>
        </div>
        <button onClick={() => void load()} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold">Refresh</button>
      </div>
      {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
      {loading ? <p className="mt-4 text-sm text-slate-500">Loading property photos…</p> : rows.length === 0 ? (
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">No property photos have been uploaded.</p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((photo) => (
            <article key={photo.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {photo.signed_url ? <img src={photo.signed_url} alt={photo.caption || "Property"} className="h-48 w-full object-cover" /> : <div className="flex h-48 items-center justify-center text-slate-500">Photo unavailable</div>}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div><p className="text-xs font-black uppercase text-emerald-700">Loan {photo.loan_application_id}</p><p className="mt-1 text-sm font-bold text-slate-900">{photo.caption || "No caption"}</p></div>
                  <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black capitalize text-violet-800">{String(photo.review_status || "submitted").replace(/_/g, " ")}</span>
                </div>
                <textarea rows={2} value={notes[photo.id] || ""} onChange={(e) => setNotes((current) => ({ ...current, [photo.id]: e.target.value }))} placeholder="Admin notes" className="mt-3 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm" />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button disabled={saving === photo.id} onClick={() => void review(photo, "approved")} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Approve</button>
                  <button disabled={saving === photo.id} onClick={() => void review(photo, "more_information")} className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Replace</button>
                  <button disabled={saving === photo.id} onClick={() => void review(photo, "rejected")} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Reject</button>
                  <button disabled={saving === photo.id || photo.review_status !== "approved"} onClick={() => void setCover(photo)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold disabled:opacity-40">{photo.is_cover ? "Cover photo" : "Set cover"}</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
