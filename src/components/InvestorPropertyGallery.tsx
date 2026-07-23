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
  const [fullscreen, setFullscreen] = useState(false);

  const ordered = useMemo(
    () => [...photos]
      .filter((photo) => Boolean(photo.signed_url) && !failedIds[photo.id])
      .sort((a, b) => Number(Boolean(b.is_cover)) - Number(Boolean(a.is_cover))),
    [photos, failedIds],
  );

  useEffect(() => {
    if (selectedId && !ordered.some((photo) => photo.id === selectedId)) setSelectedId(null);
  }, [ordered, selectedId]);

  useEffect(() => {
    if (!fullscreen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [fullscreen]);

  const selectedIndex = Math.max(ordered.findIndex((photo) => photo.id === selectedId), 0);
  const selected = ordered[selectedIndex] ?? ordered[0] ?? null;
  if (!selected) return null;

  const move = (direction: number) => {
    const next = (selectedIndex + direction + ordered.length) % ordered.length;
    setSelectedId(ordered[next].id);
  };

  return (
    <>
      <section className="mt-5 overflow-hidden rounded-2xl border border-emerald-900/50 bg-slate-950">
        <button type="button" className="relative block w-full bg-black" onClick={() => setFullscreen(true)} aria-label={`Open ${loanLabel} photo gallery`}>
          <img src={selected.signed_url} alt={selected.caption || `${loanLabel} property`} className="h-64 w-full object-cover sm:h-80" loading="lazy" onError={() => setFailedIds((current) => ({ ...current, [selected.id]: true }))} />
          <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1.5 text-xs font-bold text-white">Tap to enlarge</span>
          {selected.is_cover && <span className="absolute left-3 top-3 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">Cover photo</span>}
        </button>
        {ordered.length > 1 && (
          <div className="flex gap-3 overflow-x-auto p-3">
            {ordered.map((photo) => (
              <button key={photo.id} type="button" onClick={() => setSelectedId(photo.id)} className={`shrink-0 overflow-hidden rounded-xl border-2 ${photo.id === selected.id ? "border-emerald-400" : "border-slate-700"}`}>
                <img src={photo.signed_url} alt={photo.caption || "Property photo"} className="h-20 w-28 object-cover" onError={() => setFailedIds((current) => ({ ...current, [photo.id]: true }))} />
              </button>
            ))}
          </div>
        )}
      </section>

      {fullscreen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-3" role="dialog" aria-modal="true" aria-label={`${loanLabel} property gallery`}>
          <button type="button" onClick={() => setFullscreen(false)} className="absolute right-4 top-4 rounded-full bg-white/15 px-4 py-2 font-bold text-white">Close</button>
          {ordered.length > 1 && <button type="button" onClick={() => move(-1)} className="absolute left-3 rounded-full bg-white/15 px-4 py-3 text-2xl text-white" aria-label="Previous photo">‹</button>}
          <img src={selected.signed_url} alt={selected.caption || `${loanLabel} property`} className="max-h-[88vh] max-w-[92vw] object-contain" />
          {ordered.length > 1 && <button type="button" onClick={() => move(1)} className="absolute right-3 rounded-full bg-white/15 px-4 py-3 text-2xl text-white" aria-label="Next photo">›</button>}
          <div className="absolute bottom-4 rounded-full bg-white/15 px-4 py-2 text-sm font-bold text-white">{selectedIndex + 1} / {ordered.length}</div>
        </div>
      )}
    </>
  );
}
