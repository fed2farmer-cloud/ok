import { useEffect, useState } from "react";
import {
  getCurrentAuthContext,
  getSupabaseErrorMessage,
  supabase,
} from "../lib/supabase";
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

const STATUS_META: Record<KYCStatus, { label: string; classes: string; icon: string }> = {
  not_started: { label: "Not started", classes: "bg-slate-100 text-slate-600", icon: "○" },
  in_progress: { label: "In progress", classes: "bg-amber-100 text-amber-700", icon: "◑" },
  submitted: { label: "Submitted", classes: "bg-blue-100 text-blue-700", icon: "●" },
  under_review: { label: "Under review", classes: "bg-blue-100 text-blue-700", icon: "◉" },
  approved: { label: "Identity Verified ✓", classes: "bg-emerald-100 text-emerald-700", icon: "✓" },
  rejected: { label: "Rejected — resubmit", classes: "bg-rose-100 text-rose-700", icon: "✕" },
  more_information: { label: "Additional info needed", classes: "bg-amber-100 text-amber-700", icon: "!" },
};

interface KYCWorkflowProps {
  expanded?: boolean;
}

export default function KYCWorkflow({ expanded: initExpanded = false }: KYCWorkflowProps) {
  const { addToast } = useToast();
  const [kyc, setKyc] = useState<KYCRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(initExpanded);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    full_legal_name: "",
    date_of_birth: "",
    ssn_last4: "",
    address: "",
    id_type: "drivers_license",
  });
  const [idFile, setIdFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  useEffect(() => {
    loadKYC();
  }, []);

  async function loadKYC() {
    if (!supabase) return;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("kyc_submissions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setKyc(data as KYCRecord);
      setForm({
        full_legal_name: data.full_legal_name ?? "",
        date_of_birth: data.date_of_birth ?? "",
        ssn_last4: data.ssn_last4 ?? "",
        address: data.address ?? "",
        id_type: data.id_type ?? "drivers_license",
      });
    }
    setLoading(false);
  }

  async function uploadFile(
    bucket: string,
    file: File,
    prefix: string,
    userId: string
  ): Promise<string> {
    if (!supabase) throw new Error("Supabase unavailable");
    if (!globalThis.crypto?.randomUUID) {
      throw new Error(
        "Secure file upload requires a modern browser with crypto support (Chrome 92+, Firefox 95+, Safari 15.4+, or Edge 92+). Please update your browser or try a different one."
      );
    }
    const ext = file.name.split(".").pop() ?? "bin";
    const objectId = globalThis.crypto.randomUUID();
    const path = `${userId}/${prefix}/${objectId}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
    if (error) throw error;
    return path;
  }

  async function submit() {
    if (!supabase) return;
    if (!form.full_legal_name || !form.date_of_birth || !form.ssn_last4 || !form.address) {
      addToast("error", "Missing fields", "Please complete all identity fields.");
      return;
    }
    if (!idFile) {
      addToast("error", "ID document required");
      return;
    }
    setSaving(true);

    try {
      const { user } = await getCurrentAuthContext();

      const [idPath, selfiePath] = await Promise.all([
        uploadFile("kyc-documents", idFile, "id", user.id),
        selfieFile
          ? uploadFile("kyc-documents", selfieFile, "selfie", user.id)
          : Promise.resolve(null),
      ]);

      const payload = {
        user_id: user.id,
        status: "submitted",
        full_legal_name: form.full_legal_name,
        date_of_birth: form.date_of_birth,
        ssn_last4: form.ssn_last4,
        address: form.address,
        id_type: form.id_type,
        id_doc_path: idPath,
        selfie_path: selfiePath,
        updated_at: new Date().toISOString(),
      };

      if (kyc) {
        const { error } = await supabase
          .from("kyc_submissions")
          .update(payload)
          .eq("id", kyc.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("kyc_submissions").insert(payload);

        if (error) throw error;
      }

      addToast("success", "KYC submitted", "Your identity is under review. We'll notify you within 1–2 business days.");
      await loadKYC();
      setExpanded(false);
    } catch (err: any) {
      console.error("KYC submission failed:", err);
      addToast(
        "error",
        "Submission failed",
        getSupabaseErrorMessage(err, "KYC submission failed.")
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  const status: KYCStatus = kyc?.status ?? "not_started";
  const meta = STATUS_META[status];
  const canEdit = ["not_started", "in_progress", "rejected", "more_information"].includes(status);

  return (
    <div className={`rounded-2xl border p-5 sm:p-6 ${status === "approved" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            {status === "approved" ? "✓ Identity Verified" : "Identity Verification (KYC/AML)"}
          </h3>
          {status !== "approved" && (
            <p className="mt-0.5 text-xs text-slate-500">
              Required before your loan can be funded.
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${meta.classes}`}>
            {meta.icon} {meta.label}
          </span>
          {canEdit && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700"
            >
              {expanded ? "Close" : status === "not_started" ? "Start Verification" : "Continue"}
            </button>
          )}
        </div>
      </div>

      {kyc?.admin_notes && (
        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-100 px-4 py-3 text-sm text-amber-800">
          <strong>Admin note:</strong> {kyc.admin_notes}
        </div>
      )}

      {expanded && canEdit && (
        <div className="mt-5 space-y-5">
          {/* Step indicator */}
          <div className="flex gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition ${s <= step ? "bg-emerald-500" : "bg-slate-200"}`}
              />
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-800">Step 1: Personal Information</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">Legal Full Name</label>
                  <input
                    type="text"
                    value={form.full_legal_name}
                    onChange={(e) => setForm((f) => ({ ...f, full_legal_name: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
                    placeholder="As shown on government ID"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">Date of Birth</label>
                  <input
                    type="date"
                    value={form.date_of_birth}
                    onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">SSN Last 4 Digits</label>
                  <input
                    type="text"
                    value={form.ssn_last4}
                    maxLength={4}
                    onChange={(e) => setForm((f) => ({ ...f, ssn_last4: e.target.value.replace(/\D/g, "") }))}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
                    placeholder="1234"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">Current Address</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
                    placeholder="Street, City, State, ZIP"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!form.full_legal_name || !form.date_of_birth || !form.ssn_last4 || !form.address}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 font-bold text-white disabled:opacity-40"
              >
                Continue →
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-800">Step 2: Government-Issued ID</h4>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">ID Type</label>
                <select
                  value={form.id_type}
                  onChange={(e) => setForm((f) => ({ ...f, id_type: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
                >
                  <option value="drivers_license">Driver's License</option>
                  <option value="passport">Passport</option>
                  <option value="state_id">State ID</option>
                  <option value="military_id">Military ID</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">Upload ID Document (front)</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={(e) => setIdFile(e.target.files?.[0] ?? null)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-emerald-700"
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="rounded-xl border border-slate-300 px-5 py-2.5 font-bold text-slate-700">← Back</button>
                <button type="button" onClick={() => setStep(3)} disabled={!idFile} className="rounded-xl bg-emerald-600 px-5 py-2.5 font-bold text-white disabled:opacity-40">Continue →</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-800">Step 3: Selfie Verification (optional)</h4>
              <p className="text-xs text-slate-500">Upload a clear selfie holding your ID to accelerate approval.</p>
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => setSelfieFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-emerald-700"
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(2)} className="rounded-xl border border-slate-300 px-5 py-2.5 font-bold text-slate-700">← Back</button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={saving}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 font-bold text-white disabled:opacity-40"
                >
                  {saving ? "Submitting…" : "Submit for Review"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
