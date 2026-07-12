import { ChangeEvent, DragEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useToast } from "../context/ToastContext";

interface VideoUploadProps {
  loanApplicationId: string | number;
  existingPath?: string | null;
  existingStatus?: string | null;
  existingAdminNotes?: string | null;
  onUploaded?: (path: string) => void;
}

type VideoStatus =
  | "not_submitted"
  | "submitted"
  | "approved"
  | "rejected"
  | "more_information";

const MAX_MB = 50;
const MAX_FILE_SIZE = MAX_MB * 1024 * 1024;

const ACCEPTED_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
];

const ACCEPTED_EXTENSIONS = ["mp4", "webm", "mov", "avi"];

const STATUS_LABELS: Record<
  VideoStatus,
  { label: string; classes: string }
> = {
  not_submitted: {
    label: "Not submitted",
    classes: "bg-slate-100 text-slate-600",
  },
  submitted: {
    label: "Under review",
    classes: "bg-amber-100 text-amber-700",
  },
  approved: {
    label: "Approved",
    classes: "bg-emerald-100 text-emerald-700",
  },
  rejected: {
    label: "Needs revision",
    classes: "bg-rose-100 text-rose-700",
  },
  more_information: {
    label: "More information needed",
    classes: "bg-blue-100 text-blue-700",
  },
};

