import { useMemo, useState } from "react";

export type InvestorPropertyPhoto = {
  id: string;
  loan_application_id: string | number;
  storage_path: string;
  caption?: string | null;
  is_cover?: boolean | null;
  is_cover_photo?: boolean | null;
  created_at?: string | null;
  signed_url: string;
};

export default function InvestorPropertyGallery({
  photos,
  loanLabel,
}: {
  photos: InvestorPropertyPhoto[];
  loanLabel: string;
}) {
  const ordered = useMemo(
    () => [...photos].sort((a, b) => {
      const aCover = Boolean(a.is_cover ?? a.is_cover_photo);
      const bCover = Boolean(b.is_cover ?? b.is_cover_photo);
      if (aCover !== bCover) return aCover ? -1 : 1;
      return String(a.created_at || "").localeCompare(String(b.created_at || ""));
    }),
    [photos]
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = ordered.find((photo) => photo.id === selectedId) || ordered[0];

  if (!selected || !selected.signed_url) return null;

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-emerald-100 bg-slate-950 shadow-sm">
      <div className="flex items-center justify-between gap-3 bg-emerald-50 px-4 py-3">
        <div>
          <p className="text-sm font-black text-emerald-900">Approved property photos</p>
          <p className="text-xs text-emerald-700">Verified media for {loanLabel}</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-800">
          {ordered.length} {ordered.length === 1 ? "photo" : "photos"}
        </span>
      </div>

      <img
        src={selected.signed_url}
        alt={selected.caption || `${loanLabel} property`}
        className="h-64 w-full object-cover sm:h-80"
      />

      <div className="bg-slate-950 p-3">
        <p className="px-1 pb-3 text-sm text-slate-200">
          {selected.caption || "Property photo"}
        </p>
        {ordered.length > 1 && (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {ordered.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setSelectedId(photo.id)}
                className={`shrink-0 overflow-hidden rounded-xl border-2 ${
                  photo.id === selected.id ? "border-emerald-400" : "border-transparent"
                }`}
                aria-label={`View ${photo.caption || "property photo"}`}
              >
                <img
                  src={photo.signed_url}
                  alt=""
                  className="h-20 w-24 object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
