import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useToast } from "../context/ToastContext";

interface VideoUploadProps {
  loanApplicationId: number;
  existingPath?: string | null;
  existingStatus?: string | null;
  onUploaded?: (path: string) => void;
}

const MAX_MB = 200;
const ACCEPTED = "video/mp4,video/webm,video/quicktime,video/x-msvideo";

export default function VideoUpload({
  loanApplicationId,
  existingPath,
  existingStatus,
  onUploaded,
}: VideoUploadProps) {
  const { addToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (existingPath) loadPlaybackUrl(existingPath);
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [existingPath]);

  async function loadPlaybackUrl(path: string) {
    if (!supabase) return;
    const { data } = await supabase.storage
      .from("borrower-videos")
      .createSignedUrl(path, 3600);
    if (data?.signedUrl) setPlaybackUrl(data.signedUrl);
  }

  function handleFile(f: File) {
    if (!f.type.startsWith("video/")) {
      addToast("error", "Invalid file", "Please upload a video file (MP4, WebM, MOV).");
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      addToast("error", "File too large", `Maximum video size is ${MAX_MB} MB.`);
      return;
    }
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
  }

  async function upload() {
    if (!file || !supabase) return;
    setUploading(true);
    setProgress(10);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { addToast("error", "Not authenticated"); return; }

      const ext = file.name.split(".").pop() ?? "mp4";
      const path = `${user.id}/${loanApplicationId}/${Date.now()}.${ext}`;

      setProgress(30);

      const { error: uploadError } = await supabase.storage
        .from("borrower-videos")
        .upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      setProgress(70);

      const { error: updateError } = await supabase
        .from("loan_applications")
        .update({
          borrower_video_path: path,
          borrower_video_status: "submitted",
        })
        .eq("id", loanApplicationId);

      if (updateError) throw updateError;

      setProgress(100);
      addToast("success", "Video uploaded", "Your introduction video is pending admin review.");
      await loadPlaybackUrl(path);
      if (onUploaded) onUploaded(path);
    } catch (err: any) {
      addToast("error", "Upload failed", err?.message ?? "Please try again.");
    } finally {
      setUploading(false);
    }
  }

  const status = existingStatus ?? "not_submitted";
  const statusLabels: Record<string, { label: string; classes: string }> = {
    not_submitted: { label: "Not submitted", classes: "bg-slate-100 text-slate-600" },
    submitted: { label: "Under review", classes: "bg-amber-100 text-amber-700" },
    approved: { label: "Approved", classes: "bg-emerald-100 text-emerald-700" },
    rejected: { label: "Needs revision", classes: "bg-rose-100 text-rose-700" },
    more_information: { label: "More information needed", classes: "bg-blue-100 text-blue-700" },
  };
  const statusInfo = statusLabels[status] ?? statusLabels.not_submitted;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Borrower Introduction Video</h3>
          <p className="mt-1 text-sm text-slate-500">
            Record a 2–5 minute video introducing yourself, your farm, and your loan purpose.
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusInfo.classes}`}>
          {statusInfo.label}
        </span>
      </div>

      {/* Existing video playback */}
      {playbackUrl && (
        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
          <video
            src={playbackUrl}
            controls
            className="w-full"
            preload="metadata"
            aria-label="Borrower introduction video"
          />
        </div>
      )}

      {/* Upload area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => inputRef.current?.click()}
        className={`mt-5 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 transition ${dragOver ? "border-emerald-500 bg-emerald-50" : "border-slate-300 hover:border-emerald-400 hover:bg-slate-50"}`}
        role="button"
        tabIndex={0}
        aria-label="Upload video"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-10 w-10 text-slate-400">
          <circle cx="12" cy="12" r="10" />
          <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
        </svg>
        <p className="text-sm font-medium text-slate-600">
          {file ? file.name : "Drag & drop or click to select video"}
        </p>
        <p className="text-xs text-slate-400">MP4, WebM, MOV — max {MAX_MB} MB</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      {/* Preview */}
      {preview && (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <video
            src={preview}
            controls
            className="w-full"
            preload="metadata"
            aria-label="Video preview"
          />
        </div>
      )}

      {/* Progress bar */}
      {uploading && (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-2 rounded-full bg-emerald-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-center text-xs text-slate-500">Uploading… {progress}%</p>
        </div>
      )}

      {file && !uploading && (
        <button
          type="button"
          onClick={upload}
          className="mt-4 w-full rounded-xl bg-emerald-600 py-3 font-bold text-white transition hover:bg-emerald-700"
        >
          Submit Video for Review
        </button>
      )}
    </div>
  );
}
