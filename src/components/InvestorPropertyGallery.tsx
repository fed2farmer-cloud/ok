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

type InvestorPropertyGalleryProps = {
  photos: InvestorPropertyPhoto[];
  loanLabel: string;
};

export default function InvestorPropertyGallery({
  photos,
  loanLabel,
}: InvestorPropertyGalleryProps) {
  const orderedPhotos = useMemo(() => {
    return [...photos]
      .filter((photo) => Boolean(photo.signed_url))
      .sort((a, b) => {
        const aIsCover = Boolean(a.is_cover ?? a.is_cover_photo);
        const bIsCover = Boolean(b.is_cover ?? b.is_cover_photo);

        if (aIsCover !== bIsCover) {
          return aIsCover ? -1 : 1;
        }

        return String(a.created_at || "").localeCompare(
          String(b.created_at || "")
        );
      });
  }, [photos]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const availablePhotos = orderedPhotos.filter(
    (photo) => !failedImages[photo.id]
  );

  const selectedPhoto =
    availablePhotos.find((photo) => photo.id === selectedId) ||
    availablePhotos[0];

  function markImageFailed(photoId: string) {
    setFailedImages((current) => ({
      ...current,
      [photoId]: true,
    }));

    if (selectedId === photoId) {
      setSelectedId(null);
    }
  }

  if (!selectedPhoto) {
    return null;
  }

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-emerald-900/50 bg-slate-950 shadow-lg">
      <div className="flex items-center justify-between gap-3 border-b border-emerald-900/40 bg-emerald-950/40 px-4 py-3">
        <div>
          <p className="text-sm font-black text-emerald-300">
            Approved property photos
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Verified property media for {loanLabel}
          </p>
        </div>

        <span className="shrink-0 rounded-full border border-emerald-800 bg-slate-900 px-3 py-1 text-xs font-bold text-emerald-300">
          {availablePhotos.length}{" "}
          {availablePhotos.length === 1 ? "photo" : "photos"}
        </span>
      </div>

      <div className="relative bg-black">
        <img
          src={selectedPhoto.signed_url}
          alt={selectedPhoto.caption || `${loanLabel} property`}
          className="h-64 w-full object-cover sm:h-80"
          loading="lazy"
          onError={() => markImageFailed(selectedPhoto.id)}
        />

        {(selectedPhoto.is_cover || selectedPhoto.is_cover_photo) && (
          <span className="absolute left-3 top-3 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow">
            Cover photo
          </span>
        )}
      </div>

      <div className="bg-slate-950 p-3">
        <p className="px-1 pb-3 text-sm text-slate-200">
          {selectedPhoto.caption || "Property photo"}
        </p>

        {availablePhotos.length > 1 && (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {availablePhotos.map((photo) => {
              const isSelected = photo.id === selectedPhoto.id;

              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setSelectedId(photo.id)}
                  className={`shrink-0 overflow-hidden rounded-xl border-2 transition ${
                    isSelected
                      ? "border-emerald-400"
                      : "border-transparent opacity-80 hover:opacity-100"
                  }`}
                  aria-label={`View ${
                    photo.caption || "approved property photo"
                  }`}
                >
                  <img
                    src={photo.signed_url}
                    alt={photo.caption || ""}
                    className="h-20 w-24 object-cover"
                    loading="lazy"
                    onError={() => markImageFailed(photo.id)}
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}