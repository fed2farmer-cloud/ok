import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useToast } from "../context/ToastContext";

export type KYCStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "more_information";

interface KYCRecord {
  id: string;
  user_id?: string;
  status: KYCStatus;
  full_legal_name: string | null;
  date_of_birth: string | null;
  ssn_last4: string | null;
  address: string | null;
  id_type: string | null;
  id_doc_path: string | null;
  selfie_path: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface KYCWorkflowProps {
  expanded?: boolean;
}

interface KYCForm {
  full_legal_name: string;
  date_of_birth: string;
  ssn_last4: string;
  address: string;
  id_type: string;
}

const KYC_BUCKET = "kyc-documents";
const MAX_FILE_SIZE = 15 * 1024 * 1024;

const STATUS_META: Record<
  KYCStatus,
  {
    label: string;
    classes: string;
    icon: string;
  }
> = {
  not_started: {
    label: "Not started",
    classes: "bg-slate-100 text-slate-600",
    icon: "○",
  },
  in_progress: {
    label: "In progress",
    classes: "bg-amber-100 text-amber-700",
    icon: "◑",
  },
  submitted: {
    label: "Submitted",
    classes: "bg-blue-100 text-blue-700",
    icon: "●",
  },
  under_review: {
    label: "Under review",
    classes: "bg-blue-100 text-blue-700",
    icon: "◉",
  },
  approved: {
    label: "Identity Verified",
    classes: "bg-emerald-100 text-emerald-700",
    icon: "✓",
  },
  rejected: {
    label: "Rejected — resubmit",
    classes: "bg-rose-100 text-rose-700",
    icon: "✕",
  },
  more_information: {
    label: "Additional info needed",
    classes: "bg-amber-100 text-amber-700",
    icon: "!",
  },
};

const INITIAL_FORM: KYCForm = {
  full_legal_name: "",
  date_of_birth: "",
  ssn_last4: "",
  address: "",
  id_type: "drivers_license",
};

function sanitizeExtension(file: File): string {
  const originalExtension = file.name.split(".").pop()?.toLowerCase();

  if (originalExtension) {
    return originalExtension.replace(/[^a-z0-9]/g, "") || "bin";
  }

  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "application/pdf") return "pdf";

  return "bin";
}

function validateUploadFile(
  file: File,
  allowPdf: boolean
): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return "The maximum file size is 15 MB.";
  }

  const allowedTypes = allowPdf
    ? [
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
      ]
    : ["image/jpeg", "image/png", "image/webp"];

  if (!allowedTypes.includes(file.type)) {
    return allowPdf
      ? "Upload a JPG, PNG, WebP, or PDF file."
      : "Upload a JPG, PNG, or WebP image.";
  }

  return null;
}