export default function VideoUpload({
  loanApplicationId,
  existingPath = null,
  existingStatus = "not_submitted",
  existingAdminNotes = null,
  onUploaded,
}: VideoUploadProps) {
  const { addToast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);

  const [storedPath, setStoredPath] = useState<string | null>(existingPath);
  const [status, setStatus] = useState<VideoStatus>(
    normalizeStatus(existingStatus)
  );

  const [uploading, setUploading] = useState(false);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const existingVideoRequestRef = useRef(0);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setStoredPath(existingPath);
    setStatus(normalizeStatus(existingStatus));
  }, [existingPath, existingStatus]);

  useEffect(() => {
    const requestId = ++existingVideoRequestRef.current;

    async function refreshPlaybackUrl() {
      setPlaybackUrl(null);

      if (!storedPath || !supabase) {
        return;
      }

      setLoadingVideo(true);

      try {
        const { data, error } = await supabase.storage
          .from("borrower-videos")
          .createSignedUrl(storedPath, 60 * 60);

        if (requestId !== existingVideoRequestRef.current) {
          return;
        }

        if (error) {
          console.error("Unable to create video URL:", error);
          return;
        }

        setPlaybackUrl(data?.signedUrl ?? null);
      } finally {
        if (requestId === existingVideoRequestRef.current) {
          setLoadingVideo(false);
        }
      }
    }

    void refreshPlaybackUrl();

    return () => {
      existingVideoRequestRef.current += 1;
    };
  }, [storedPath]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function normalizeStatus(value?: string | null): VideoStatus {
    switch (value) {
      case "submitted":
      case "approved":
      case "rejected":
      case "more_information":
        return value;
      default:
        return "not_submitted";
    }
  }

  function getExtension(selectedFile: File) {
    const extension = selectedFile.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    if (extension && ACCEPTED_EXTENSIONS.includes(extension)) {
      return extension;
    }

    if (selectedFile.type === "video/webm") return "webm";
    if (selectedFile.type === "video/quicktime") return "mov";
    if (selectedFile.type === "video/x-msvideo") return "avi";

    return "mp4";
  }

  function isAcceptedVideo(selectedFile: File) {
    const extension = selectedFile.name
      .split(".")
      .pop()
      ?.toLowerCase();

    return (
      ACCEPTED_MIME_TYPES.includes(selectedFile.type) ||
      (!!extension && ACCEPTED_EXTENSIONS.includes(extension))
    );
  }

  function clearSelectedFile() {
    setFile(null);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    if (galleryInputRef.current) {
      galleryInputRef.current.value = "";
    }

    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
  }

  function handleFile(selectedFile: File | undefined) {
    if (!selectedFile) return;

    if (!isAcceptedVideo(selectedFile)) {
      addToast(
        "error",
        "Invalid video",
        "Choose an MP4, WebM, MOV, or AVI video."
      );
      return;
    }

    if (selectedFile.size === 0) {
      addToast(
        "error",
        "Empty video",
        "The selected video does not contain any data."
      );
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      addToast(
        "error",
        "Video too large",
        `The maximum permitted video size is ${MAX_MB} MB.`
      );
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setProgress(0);
  }

  function handleGallerySelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    handleFile(selectedFile);
  }

  function handleCameraSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    handleFile(selectedFile);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);

    const selectedFile = event.dataTransfer.files?.[0];
    handleFile(selectedFile);
  }

  function handleDropZoneKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      galleryInputRef.current?.click();
    }
  }

  async function upload() {
    if (!supabase) {
      addToast(
        "error",
        "Supabase unavailable",
        "The database connection is not configured."
      );
      return;
    }

    if (!file) {
      addToast("error", "Video required", "Select or record a video first.");
      return;
    }

    const applicationId = Number(loanApplicationId);

    if (!Number.isSafeInteger(applicationId) || applicationId <= 0) {
      addToast(
        "error",
        "Invalid application",
        "The loan application number is invalid."
      );
      return;
    }

    setUploading(true);
    setProgress(5);

    let uploadedPath = "";

    try {
      const {
        data: { user },
        error: authenticationError,
      } = await supabase.auth.getUser();

      if (authenticationError) {
        throw authenticationError;
      }

      if (!user) {
        throw new Error("You must be signed in to upload a video.");
      }

      /*
       * Confirm that this application belongs to the signed-in borrower.
       * loan_applications.id is bigint, so it is compared as a number.
       */
      const { data: application, error: applicationError } = await supabase
        .from("loan_applications")
        .select("id, user_id, borrower_video_path")
        .eq("id", applicationId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (applicationError) {
        throw applicationError;
      }

      if (!application) {
        throw new Error(
          "This loan application does not belong to your account."
        );
      }

      setProgress(15);

      const extension = getExtension(file);
      const safeApplicationId = String(applicationId);
      const uniqueName =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      uploadedPath = [
        user.id,
        safeApplicationId,
        `${uniqueName}.${extension}`,
      ].join("/");

      const { error: uploadError } = await supabase.storage
        .from("borrower-videos")
        .upload(uploadedPath, file, {
          cacheControl: "3600",
          contentType: file.type || "video/mp4",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      setProgress(75);

      const { error: updateError } = await supabase
        .from("loan_applications")
        .update({
          borrower_video_path: uploadedPath,
          borrower_video_status: "submitted",
          borrower_video_admin_notes: null,
        })
        .eq("id", applicationId)
        .eq("user_id", user.id);

      if (updateError) {
        await supabase.storage
          .from("borrower-videos")
          .remove([uploadedPath]);

        throw updateError;
      }

      /*
       * Remove the previous video only after the database points to the new
       * upload. Failure to remove the old file must not invalidate the upload.
       */
      const previousPath =
        typeof application.borrower_video_path === "string"
          ? application.borrower_video_path
          : null;

      if (previousPath && previousPath !== uploadedPath) {
        const { error: removalError } = await supabase.storage
          .from("borrower-videos")
          .remove([previousPath]);

        if (removalError) {
          console.warn("Old borrower video was not removed:", removalError);
        }
      }

      setProgress(100);
      setStoredPath(uploadedPath);
      setStatus("submitted");
      clearSelectedFile();

      addToast(
        "success",
        "Video submitted",
        "Your borrower introduction video is waiting for administrator review."
      );

      onUploaded?.(uploadedPath);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Please try again.";

      addToast("error", "Video upload failed", errorMessage);
      setProgress(0);
    } finally {
      setUploading(false);
    }
  }

  const statusInformation = STATUS_LABELS[status];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Borrower Introduction Video
          </h3>

          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Introduce yourself, explain the property, describe how the loan
            will be used, and tell investors why you are a strong borrower.
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${statusInformation.classes}`}
        >
          {statusInformation.label}
        </span>
      </div>

      {existingAdminNotes && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>Administrator note:</strong> {existingAdminNotes}
        </div>
      )}

      <div className="mt-5 rounded-xl bg-slate-50 p-4">
        <h4 className="font-bold text-slate-800">
          Recommended video length: 2–5 minutes
        </h4>

        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          <li>• State your name and introduce your business.</li>
          <li>• Show or describe the land securing the loan.</li>
          <li>• Explain the loan purpose and repayment plan.</li>
          <li>• Do not show Social Security numbers or private documents.</li>
        </ul>
      </div>

      {loadingVideo && (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          Loading your existing video…
        </div>
      )}

      {playbackUrl && !loadingVideo && (
        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-black">
          <video
            src={playbackUrl}
            controls
            playsInline
            preload="metadata"
            className="max-h-[520px] w-full"
            aria-label="Current borrower introduction video"
          />
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={uploading}
          className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          🎥 Record Video
        </button>

        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={uploading}
          className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 transition hover:border-emerald-500 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          📁 Choose Existing Video
        </button>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraSelection}
      />

      <input
        ref={galleryInputRef}
        type="file"
        accept=".mp4,.webm,.mov,.avi,video/mp4,video/webm,video/quicktime,video/x-msvideo"
        className="hidden"
        onChange={handleGallerySelection}
      />

      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!uploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => {
          if (!uploading) galleryInputRef.current?.click();
        }}
        onKeyDown={handleDropZoneKeyboard}
        role="button"
        tabIndex={0}
        aria-label="Select a borrower introduction video"
        className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
          dragOver
            ? "border-emerald-500 bg-emerald-50"
            : "border-slate-300 bg-slate-50 hover:border-emerald-400"
        } ${uploading ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-11 w-11 text-slate-400"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <polygon
            points="10 8 16 12 10 16 10 8"
            fill="currentColor"
            stroke="none"
          />
        </svg>

        <p className="break-all text-sm font-semibold text-slate-700">
          {file ? file.name : "Drop a video here or tap to browse"}
        </p>

        <p className="text-xs text-slate-500">
          MP4, WebM, MOV or AVI · Maximum {MAX_MB} MB
        </p>

        {file && (
          <p className="text-xs font-medium text-emerald-700">
            {(file.size / 1024 / 1024).toFixed(1)} MB selected
          </p>
        )}
      </div>

      {previewUrl && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h4 className="font-bold text-slate-800">Video preview</h4>

            <button
              type="button"
              onClick={clearSelectedFile}
              disabled={uploading}
              className="text-sm font-bold text-rose-600 hover:text-rose-700 disabled:opacity-50"
            >
              Remove
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-black">
            <video
              src={previewUrl}
              controls
              playsInline
              preload="metadata"
              className="max-h-[520px] w-full"
              aria-label="Selected borrower video preview"
            />
          </div>
        </div>
      )}

      {uploading && (
        <div className="mt-5">
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="mt-2 text-center text-sm font-medium text-slate-600">
            Uploading and saving video… {progress}%
          </p>

          <p className="mt-1 text-center text-xs text-slate-500">
            Keep this page open until the upload finishes.
          </p>
        </div>
      )}

      {file && !uploading && (
        <button
          type="button"
          onClick={() => void upload()}
          className="mt-5 w-full rounded-xl bg-emerald-600 py-3 font-bold text-white transition hover:bg-emerald-700"
        >
          Submit Video for Review
        </button>
      )}

      {status === "submitted" && !file && (
        <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
          Your video was received and is waiting for administrator review. You
          may upload a replacement before approval.
        </div>
      )}

      {status === "approved" && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
          Your borrower introduction video has been approved.
        </div>
      )}
    </section>
  );
}