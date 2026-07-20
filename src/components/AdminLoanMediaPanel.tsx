import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Photo = {
  id: string;
  loan_application_id: string | number;
  storage_path: string;
  caption: string | null;
  review_status: string | null;
  is_cover?: boolean | null;
  is_cover_photo?: boolean | null;
  admin_notes?: string | null;
  signed_url?: string;
};

export default function AdminLoanMediaPanel({ loanApplicationId }: { loanApplicationId: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("admin_list_property_photos");
    if (rpcError) {
      setError(rpcError.message);
      setLoading(false);
      return;
    }
    const matching = ((data ?? []) as Photo[]).filter((p) => String(p.loan_application_id) === String(loanApplicationId));
    const hydrated = await Promise.all(matching.map(async (photo) => {
      const { data: signed } = await supabase.storage.from("property-photos").createSignedUrl(photo.storage_path, 900);
      return { ...photo, signed_url: signed?.signedUrl || "" };
    }));
    hydrated.sort((a, b) => Number(Boolean(b.is_cover_photo ?? b.is_cover)) - Number(Boolean(a.is_cover_photo ?? a.is_cover)));
    setPhotos(hydrated);
    setLoading(false);
  }, [loanApplicationId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <p className="mt-4 text-sm text-slate-500">Loading property photos…</p>;
  if (error) return <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>;
  if (photos.length === 0) return <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500">No property photos are linked to this loan.</p>;

  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-black text-slate-900">{photos.length} linked photo{photos.length === 1 ? "" : "s"}</p>
        <button type="button" onClick={() => void load()} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold">Refresh</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((photo) => (
          <article key={photo.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {photo.signed_url ? <img src={photo.signed_url} alt={photo.caption || "Property"} className="h-40 w-full object-cover" /> : <div className="grid h-40 place-items-center text-sm text-slate-500">Photo unavailable</div>}
            <div className="p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-bold text-slate-900">{photo.caption || "No caption"}</p>
                <span className="rounded-full bg-violet-100 px-2 py-1 text-[11px] font-black capitalize text-violet-800">{String(photo.review_status || "pending").replace(/_/g, " ")}</span>
              </div>
              {(photo.is_cover_photo ?? photo.is_cover) && <p className="mt-2 text-xs font-black uppercase tracking-wide text-emerald-700">Cover photo</p>}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
