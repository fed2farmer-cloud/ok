import {
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "../lib/supabase";
import { useToast } from "../context/ToastContext";

interface VideoUploadProps {
  loanApplicationId: string | number;
  onUploaded?: (path: string) => void;
}

interface BorrowerVideo {
  id: string;
  user_id: string;
  loan_application_id: number;
  title: string | null;
  description: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  status:
    | "draft"
    | "submitted"
    | "under_review"
    | "approved"
    | "rejected"
    | "more_information";
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

const MAX_MB = 100;

const ACCEPTED_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

const ACCEPTED_FILE_INPUT =
  "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov";

export default function VideoUpload({
  loanApplicationId,
  onUploaded,
}: VideoUploadProps) {
  const { addToast } = useToast();

  const [existingVideo, setExistingVideo] =
    useState<BorrowerVideo | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(
    null
  );

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const normalizedLoanId = Number(loanApplicationId);

  useEffect(() => {
    loadExistingVideo();

    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [loanApplicationId]);

  async function loadExistingVideo() {
    if (!supabase) {
      setLoading(false);
      return;
    }

    if (
      !Number.isInteger(normalizedLoanId) ||
      normalizedLoanId <= 0
    ) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("You must be logged in.");
      }

      const { data, error } = await supabase
        .from("borrower_videos")
        .select("*")
        .eq("user_id", user.id)
        .eq("loan_application_id", normalizedLoanId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const video = (data as BorrowerVideo | null) ?? null;

      setExistingVideo(video);
      setPlaybackUrl(null);

      if (video?.storage_path) {
        await loadPlaybackUrl(video.storage_path);
      }
    } catch (error: any) {
      addToast(
        "error",
        "Unable to load video",
        error?.message ?? "The borrower video could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadPlaybackUrl(storagePath: string) {
    if (!supabase) return;

    const { data, error } = await supabase.storage
      .from("borrower-videos")
      .createSignedUrl(storagePath, 60 * 60);

    if (error) {
      console.error("Video signed URL error:", error);
      return;
    }

    if (data?.signedUrl) {
      setPlaybackUrl(data.signedUrl);
    }
  }

  function clearSelectedFile() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setFile(null);
    setPreviewUrl(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function handleFile(selectedFile: File) {
    const fileExtension =
      selectedFile.name.split(".").pop()?.toLowerCase() ?? "";

    const validExtension = ["mp4", "webm", "mov"].includes(
      fileExtension
    );

    const validMimeType =
      ACCEPTED_MIME_TYPES.includes(selectedFile.type) ||
      (selectedFile.type === "" && validExtension);

    if (!validMimeType) {
      addToast(
        "error",
        "Invalid video",
        "Select an MP4, WebM, or MOV video."
      );
      return;
    }

    if (selectedFile.size > MAX_MB * 1024 * 1024) {
      addToast(
        "error",
        "Video too large",
        `The maximum video size is ${MAX_MB} MB.`
      );
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  }

  function handleKeyboard(
    event: KeyboardEvent<HTMLDivElement>
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      inputRef.current?.click();
    }
  }

  async function uploadVideo() {
    if (!supabase || !file) return;

    if (
      !Number.isInteger(normalizedLoanId) ||
      normalizedLoanId <= 0
    ) {
      addToast(
        "error",
        "Invalid loan",
        "A valid loan application is required."
      );
      return;
    }

    setUploading(true);
    setProgress(10);

    let uploadedStoragePath = "";

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("You must be logged in.");
      }

      // Confirm that this loan belongs to the current borrower.
      const { data: loan, error: loanError } = await supabase
        .from("loan_applications")
        .select("id")
        .eq("id", normalizedLoanId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (loanError) {
        throw loanError;
      }

      if (!loan) {
        throw new Error(
          "This loan application does not belong to your account."
        );
      }

      const extension =
        file.name.split(".").pop()?.toLowerCase() || "mp4";

      const safeFileName = file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );

      uploadedStoragePath = [
        user.id,
        String(normalizedLoanId),
        `${Date.now()}-${safeFileName}`,
      ].join("/");

      setProgress(30);

      const { error: uploadError } = await supabase.storage
        .from("borrower-videos")
        .upload(uploadedStoragePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType:
            file.type ||
            (extension === "mov"
              ? "video/quicktime"
              : `video/${extension}`),
        });

      if (uploadError) {
        throw uploadError;
      }

      setProgress(70);

      const videoPayload = {
        user_id: user.id,
        loan_application_id: normalizedLoanId,
        title: "Borrower Introduction Video",
        description:
          "Borrower introduction and loan opportunity overview.",
        file_name: file.name,
        storage_path: uploadedStoragePath,
        mime_type: file.type || null,
        file_size: file.size,
        status: "submitted",
        admin_notes: null,
        updated_at: new Date().toISOString(),
      };

      let databaseError: Error | null = null;

      if (existingVideo) {
        const { error } = await supabase
          .from("borrower_videos")
          .update(videoPayload)
          .eq("id", existingVideo.id)
          .eq("user_id", user.id);

        databaseError = error;
      } else {
        const { error } = await supabase
          .from("borrower_videos")
          .insert(videoPayload);

        databaseError = error;
      }

      if (databaseError) {
        await supabase.storage
          .from("borrower-videos")
          .remove([uploadedStoragePath]);

        throw databaseError;
      }

      // Remove the previously uploaded file only after the new
      // upload and database update both succeed.
      if (
        existingVideo?.storage_path &&
        existingVideo.storage_path !== uploadedStoragePath
      ) {
        await supabase.storage
          .from("borrower-videos")
          .remove([existingVideo.storage_path]);
      }

      setProgress(100);

      addToast(
        "success",
        "Video submitted",
        "Your introduction video is awaiting administrator review."
      );

      clearSelectedFile();
      await loadExistingVideo();

      onUploaded?.(uploadedStoragePath);
    } catch (error: any) {
      addToast(
        "error",
        "Video upload failed",
        error?.message ?? "Please try again."
      );
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  const currentStatus =
    existingVideo?.status ?? "not_submitted";

  const statusLabels: Record<
    string,
    { label: string; classes: string }
  > = {
    not_submitted: {
      label: "Not submitted",
      classes: "bg-slate-100 text-slate-600",
    },
    draft: {
      label: "Draft",
      classes: "bg-slate-100 text-slate-600",
    },
    submitted: {
      label: "Submitted for review",
      classes: "bg-amber-100 text-amber-700",
    },
    under_review: {
      label: "Under review",
      classes: "bg-blue-100 text-blue-700",
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

  const statusInfo =
    statusLabels[currentStatus] ??
    statusLabels.not_submitted;

  const canReplaceVideo =
    !existingVideo ||
    ["draft", "rejected", "more_information"].includes(
      currentStatus
    );

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-500">
          Loading borrower video…
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Borrower Introduction Video
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Record a 2–5 minute video introducing yourself,
            your property, and your loan purpose.
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${statusInfo.classes}`}
        >
          {statusInfo.label}
        </span>
      </div>

      {existingVideo?.admin_notes && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>Administrator note:</strong>{" "}
          {existingVideo.admin_notes}
        </div>
      )}

      {playbackUrl && (
        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-black">
          <video
            src={playbackUrl}
            controls
            playsInline
            className="aspect-video w-full"
            preload="metadata"
            aria-label="Borrower introduction video"
          />
        </div>
      )}

      {currentStatus === "submitted" ||
      currentStatus === "under_review" ? (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Your video is awaiting administrator review. It
          cannot be replaced until the review is completed.
        </div>
      ) : currentStatus === "approved" ? (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Your video has been approved and may appear in the
          investor marketplace.
        </div>
      ) : (
        canReplaceVideo && (
          <>
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);

                const droppedFile =
                  event.dataTransfer.files?.[0];

                if (droppedFile) {
                  handleFile(droppedFile);
                }
              }}
              onClick={() => inputRef.current?.click()}
              onKeyDown={handleKeyboard}
              className={`mt-5 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 transition ${
                dragOver
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-slate-300 hover:border-emerald-400 hover:bg-slate-50"
              }`}
              role="button"
              tabIndex={0}
              aria-label="Choose borrower introduction video"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-10 w-10 text-slate-400"
              >
                <circle cx="12" cy="12" r="10" />
                <polygon
                  points="10 8 16 12 10 16 10 8"
                  fill="currentColor"
                  stroke="none"
                />
              </svg>

              <p className="text-center text-sm font-medium text-slate-600">
                {file
                  ? file.name
                  : "Tap to record or choose a video"}
              </p>

              <p className="text-xs text-slate-400">
                MP4, WebM, or MOV — maximum {MAX_MB} MB
              </p>

              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED_FILE_INPUT}
                capture="environment"
                className="hidden"
                onChange={(event) => {
                  const selectedFile =
                    event.target.files?.[0];

                  if (selectedFile) {
                    handleFile(selectedFile);
                  }
                }}
              />
            </div>

            {previewUrl && (
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-black">
                <video
                  src={previewUrl}
                  controls
                  playsInline
                  className="aspect-video w-full"
                  preload="metadata"
                  aria-label="Selected video preview"
                />
              </div>
            )}

            {uploading && (
              <div className="mt-4">
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <p className="mt-2 text-center text-xs text-slate-500">
                  Uploading and submitting… {progress}%
                </p>
              </div>
            )}

            {file && !uploading && (
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={clearSelectedFile}
                  className="rounded-xl border border-slate-300 px-5 py-3 font-bold text-slate-700"
                >
                  Remove Video
                </button>

                <button
                  type="button"
                  onClick={uploadVideo}
                  className="flex-1 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white transition hover:bg-emerald-700"
                >
                  Submit Video for Review
                </button>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}