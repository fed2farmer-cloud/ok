import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type ManualNotaryRow = {
  loan_application_id?: number | null;
  manual_mode?: boolean | null;
  manual_status?: string | null;
  manual_scheduled_at?: string | null;
  manual_completed_at?: string | null;
  manual_document_path?: string | null;
  manual_document_name?: string | null;
  manual_notes?: string | null;
  updated_at?: string | null;
};

function pretty(value?: string | null) {
  return String(value || "not started").replaceAll("_", " ");
}

function localInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function AdminManualNotaryPanel({ loanId, loanNumber }: { loanId: string; loanNumber?: number | null }) {
  const [row, setRow] = useState<ManualNotaryRow | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    if (!supabase || !loanId) return;
    setError("");
    const { data, error: queryError } = await supabase
      .from("proof_notary_transactions")
      .select("loan_application_id,manual_mode,manual_status,manual_scheduled_at,manual_completed_at,manual_document_path,manual_document_name,manual_notes,updated_at")
      .eq("loan_application_id", Number(loanId))
      .maybeSingle();

    if (queryError) {
      if (/manual_status|schema cache|does not exist/i.test(queryError.message || "")) {
        setError("Manual notarization is not installed yet. Apply the v4.5.9 Supabase migration first.");
        return;
      }
      setError(queryError.message || "Unable to load manual notarization status.");
      return;
    }

    const next = (data as ManualNotaryRow | null) || null;
    setRow(next);
    setNotes(next?.manual_notes || "");
    setScheduledAt(localInputValue(next?.manual_scheduled_at));
  }

  useEffect(() => { void load(); }, [loanId]);

  async function updateManualStatus(nextStatus: "not_started" | "scheduled" | "completed" | "cancelled", documentPath?: string | null, documentName?: string | null) {
    if (!supabase) return;
    setBusy(nextStatus);
    setError("");
    setMessage("");
    try {
      let scheduledIso: string | null = null;
      if (nextStatus === "scheduled") {
        const scheduledDate = scheduledAt ? new Date(scheduledAt) : new Date();
        if (Number.isNaN(scheduledDate.getTime())) throw new Error("Enter a valid notarization date and time.");
        scheduledIso = scheduledDate.toISOString();
      }

      const { data, error: rpcError } = await supabase.rpc("admin_update_manual_notary", {
        p_loan_application_id: Number(loanId),
        p_manual_status: nextStatus,
        p_scheduled_at: scheduledIso,
        p_notes: notes.trim() || null,
        p_document_path: documentPath || null,
        p_document_name: documentName || null,
      });
      if (rpcError) throw rpcError;
      setRow((data as ManualNotaryRow | null) || null);
      setMessage(nextStatus === "completed" ? "Manual notarization marked complete." : `Manual notarization marked ${pretty(nextStatus)}.`);
      await load();
    } catch (e: any) {
      setError(e?.message || "Unable to update manual notarization.");
    } finally {
      setBusy("");
    }
  }

  async function uploadCompletedDocument(file: File | null) {
    if (!supabase || !file) return;
    setBusy("upload");
    setError("");
    setMessage("");
    try {
      if (!/pdf/i.test(file.type) && !file.name.toLowerCase().endsWith(".pdf")) {
        throw new Error("Upload the completed notarized document as a PDF.");
      }
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
      const path = `${loanId}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("notarized-loan-documents")
        .upload(path, file, { contentType: file.type || "application/pdf", upsert: false });
      if (uploadError) throw uploadError;

      const { data, error: rpcError } = await supabase.rpc("admin_update_manual_notary", {
        p_loan_application_id: Number(loanId),
        p_manual_status: "completed",
        p_scheduled_at: null,
        p_notes: notes.trim() || null,
        p_document_path: path,
        p_document_name: file.name,
      });
      if (rpcError) {
        await supabase.storage.from("notarized-loan-documents").remove([path]);
        throw rpcError;
      }
      setRow((data as ManualNotaryRow | null) || null);
      setMessage("Completed notarized PDF uploaded and the notarization task was marked complete.");
      await load();
    } catch (e: any) {
      setError(e?.message || "Unable to upload the notarized PDF.");
    } finally {
      setBusy("");
    }
  }

  async function openCompletedDocument() {
    if (!supabase || !row?.manual_document_path) return;
    const { data, error: signedError } = await supabase.storage
      .from("notarized-loan-documents")
      .createSignedUrl(row.manual_document_path, 900);
    if (signedError || !data?.signedUrl) {
      setError(signedError?.message || "Unable to open the notarized document.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="mt-7 rounded-2xl border border-sky-200 bg-sky-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">Closing fallback</p>
          <h3 className="mt-1 text-lg font-black text-slate-950">Manual / Test Notarization</h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Use this while the Proof API subscription is inactive. This completes only the notarization step; county recording stays separate.</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase text-sky-800 shadow-sm">
          {pretty(row?.manual_status)}
        </span>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-bold text-slate-700">Scheduled date/time
          <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3" />
        </label>
        <label className="text-sm font-bold text-slate-700">Admin notes
          <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notary name, appointment details, exceptions…" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3" />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={Boolean(busy)} onClick={() => void updateManualStatus("scheduled")} className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-black text-white disabled:opacity-40">
          {busy === "scheduled" ? "Saving…" : "Mark scheduled"}
        </button>
        <button type="button" disabled={Boolean(busy)} onClick={() => void updateManualStatus("completed")} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white disabled:opacity-40">
          {busy === "completed" ? "Saving…" : "Mark completed"}
        </button>
        <button type="button" disabled={Boolean(busy)} onClick={() => void updateManualStatus("not_started")} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 disabled:opacity-40">Reset</button>
        <button type="button" disabled={Boolean(busy)} onClick={() => void updateManualStatus("cancelled")} className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-black text-rose-700 disabled:opacity-40">Cancel manual appointment</button>
      </div>

      <div className="mt-4 rounded-xl border border-sky-200 bg-white p-4">
        <p className="text-sm font-black text-slate-900">Completed notarized PDF</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white">
            {busy === "upload" ? "Uploading…" : "Upload completed PDF"}
            <input type="file" accept="application/pdf,.pdf" disabled={Boolean(busy)} onChange={(event) => { const file = event.target.files?.[0] || null; void uploadCompletedDocument(file); event.currentTarget.value = ""; }} className="hidden" />
          </label>
          {row?.manual_document_path && (
            <button type="button" onClick={() => void openCompletedDocument()} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-black text-slate-700">Open uploaded PDF</button>
          )}
          <span className="text-sm text-slate-500">{row?.manual_document_name || `Loan #${loanNumber ?? loanId}: no notarized PDF uploaded yet`}</span>
        </div>
      </div>

      {row?.manual_scheduled_at && <p className="mt-3 text-xs font-semibold text-slate-600">Scheduled: {new Date(row.manual_scheduled_at).toLocaleString()}</p>}
      {row?.manual_completed_at && <p className="mt-1 text-xs font-semibold text-emerald-700">Completed: {new Date(row.manual_completed_at).toLocaleString()}</p>}
      {message && <div className="mt-4 rounded-xl bg-emerald-100 p-3 text-sm font-bold text-emerald-800">{message}</div>}
      {error && <div className="mt-4 rounded-xl bg-rose-100 p-3 text-sm font-bold text-rose-800">{error}</div>}
    </section>
  );
}
