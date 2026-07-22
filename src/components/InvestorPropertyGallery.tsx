import { useEffect, useMemo, useState } from "react";

export type InvestorPropertyPhoto = {
  id: string;
  loan_application_id: string | number;
  storage_path: string;
  caption?: string | null;
  is_cover?: boolean | null;
  created_at?: string | null;
  signed_url: string;
};

type Props = { photos: InvestorPropertyPhoto[]; loanLabel: string };

export default function InvestorPropertyGallery({ photos, loanLabel }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [failedIds, setFailedIds] = useState<Record<string, boolean>>({});

  const ordered = useMemo(
    () =>
      [...photos]
        .filter((photo) => Boolean(photo.signed_url) && !failedIds[photo.id])
        .sort((a, b) => Number(Boolean(b.is_cover)) - Number(Boolean(a.is_cover))),
    [photos, failedIds],
  );

  useEffect(() => {
    if (selectedId && !ordered.some((photo) => photo.id === selectedId)) setSelectedId(null);
  }, [ordered, selectedId]);

  const selected = ordered.find((photo) => photo.id === selectedId) ?? ordered[0] ?? null;
  if (!selected) return null;

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-emerald-900/50 bg-slate-950">
      <div className="relative bg-black">
        <img
          src={selected.signed_url}
          alt={selected.caption || `${loanLabel} property`}
          className="h-64 w-full object-cover sm:h-80"
          loading="lazy"
          onError={() => setFailedIds((current) => ({ ...current, [selected.id]: true }))}
        />
        {selected.is_cover && (
          <span className="absolute left-3 top-3 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
            Cover photo
          </span>
        )}
      </div>
      {ordered.length > 1 && (
        <div className="flex gap-3 overflow-x-auto p-3">
          {ordered.map((photo) => (
            <button key={photo.id} type="button" onClick={() => setSelectedId(photo.id)} className="shrink-0 overflow-hidden rounded-xl border-2 border-emerald-500/40">
              <img src={photo.signed_url} alt={photo.caption || "Property photo"} className="h-20 w-28 object-cover" onError={() => setFailedIds((current) => ({ ...current, [photo.id]: true }))} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
