import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useToast } from "../context/ToastContext";

interface Photo {
  id: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
  signed_url?: string;
}

interface PropertyGalleryProps {
  loanApplicationId: number;
  readOnly?: boolean;
}

const ACCEPTED = "image/jpeg,image/png,image/webp,image/heic";
const MAX_MB = 15;

export default function PropertyGallery({
  loanApplicationId,
  readOnly = false,
}: PropertyGalleryProps) {
  const { addToast } = useToast();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    loadPhotos();
  }, [loanApplicationId]);

  async function loadPhotos() {
    if (!supabase) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("property_photos")
      .select("*")
      .eq("loan_application_id", loanApplicationId)
      .order("created_at", { ascending: true });

    if (error) { setLoading(false); return; }

    const rows = (data as Photo[] | null) ?? [];
    const withUrls = await Promise.all(
      rows.map(async (p) => {
        const { data: urlData } = await supabase!.storage
          .from("property-photos")
          .createSignedUrl(p.storage_path, 3600);
        return { ...p, signed_url: urlData?.signedUrl ?? "" };
      })
    );

    setPhotos(withUrls);
    setLoading(false);
  }

  async function uploadPhoto(file: File) {
    if (!supabase) return;
    if (!file.type.startsWith("image/")) {
      addToast("error", "Invalid file", "Please upload an image file.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      addToast("error", "File too large", `Max size is ${MAX_MB} MB.`);
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/${loanApplicationId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("property-photos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("property_photos")
        .insert({
          loan_application_id: loanApplicationId,
          user_id: user.id,
          storage_path: path,
          caption: caption.trim() || null,
        });
      if (insertError) throw insertError;

      addToast("success", "Photo uploaded");
      setCaption("");
      await loadPhotos();
    } catch (err: any) {
      addToast("error", "Upload failed", err?.message);
    } finally {
      setUploading(false);
    }
  }

  async function deletePhoto(photo: Photo) {
    if (!supabase) return;
    if (!confirm("Delete this photo?")) return;
    await supabase.storage.from("property-photos").remove([photo.storage_path]);
    await supabase.from("property_photos").delete().eq("id", photo.id);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    addToast("success", "Photo deleted");
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <h3 className="text-lg font-bold text-slate-900">Property Photo Gallery</h3>
      <p className="mt-1 text-sm text-slate-500">
        Upload photos of the land, access roads, improvements, and boundaries.
      </p>

      {!readOnly && (
        <div className="mt-5 space-y-3">
          <input
            type="text"
            placeholder="Photo caption (optional)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f) uploadPhoto(f);
            }}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-6 transition ${dragOver ? "border-emerald-500 bg-emerald-50" : "border-slate-300 hover:border-emerald-400 hover:bg-slate-50"}`}
            role="button"
            tabIndex={0}
            aria-label="Upload property photo"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-slate-400">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <p className="text-sm font-medium text-slate-500">
              {uploading ? "Uploading…" : "Click or drag to upload photo"}
            </p>
            <p className="text-xs text-slate-400">JPG, PNG, WebP — max {MAX_MB} MB</p>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <p className="mt-5 text-sm text-slate-400">Loading photos…</p>
      ) : photos.length === 0 ? (
        <p className="mt-5 text-sm text-slate-400">No photos uploaded yet.</p>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative overflow-hidden rounded-xl border border-slate-200">
              <img
                src={photo.signed_url}
                alt={photo.caption ?? "Property photo"}
                className="h-36 w-full cursor-pointer object-cover transition group-hover:scale-105"
                onClick={() => setLightbox(photo.signed_url ?? null)}
              />
              {photo.caption && (
                <p className="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-2 py-1 text-[11px] text-white">
                  {photo.caption}
                </p>
              )}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => deletePhoto(photo)}
                  className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white group-hover:flex"
                  aria-label="Delete photo"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="Property photo fullscreen"
            className="max-h-full max-w-full rounded-xl object-contain"
          />
          <button
            type="button"
            className="absolute right-4 top-4 text-3xl font-black text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
