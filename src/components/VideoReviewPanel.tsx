import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type VideoReviewStatus = "submitted" | "approved" | "rejected" | "more_information";

type Props = {
  applicationId: string | number;
  storagePath: string;
  status?: string | null;
  existingNotes?: string | null;
  onReviewed?: () => void | Promise<void>;
};

export default function VideoReviewPanel({ applicationId, storagePath, status, existingNotes, onReviewed }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState(existingNotes ?? "");
  const [saving, setSaving] = useState<VideoReviewStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase || !storagePath) return;
      const { data, error } = await supabase.storage.from("borrower-videos").createSignedUrl(storagePath, 3600);
      if (!active) return;
      if (error) setError(error.message);
      else setUrl(data?.signedUrl ?? null);
    }
    void load();
    return () => { active = false; };
  }, [storagePath]);

  async function review(nextStatus: VideoReviewStatus) {
    if (!supabase) return;
    setSaving(nextStatus);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    const update = {
      borrower_video_status: nextStatus,
      borrower_video_admin_notes: notes.trim() || null,
      borrower_video_reviewed_at: new Date().toISOString(),
      borrower_video_reviewed_by: user?.id ?? null,
    };
    const { error } = await supabase.from("loan_applications").update(update).eq("id", applicationId);
    setSaving(null);
    if (error) { setError(error.message); return; }
    await onReviewed?.();
  }

  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-black text-slate-950">Borrower video review</h3>
          <p className="text-sm text-slate-600">Status: <span className="font-bold capitalize">{String(status || "submitted").replace(/_/g, " ")}</span></p>
        </div>
      </div>
      {url ? <video src={url} controls preload="metadata" className="mt-4 max-h-[520px] w-full rounded-xl bg-black" /> : <p className="mt-4 text-sm text-slate-500">Loading borrower video…</p>}
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Notes sent to the borrower" className="mt-4 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm" />
      {error && <p className="mt-2 text-sm font-semibold text-rose-700">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={Boolean(saving)} onClick={() => void review("approved")} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving === "approved" ? "Approving…" : "Approve Video"}</button>
        <button type="button" disabled={Boolean(saving)} onClick={() => void review("more_information")} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Request New Video</button>
        <button type="button" disabled={Boolean(saving)} onClick={() => void review("rejected")} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Reject Video</button>
      </div>
    </section>
  );
}
