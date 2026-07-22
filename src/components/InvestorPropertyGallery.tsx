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

type Props = {
  photos: InvestorPropertyPhoto[];
  loanLabel: string;
};

export default function InvestorPropertyGallery({ photos, loanLabel }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [failedIds, setFailedIds] = useState<Record<string, boolean>>({});

  const ordered = useMemo(
    () =>
      [...photos]
        .filter((photo) => Boolean(photo.signed_url) && !failedIds[photo.id])
        .sort((a, b) => {
          if (Boolean(a.is_cover) !== Boolean(b.is_cover)) {
            return a.is_cover ? -1 : 1;
          }
          return String(a.created_at || "").localeCompare(
            String(b.created_at || "")
          );
        }),
    [photos, failedIds]
  );

  useEffect(() => {
    if (selectedId && !ordered.some((photo) => photo.id === selectedId)) {
      setSelectedId(null);
    }
  }, [ordered, selectedId]);

  const selected =
    ordered.find((photo) => photo.id === selectedId) || ordered[0] || null;

  function markFailed(id: string) {
    setFailedIds((current) => ({ ...current, [id]: true }));
  }

  if (!selected) return null;

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-emerald-900/50 bg-slate-950 shadow-sm">
      <div className="flex items-center justify-between gap-3 bg-emerald-950/70 px-4 py-3">
        <div>
          <p className="text-sm font-black text-emerald-200">
            Approved property photos
          </p>
          <p className="text-xs text-emerald-400">Verified media for {loanLabel}</p>
        </div>
        <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-emerald-200">
          {ordered.length} {ordered.length === 1 ? "photo" : "photos"}
        </span>
      </div>

      <div className="relative bg-black">
        <img
          src={selected.signed_url}
          alt={selected.caption || `${loanLabel} property`}
          className="h-64 w-full object-cover sm:h-80"
          loading="lazy"
          onError={() => markFailed(selected.id)}
        />
        {selected.is_cover && (
          <span className="absolute left-3 top-3 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
            Cover photo
          </span>
        )}
      </div>

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
                  photo.id === selected.id
                    ? "border-emerald-400"
                    : "border-transparent opacity-80"
                }`}
                aria-label={`View ${photo.caption || "property photo"}`}
              >
                <img
                  src={photo.signed_url}
                  alt=""
                  className="h-20 w-24 object-cover"
                  loading="lazy"
                  onError={() => markFailed(photo.id)}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
