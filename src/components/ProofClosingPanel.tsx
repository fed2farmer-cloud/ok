import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type ProofStatus = {
  configured: boolean;
  enabled: boolean;
  environment: "fairfax" | "production";
  allowPlaceOrder?: boolean;
  transaction?: {
    status?: string | null;
    eligibility_status?: string | null;
    proof_transaction_id?: string | null;
    proof_transaction_status?: string | null;
    property_supported?: boolean | null;
    notarized_at?: string | null;
    released_at?: string | null;
    last_error?: string | null;
    documents_uploaded?: number | null;
  } | null;
};

async function getToken() {
  if (!supabase) return "";
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

function pretty(value?: string | null) {
  return String(value || "not started").replaceAll("_", " ");
}

export default function ProofClosingPanel({ loanId }: { loanId: string }) {
  const [status, setStatus] = useState<ProofStatus | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    if (!loanId) return;
    setError("");
    try {
      const token = await getToken();
      if (!token) return;
      const response = await fetch(`/api/proof-closing?loanId=${encodeURIComponent(loanId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || "Unable to load Proof closing status.");
      setStatus(body);
    } catch (e: any) {
      setError(e?.message || "Unable to load Proof closing status.");
    }
  }

  useEffect(() => { void load(); }, [loanId]);

  async function run(action: "check_eligibility" | "create_transaction" | "upload_documents" | "place_order" | "refresh") {
    setBusy(action); setError(""); setMessage("");
    try {
      const token = await getToken();
      if (!token) throw new Error("Please sign in again.");
      const response = await fetch("/api/proof-closing", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, loanId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || "Proof closing request failed.");
      setMessage(body?.message || "Proof closing updated.");
      await load();
    } catch (e: any) {
      setError(e?.message || "Proof closing request failed.");
    } finally {
      setBusy("");
    }
  }

  const row = status?.transaction;
  const hasTransaction = Boolean(row?.proof_transaction_id);
  const eligible = row?.property_supported === true;

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Remote online notarization</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">Proof closing</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Identity verification, remote notary workflow, and closing status tracking. County recording remains a separate required step.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${status?.environment === "production" ? "bg-rose-100 text-rose-800" : "bg-sky-100 text-sky-800"}`}>
          Proof {status?.environment || "fairfax"}
        </span>
      </div>

      {!status?.configured && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Proof is installed in SecuredLanding but no server API key is configured yet. Add the Proof Fairfax/test credentials before running Loan 460109 through the sandbox.
        </div>
      )}
      {status?.configured && !status.enabled && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Proof credentials are present, but transaction creation is intentionally disabled. Set <strong>PROOF_ENABLED=true</strong> when you are ready to test.
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Status label="Property eligibility" value={eligible ? "Supported" : pretty(row?.eligibility_status)} good={eligible} />
        <Status label="Proof transaction" value={hasTransaction ? "Created" : "Not created"} good={hasTransaction} />
        <Status label="Notary status" value={pretty(row?.proof_transaction_status || row?.status)} good={Boolean(row?.notarized_at)} />
        <Status label="Documents sent" value={String(row?.documents_uploaded || 0)} good={Number(row?.documents_uploaded || 0) > 0} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button disabled={!status?.configured || Boolean(busy)} onClick={() => void run("check_eligibility")} className="rounded-xl border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-800 disabled:cursor-not-allowed disabled:opacity-40">
          {busy === "check_eligibility" ? "Checking…" : "Check RON eligibility"}
        </button>
        <button disabled={!status?.configured || !status?.enabled || !eligible || hasTransaction || Boolean(busy)} onClick={() => void run("create_transaction")} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
          {busy === "create_transaction" ? "Creating…" : "Create Proof draft"}
        </button>
        <button disabled={!hasTransaction || Boolean(busy)} onClick={() => void run("upload_documents")} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
          {busy === "upload_documents" ? "Sending…" : "Send approved PDFs"}
        </button>
        <button disabled={!hasTransaction || !status?.allowPlaceOrder || Boolean(busy)} onClick={() => void run("place_order")} className="rounded-xl border border-slate-950 px-4 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
          {busy === "place_order" ? "Sending…" : "Send to Proof closing team"}
        </button>
        <button disabled={!hasTransaction || Boolean(busy)} onClick={() => void run("refresh")} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-40">
          Refresh status
        </button>
      </div>

      {row?.proof_transaction_id && <p className="mt-4 break-all text-xs text-slate-500">Proof transaction ID: {row.proof_transaction_id}</p>}
      {row?.released_at && <p className="mt-2 text-sm font-bold text-emerald-700">✓ Proof released the completed documents. Recording must still be confirmed separately.</p>}
      {row?.last_error && <div className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">Last Proof error: {row.last_error}</div>}
      {message && <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</div>}
      {error && <div className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div>}
    </section>
  );
}

function Status({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-1 font-black capitalize ${good ? "text-emerald-700" : "text-slate-900"}`}>{value}</p></div>;
}