export default function KYCWorkflow({
  expanded: initiallyExpanded = false,
}: KYCWorkflowProps) {
  const { addToast } = useToast();

  const [kyc, setKyc] = useState<KYCRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);

  const [form, setForm] = useState<KYCForm>(INITIAL_FORM);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  const idPreviewUrl = useMemo(() => {
    if (!idFile || !idFile.type.startsWith("image/")) return "";
    return URL.createObjectURL(idFile);
  }, [idFile]);

  const selfiePreviewUrl = useMemo(() => {
    if (!selfieFile || !selfieFile.type.startsWith("image/")) return "";
    return URL.createObjectURL(selfieFile);
  }, [selfieFile]);

  useEffect(() => {
    void loadKYC();
  }, []);

  useEffect(() => {
    return () => {
      if (idPreviewUrl) URL.revokeObjectURL(idPreviewUrl);
    };
  }, [idPreviewUrl]);

  useEffect(() => {
    return () => {
      if (selfiePreviewUrl) URL.revokeObjectURL(selfiePreviewUrl);
    };
  }, [selfiePreviewUrl]);

  async function loadKYC() {
    if (!supabase) {
      setLoading(false);
      addToast(
        "error",
        "Supabase unavailable",
        "The application is not connected to Supabase."
      );
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
        setKyc(null);
        return;
      }

      const { data, error } = await supabase
        .from("kyc_submissions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        const record = data as KYCRecord;

        setKyc(record);

        setForm({
          full_legal_name: record.full_legal_name ?? "",
          date_of_birth: record.date_of_birth ?? "",
          ssn_last4: record.ssn_last4 ?? "",
          address: record.address ?? "",
          id_type: record.id_type ?? "drivers_license",
        });
      } else {
        setKyc(null);
        setForm(INITIAL_FORM);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load identity verification.";

      addToast("error", "KYC loading failed", message);
    } finally {
      setLoading(false);
    }
  }

  function handleIdFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const selectedFile = event.target.files?.[0] ?? null;

    if (!selectedFile) return;

    const validationError = validateUploadFile(
      selectedFile,
      true
    );

    if (validationError) {
      event.target.value = "";
      setIdFile(null);
      addToast("error", "Invalid ID document", validationError);
      return;
    }

    setIdFile(selectedFile);
  }

  function handleSelfieFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const selectedFile = event.target.files?.[0] ?? null;

    if (!selectedFile) return;

    const validationError = validateUploadFile(
      selectedFile,
      false
    );

    if (validationError) {
      event.target.value = "";
      setSelfieFile(null);
      addToast("error", "Invalid selfie", validationError);
      return;
    }

    setSelfieFile(selectedFile);
  }

  async function uploadFile(
    file: File,
    prefix: "id" | "selfie"
  ): Promise<string> {
    if (!supabase) {
      throw new Error("Supabase is unavailable.");
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!user) {
      throw new Error("You must be signed in.");
    }

    const extension = sanitizeExtension(file);

    const path = [
      user.id,
      prefix,
      `${Date.now()}-${crypto.randomUUID()}.${extension}`,
    ].join("/");

    const { error: uploadError } = await supabase.storage
      .from(KYC_BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });

    if (uploadError) {
      throw new Error(
        `Unable to upload ${prefix === "id" ? "ID document" : "selfie"}: ${
          uploadError.message
        }`
      );
    }

    return path;
  }

  async function removeUploadedFile(path: string | null) {
    if (!supabase || !path) return;

    await supabase.storage.from(KYC_BUCKET).remove([path]);
  }

  async function submit() {
    if (!supabase || saving) return;

    if (
      !form.full_legal_name.trim() ||
      !form.date_of_birth ||
      form.ssn_last4.length !== 4 ||
      !form.address.trim()
    ) {
      addToast(
        "error",
        "Missing identity information",
        "Complete your legal name, date of birth, address, and four SSN digits."
      );
      setStep(1);
      return;
    }

    if (!idFile && !kyc?.id_doc_path) {
      addToast(
        "error",
        "ID document required",
        "Take a photo or choose an existing government ID file."
      );
      setStep(2);
      return;
    }

    setSaving(true);

    let newlyUploadedIdPath: string | null = null;
    let newlyUploadedSelfiePath: string | null = null;

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("You must be signed in.");
      }

      if (idFile) {
        newlyUploadedIdPath = await uploadFile(idFile, "id");
      }

      if (selfieFile) {
        newlyUploadedSelfiePath = await uploadFile(
          selfieFile,
          "selfie"
        );
      }

      const payload = {
        user_id: user.id,
        status: "submitted" as KYCStatus,
        full_legal_name: form.full_legal_name.trim(),
        date_of_birth: form.date_of_birth,
        ssn_last4: form.ssn_last4,
        address: form.address.trim(),
        id_type: form.id_type,
        id_doc_path:
          newlyUploadedIdPath ?? kyc?.id_doc_path ?? null,
        selfie_path:
          newlyUploadedSelfiePath ??
          kyc?.selfie_path ??
          null,
        updated_at: new Date().toISOString(),
      };

      if (kyc) {
        const { data, error } = await supabase
          .from("kyc_submissions")
          .update(payload)
          .eq("id", kyc.id)
          .eq("user_id", user.id)
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        if (
          newlyUploadedIdPath &&
          kyc.id_doc_path &&
          kyc.id_doc_path !== newlyUploadedIdPath
        ) {
          await removeUploadedFile(kyc.id_doc_path);
        }

        if (
          newlyUploadedSelfiePath &&
          kyc.selfie_path &&
          kyc.selfie_path !== newlyUploadedSelfiePath
        ) {
          await removeUploadedFile(kyc.selfie_path);
        }

        setKyc(data as KYCRecord);
      } else {
        const { data, error } = await supabase
          .from("kyc_submissions")
          .insert(payload)
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        setKyc(data as KYCRecord);
      }

      setIdFile(null);
      setSelfieFile(null);
      setExpanded(false);
      setStep(1);

      addToast(
        "success",
        "KYC submitted",
        "Your identity documents were submitted for review."
      );

      await loadKYC();
    } catch (error: unknown) {
      if (newlyUploadedIdPath) {
        await removeUploadedFile(newlyUploadedIdPath);
      }

      if (newlyUploadedSelfiePath) {
        await removeUploadedFile(newlyUploadedSelfiePath);
      }

      const message =
        error instanceof Error
          ? error.message
          : "Identity verification submission failed.";

      addToast("error", "Submission failed", message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-600">
          Loading identity verification...
        </p>
      </div>
    );
  }

  const status: KYCStatus = kyc?.status ?? "not_started";
  const meta = STATUS_META[status];

  const canEdit = [
    "not_started",
    "in_progress",
    "rejected",
    "more_information",
  ].includes(status);

  return (
    <div
      className={`rounded-2xl border p-5 sm:p-6 ${
        status === "approved"
          ? "border-emerald-200 bg-emerald-50"
          : "border-amber-200 bg-amber-50"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            {status === "approved"
              ? "✓ Identity Verified"
              : "Identity Verification (KYC/AML)"}
          </h3>

          {status !== "approved" && (
            <p className="mt-0.5 text-xs text-slate-500">
              Required before your loan or investment can be funded.
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${meta.classes}`}
          >
            {meta.icon} {meta.label}
          </span>

          {canEdit && (
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700"
            >
              {expanded
                ? "Close"
                : status === "not_started"
                  ? "Start Verification"
                  : "Continue"}
            </button>
          )}
        </div>
      </div>

      {kyc?.admin_notes && (
        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-100 px-4 py-3 text-sm text-amber-800">
          <strong>Admin note:</strong> {kyc.admin_notes}
        </div>
      )}

      {status === "submitted" && (
        <p className="mt-4 text-sm text-blue-700">
          Your documents were received and are waiting for review.
        </p>
      )}

      {status === "under_review" && (
        <p className="mt-4 text-sm text-blue-700">
          Your identity verification is currently being reviewed.
        </p>
      )}

      {expanded && canEdit && (
        <div className="mt-5 space-y-5">
          <div className="flex gap-2">
            {[1, 2, 3].map((indicatorStep) => (
              <div
                key={indicatorStep}
                className={`h-1.5 flex-1 rounded-full transition ${
                  indicatorStep <= step
                    ? "bg-emerald-500"
                    : "bg-slate-200"
                }`}
              />
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-800">
                Step 1: Personal Information
              </h4>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="kyc-full-name"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Legal Full Name
                  </label>

                  <input
                    id="kyc-full-name"
                    type="text"
                    value={form.full_legal_name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        full_legal_name: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
                    placeholder="As shown on government ID"
                  />
                </div>

                <div>
                  <label
                    htmlFor="kyc-date-of-birth"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Date of Birth
                  </label>

                  <input
                    id="kyc-date-of-birth"
                    type="date"
                    value={form.date_of_birth}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        date_of_birth: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="kyc-ssn-last-four"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    SSN Last 4 Digits
                  </label>

                  <input
                    id="kyc-ssn-last-four"
                    type="text"
                    inputMode="numeric"
                    value={form.ssn_last4}
                    maxLength={4}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        ssn_last4: event.target.value
                          .replace(/\D/g, "")
                          .slice(0, 4),
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
                    placeholder="1234"
                  />
                </div>

                <div>
                  <label
                    htmlFor="kyc-address"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Current Address
                  </label>

                  <input
                    id="kyc-address"
                    type="text"
                    value={form.address}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        address: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
                    placeholder="Street, City, State, ZIP"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={
                  !form.full_legal_name.trim() ||
                  !form.date_of_birth ||
                  form.ssn_last4.length !== 4 ||
                  !form.address.trim()
                }
                className="rounded-xl bg-emerald-600 px-5 py-2.5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue →
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-800">
                Step 2: Government-Issued ID
              </h4>

              <div>
                <label
                  htmlFor="kyc-id-type"
                  className="mb-1.5 block text-xs font-semibold text-slate-700"
                >
                  ID Type
                </label>

                <select
                  id="kyc-id-type"
                  value={form.id_type}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      id_type: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
                >
                  <option value="drivers_license">
                    Driver&apos;s License
                  </option>
                  <option value="passport">Passport</option>
                  <option value="state_id">State ID</option>
                  <option value="military_id">Military ID</option>
                </select>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-slate-700">
                  Government ID Document
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="kyc-id-camera"
                      className="block cursor-pointer rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-bold text-white hover:bg-emerald-700"
                    >
                      📷 Take ID Photo
                    </label>

                    <input
                      id="kyc-id-camera"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleIdFileChange}
                      className="hidden"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="kyc-id-file"
                      className="block cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      📁 Choose Existing File
                    </label>

                    <input
                      id="kyc-id-file"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={handleIdFileChange}
                      className="hidden"
                    />
                  </div>
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  Accepted: JPG, PNG, WebP or PDF. Maximum size:
                  15 MB.
                </p>
              </div>

              {idFile && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="break-all text-sm font-semibold text-emerald-800">
                    Selected: {idFile.name}
                  </p>

                  {idPreviewUrl && (
                    <img
                      src={idPreviewUrl}
                      alt="Government ID preview"
                      className="mt-3 max-h-64 w-full rounded-lg object-contain"
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => setIdFile(null)}
                    className="mt-3 text-sm font-bold text-rose-600"
                  >
                    Remove selected ID
                  </button>
                </div>
              )}

              {!idFile && kyc?.id_doc_path && (
                <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-700">
                  A government ID is already saved. Select another file
                  only to replace it.
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-xl border border-slate-300 px-5 py-2.5 font-bold text-slate-700"
                >
                  ← Back
                </button>

                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={!idFile && !kyc?.id_doc_path}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-800">
                Step 3: Selfie Verification
              </h4>

              <p className="text-xs text-slate-500">
                Take or upload a clear selfie while holding your
                government ID. The selfie is optional but helps speed
                up review.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="kyc-selfie-camera"
                    className="block cursor-pointer rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-bold text-white hover:bg-emerald-700"
                  >
                    🤳 Take Selfie
                  </label>

                  <input
                    id="kyc-selfie-camera"
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={handleSelfieFileChange}
                    className="hidden"
                  />
                </div>

                <div>
                  <label
                    htmlFor="kyc-selfie-file"
                    className="block cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    📁 Choose Existing Photo
                  </label>

                  <input
                    id="kyc-selfie-file"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleSelfieFileChange}
                    className="hidden"
                  />
                </div>
              </div>

              {selfieFile && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="break-all text-sm font-semibold text-emerald-800">
                    Selected: {selfieFile.name}
                  </p>

                  {selfiePreviewUrl && (
                    <img
                      src={selfiePreviewUrl}
                      alt="Selfie preview"
                      className="mt-3 max-h-64 w-full rounded-lg object-contain"
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => setSelfieFile(null)}
                    className="mt-3 text-sm font-bold text-rose-600"
                  >
                    Remove selected selfie
                  </button>
                </div>
              )}

              {!selfieFile && kyc?.selfie_path && (
                <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-700">
                  A selfie is already saved. Select another photo only
                  to replace it.
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={saving}
                  className="rounded-xl border border-slate-300 px-5 py-2.5 font-bold text-slate-700 disabled:opacity-40"
                >
                  ← Back
                </button>

                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={saving}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving
                    ? "Uploading and submitting..."
                    : "Submit for Review"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}