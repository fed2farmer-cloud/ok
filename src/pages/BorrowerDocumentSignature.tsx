import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import SignaturePad from "../components/signatures/SignaturePad";
import { supabase } from "../lib/supabase";

type SignatureMethod = "typed" | "drawn";

type SignatureRequestRecord = {
  id: string;
  status: string;
  expires_at: string | null;
  generated_document_id: string;
  loan_application_id: string;
  signer_user_id: string;
  generated_loan_documents?: {
    id: string;
    document_type: string | null;
    file_name: string | null;
    file_url: string | null;
    public_url: string | null;
    storage_path: string | null;
    document_version: string | null;
    signature_status: string | null;
  } | null;
};

const CONSENT_VERSION = "v1";
const CONSENT_TEXT =
  "I consent to use an electronic signature and agree that my electronic signature has the same legal effect as a handwritten signature. I confirm that I reviewed the document and intend to sign it.";

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "string") return error;

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    for (const key of ["message", "details", "hint"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }

  return fallback;
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function BorrowerDocumentSignature() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();

  const [request, setRequest] = useState<SignatureRequestRecord | null>(null);
  const [legalName, setLegalName] = useState("");
  const [typedSignature, setTypedSignature] = useState("");
  const [drawnSignature, setDrawnSignature] = useState<string | null>(null);
  const [method, setMethod] = useState<SignatureMethod>("typed");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!supabase || !requestId) {
        setErrorMessage("The signature request is unavailable.");
        setLoading(false);
        return;
      }

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;
        if (!user) {
          navigate("/login", { replace: true });
          return;
        }

        const { data, error } = await supabase
          .from("document_signature_requests")
          .select(
            `
              id,
              status,
              expires_at,
              generated_document_id,
              loan_application_id,
              signer_user_id,
              generated_loan_documents (
                id,
                document_type,
                file_name,
                file_url,
                public_url,
                storage_path,
                document_version,
                signature_status
              )
            `
          )
          .eq("id", requestId)
          .eq("signer_user_id", user.id)
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error("Signature request not found.");

        if (!active) return;
        setRequest(data as SignatureRequestRecord);

        if (data.status === "pending") {
          await supabase.rpc("mark_signature_request_viewed", {
            p_signature_request_id: requestId,
          });
        }
      } catch (error: unknown) {
        if (!active) return;
        setErrorMessage(
          getErrorMessage(error, "Unable to load the signature request.")
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [navigate, requestId]);

  const documentUrl = useMemo(() => {
    const document = request?.generated_loan_documents;
    return document?.file_url || document?.public_url || null;
  }, [request]);

  const expired =
    Boolean(request?.expires_at) &&
    new Date(request!.expires_at as string).getTime() < Date.now();

  const canSubmit =
    Boolean(request) &&
    !expired &&
    ["pending", "viewed"].includes(request?.status || "") &&
    legalName.trim().length >= 2 &&
    consentAccepted &&
    reviewConfirmed &&
    (method === "typed"
      ? typedSignature.trim().length >= 2
      : Boolean(drawnSignature));

  async function submitSignature() {
    if (!supabase || !request || !canSubmit) return;

    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const consentHash = await sha256(
        `${CONSENT_VERSION}:${CONSENT_TEXT}`
      );

      const documentVersion =
        request.generated_loan_documents?.document_version || "1";

      const documentHash = await sha256(
        [
          request.generated_document_id,
          documentVersion,
          request.generated_loan_documents?.file_name || "",
          request.generated_loan_documents?.storage_path || "",
        ].join(":")
      );

      const { error } = await supabase.rpc(
        "complete_document_signature",
        {
          p_signature_request_id: request.id,
          p_signer_legal_name: legalName.trim(),
          p_signature_method: method,
          p_typed_signature:
            method === "typed" ? typedSignature.trim() : null,
          p_drawn_signature_data_url:
            method === "drawn" ? drawnSignature : null,
          p_consent_version: CONSENT_VERSION,
          p_consent_text_hash: consentHash,
          p_document_hash: documentHash,
          p_user_agent: navigator.userAgent,
        }
      );

      if (error) throw error;

      setSuccessMessage("Document signed successfully.");

      window.setTimeout(() => {
        navigate("/closing-center");
      }, 1000);
    } catch (error: unknown) {
      setErrorMessage(
        getErrorMessage(error, "The document could not be signed.")
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-4xl p-8">
          <div className="h-96 animate-pulse rounded-3xl bg-slate-800" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-400">
            SecuredLanding Closing Center
          </p>

          <h1 className="mt-2 text-4xl font-black text-white">
            Review and Sign Document
          </h1>

          <p className="mt-3 text-slate-400">
            Review the entire document before applying your electronic
            signature.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-5 rounded-2xl border border-rose-600/50 bg-rose-950/50 p-4 font-semibold text-rose-200">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-5 rounded-2xl border border-emerald-600/50 bg-emerald-950/50 p-4 font-semibold text-emerald-200">
            {successMessage}
          </div>
        )}

        {!request ? (
          <div className="rounded-3xl border border-slate-700 bg-slate-950 p-8 text-slate-300">
            This signature request is unavailable.
          </div>
        ) : (
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-700 bg-slate-950 p-6">
              <h2 className="text-2xl font-black text-white">
                {request.generated_loan_documents?.file_name ||
                  request.generated_loan_documents?.document_type ||
                  "Loan document"}
              </h2>

              <div className="mt-4 grid gap-3 text-sm text-slate-400 sm:grid-cols-2">
                <p>
                  Document version:{" "}
                  <strong className="text-slate-200">
                    {request.generated_loan_documents?.document_version || "1"}
                  </strong>
                </p>

                <p>
                  Status:{" "}
                  <strong className="capitalize text-slate-200">
                    {request.status.replaceAll("_", " ")}
                  </strong>
                </p>
              </div>

              {documentUrl ? (
                <div className="mt-5 overflow-hidden rounded-2xl border border-slate-700">
                  <iframe
                    title="Document preview"
                    src={documentUrl}
                    className="h-[65vh] min-h-[520px] w-full bg-white"
                  />
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-amber-700/50 bg-amber-950/30 p-5 text-amber-200">
                  The document preview URL is unavailable. Do not sign until the
                  document is accessible for review.
                </div>
              )}

              <label className="mt-5 flex items-start gap-3 rounded-xl border border-slate-700 p-4 text-slate-200">
                <input
                  type="checkbox"
                  checked={reviewConfirmed}
                  onChange={(event) => setReviewConfirmed(event.target.checked)}
                  className="mt-1 h-5 w-5"
                />

                <span>
                  I confirm that I opened and reviewed the complete document
                  before signing.
                </span>
              </label>
            </section>

            <section className="rounded-3xl border border-slate-700 bg-slate-950 p-6">
              <h2 className="text-2xl font-black text-white">
                Electronic Signature
              </h2>

              <label className="mt-5 block">
                <span className="font-bold text-slate-200">
                  Full legal name
                </span>

                <input
                  value={legalName}
                  onChange={(event) => setLegalName(event.target.value)}
                  autoComplete="name"
                  className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-white"
                  placeholder="Enter your full legal name"
                />
              </label>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setMethod("typed")}
                  className={`rounded-xl border px-4 py-3 font-bold ${
                    method === "typed"
                      ? "border-emerald-400 bg-emerald-950 text-emerald-300"
                      : "border-slate-700 bg-slate-900 text-slate-300"
                  }`}
                >
                  Type Signature
                </button>

                <button
                  type="button"
                  onClick={() => setMethod("drawn")}
                  className={`rounded-xl border px-4 py-3 font-bold ${
                    method === "drawn"
                      ? "border-emerald-400 bg-emerald-950 text-emerald-300"
                      : "border-slate-700 bg-slate-900 text-slate-300"
                  }`}
                >
                  Draw Signature
                </button>
              </div>

              {method === "typed" ? (
                <label className="mt-5 block">
                  <span className="font-bold text-slate-200">
                    Type your signature
                  </span>

                  <input
                    value={typedSignature}
                    onChange={(event) => setTypedSignature(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-4 font-serif text-3xl italic text-white"
                    placeholder="Your signature"
                  />
                </label>
              ) : (
                <div className="mt-5">
                  <SignaturePad onChange={setDrawnSignature} />
                </div>
              )}

              <label className="mt-6 flex items-start gap-3 rounded-xl border border-slate-700 p-4 text-slate-200">
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={(event) =>
                    setConsentAccepted(event.target.checked)
                  }
                  className="mt-1 h-5 w-5"
                />

                <span>{CONSENT_TEXT}</span>
              </label>

              {expired && (
                <div className="mt-5 rounded-xl border border-rose-700/50 bg-rose-950/40 p-4 text-rose-200">
                  This signature request has expired. Contact SecuredLanding for
                  a new request.
                </div>
              )}

              <button
                type="button"
                disabled={!canSubmit || submitting || !documentUrl}
                onClick={() => void submitSignature()}
                className="mt-6 w-full rounded-xl bg-emerald-600 py-4 text-xl font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-600"
              >
                {submitting ? "Applying Signature…" : "Sign Document"}
              </button>

              <p className="mt-3 text-center text-xs text-slate-500">
                Your signature, consent, document version, date, and audit
                details will be recorded.
              </p>
            </section>
          </div>
        )}
      </main>
    </AppLayout>
  );
}

export default BorrowerDocumentSignature;
