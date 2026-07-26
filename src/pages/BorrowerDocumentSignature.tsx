import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import SignaturePad from "../components/signatures/SignaturePad";
import { supabase } from "../lib/supabase";

type SignatureMethod = "typed" | "drawn";

type GeneratedLoanDocument = {
  id: number;
  document_type: string | null;
  document_name: string | null;
  storage_path: string | null;
  status: string | null;
  document_version: string | null;
  signature_status: string | null;
  title: string | null;
  terms_snapshot: Record<string, unknown> | null;
};

type SignatureRequestRecord = {
  id: string;
  status: string;
  expires_at: string | null;
  generated_document_id: number;
  loan_application_id: number;
  signer_user_id: string;
  generated_loan_documents: GeneratedLoanDocument | null;
};

const LOAN_DOCUMENTS_BUCKET = "loan-documents";
const CONSENT_VERSION = "v1";

const CONSENT_TEXT =
  "I consent to use an electronic signature and agree that my electronic signature has the same legal effect as a handwritten signature. I confirm that I reviewed the document and intend to sign it.";

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;

    for (const key of ["message", "details", "hint"]) {
      const value = record[key];

      if (typeof value === "string" && value.trim()) {
        return value;
      }
    }
  }

  return fallback;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function formatMoney(value: unknown): string {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) {
    return "$0.00";
  }

  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function getTermValue(
  terms: Record<string, unknown>,
  key: string
): unknown {
  return terms[key];
}

function getDocumentName(
  document: GeneratedLoanDocument | null
): string {
  if (!document) return "Loan Document";

  return (
    document.title ||
    document.document_name ||
    document.document_type?.replaceAll("_", " ") ||
    "Loan Document"
  );
}

function BorrowerDocumentSignature() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();

  const [request, setRequest] =
    useState<SignatureRequestRecord | null>(null);

  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentLoading, setDocumentLoading] = useState(false);

  const [legalName, setLegalName] = useState("");
  const [typedSignature, setTypedSignature] = useState("");
  const [drawnSignature, setDrawnSignature] =
    useState<string | null>(null);

  const [method, setMethod] =
    useState<SignatureMethod>("typed");

  const [consentAccepted, setConsentAccepted] = useState(false);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSignatureRequest() {
      if (!supabase || !requestId) {
        setErrorMessage("The signature request is unavailable.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErrorMessage("");

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

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
                document_name,
                storage_path,
                status,
                document_version,
                signature_status,
                title,
                terms_snapshot
              )
            `
          )
          .eq("id", requestId)
          .eq("signer_user_id", user.id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!data) {
          throw new Error(
            "Signature request not found or it does not belong to this borrower."
          );
        }

        if (!active) return;

        const loadedRequest = data as SignatureRequestRecord;
        setRequest(loadedRequest);

        if (loadedRequest.status === "pending") {
          const { error: viewedError } = await supabase.rpc(
            "mark_signature_request_viewed",
            {
              p_signature_request_id: loadedRequest.id,
            }
          );

          if (
            viewedError &&
            !viewedError.message
              .toLowerCase()
              .includes("could not find the function")
          ) {
            console.warn(
              "Unable to mark signature request as viewed:",
              viewedError
            );
          }
        }
      } catch (error: unknown) {
        if (!active) return;

        setErrorMessage(
          getErrorMessage(
            error,
            "Unable to load the signature request."
          )
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSignatureRequest();

    return () => {
      active = false;
    };
  }, [navigate, requestId]);

  useEffect(() => {
    let active = true;

    async function loadDocument() {
      if (!supabase) return;

      const storagePath =
        request?.generated_loan_documents?.storage_path?.trim();

      setDocumentUrl(null);

      if (!storagePath) {
        return;
      }

      if (
        storagePath.startsWith("https://") ||
        storagePath.startsWith("http://")
      ) {
        setDocumentUrl(storagePath);
        return;
      }

      try {
        setDocumentLoading(true);

        const { data, error } = await supabase.storage
          .from(LOAN_DOCUMENTS_BUCKET)
          .createSignedUrl(storagePath, 60 * 60);

        if (error) {
          throw error;
        }

        if (!active) return;

        setDocumentUrl(data?.signedUrl ?? null);
      } catch (error: unknown) {
        if (!active) return;

        setErrorMessage(
          getErrorMessage(
            error,
            "The document file could not be opened."
          )
        );
      } finally {
        if (active) {
          setDocumentLoading(false);
        }
      }
    }

    void loadDocument();

    return () => {
      active = false;
    };
  }, [request]);

  const generatedDocument =
    request?.generated_loan_documents ?? null;

  const terms = useMemo<Record<string, unknown>>(
    () => generatedDocument?.terms_snapshot ?? {},
    [generatedDocument]
  );

  const expired =
    Boolean(request?.expires_at) &&
    new Date(request?.expires_at ?? "").getTime() < Date.now();

  const alreadySigned =
    request?.status === "signed" ||
    generatedDocument?.signature_status === "signed";

  const canSubmit =
    Boolean(request) &&
    !expired &&
    !alreadySigned &&
    ["pending", "viewed"].includes(request?.status ?? "") &&
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
        generatedDocument?.document_version || "1";

      const documentHash = await sha256(
        [
          request.generated_document_id,
          documentVersion,
          generatedDocument?.document_name || "",
          generatedDocument?.storage_path || "",
        ].join(":")
      );

      const { error } = await supabase.rpc(
        "complete_document_signature",
        {
          p_signature_request_id: request.id,
          p_signer_legal_name: legalName.trim(),
          p_signature_method: method,
          p_typed_signature:
            method === "typed"
              ? typedSignature.trim()
              : null,
          p_drawn_signature_data_url:
            method === "drawn"
              ? drawnSignature
              : null,
          p_consent_version: CONSENT_VERSION,
          p_consent_text_hash: consentHash,
          p_document_hash: documentHash,
          p_user_agent: navigator.userAgent,
        }
      );

      if (error) {
        throw error;
      }

      setSuccessMessage("Document signed successfully.");

      window.setTimeout(() => {
        navigate(
          `/closing-center?loanId=${request.loan_application_id}`
        );
      }, 1200);
    } catch (error: unknown) {
      setErrorMessage(
        getErrorMessage(
          error,
          "The document could not be signed."
        )
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <main className="mx-auto max-w-4xl px-4 py-10">
          <div className="h-96 animate-pulse rounded-3xl bg-slate-800" />
        </main>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <main className="mx-auto max-w-4xl px-4 py-10">
        <header className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-400">
            SecuredLanding Closing Center
          </p>

          <h1 className="mt-2 text-4xl font-black text-white">
            Review and Sign Document
          </h1>

          <p className="mt-3 text-slate-400">
            Review the entire document before applying your
            electronic signature.
          </p>
        </header>

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
              <h2 className="text-2xl font-black capitalize text-white">
                {getDocumentName(generatedDocument)}
              </h2>

              <div className="mt-4 grid gap-3 text-sm text-slate-400 sm:grid-cols-2">
                <p>
                  Document version:{" "}
                  <strong className="text-slate-200">
                    {generatedDocument?.document_version || "1"}
                  </strong>
                </p>

                <p>
                  Status:{" "}
                  <strong className="capitalize text-slate-200">
                    {(request.status || "pending").replaceAll(
                      "_",
                      " "
                    )}
                  </strong>
                </p>
              </div>

              {documentLoading && (
                <div className="mt-5 flex min-h-[300px] items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-slate-300">
                  Loading document…
                </div>
              )}

              {!documentLoading && documentUrl && (
                <div className="mt-5 overflow-hidden rounded-2xl border border-slate-700">
                  <iframe
                    title="Document preview"
                    src={documentUrl}
                    className="h-[65vh] min-h-[520px] w-full bg-white"
                  />
                </div>
              )}

              {!documentLoading && !documentUrl && (
                <div className="mt-5 rounded-2xl border border-slate-700 bg-white p-6 text-slate-900">
                  <h3 className="text-2xl font-black capitalize">
                    {getDocumentName(generatedDocument)}
                  </h3>

                  <p className="mt-2 text-sm text-slate-500">
                    Loan #
                    {String(
                      getTermValue(terms, "loan_number") ||
                        request.loan_application_id
                    )}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <DocumentField
                      label="Borrower"
                      value={getTermValue(
                        terms,
                        "borrower_name"
                      )}
                    />

                    <DocumentField
                      label="Business"
                      value={getTermValue(
                        terms,
                        "business_name"
                      )}
                    />

                    <DocumentField
                      label="Property"
                      value={getTermValue(
                        terms,
                        "property_address"
                      )}
                    />

                    <DocumentField
                      label="APN"
                      value={getTermValue(terms, "apn")}
                    />

                    <DocumentField
                      label="Principal"
                      value={formatMoney(
                        getTermValue(
                          terms,
                          "approved_loan_amount"
                        ) ||
                          getTermValue(terms, "loan_amount")
                      )}
                    />

                    <DocumentField
                      label="Interest rate"
                      value={`${Number(
                        getTermValue(
                          terms,
                          "borrower_interest_rate"
                        ) || 0
                      )}%`}
                    />

                    <DocumentField
                      label="Term"
                      value={`${Number(
                        getTermValue(
                          terms,
                          "repayment_term_months"
                        ) || 0
                      )} months`}
                    />

                    <DocumentField
                      label="Monthly payment"
                      value={formatMoney(
                        getTermValue(
                          terms,
                          "monthly_payment"
                        )
                      )}
                    />
                  </div>

                  <p className="mt-6 leading-7 text-slate-700">
                    This generated closing document records the
                    approved loan terms shown above. State-specific
                    security instruments, notarization, and recording
                    requirements remain subject to final legal review.
                  </p>
                </div>
              )}

              <label className="mt-5 flex items-start gap-3 rounded-xl border border-slate-700 p-4 text-slate-200">
                <input
                  type="checkbox"
                  checked={reviewConfirmed}
                  disabled={alreadySigned}
                  onChange={(event) =>
                    setReviewConfirmed(event.target.checked)
                  }
                  className="mt-1 h-5 w-5"
                />

                <span>
                  I confirm that I opened and reviewed the complete
                  document before signing.
                </span>
              </label>
            </section>

            <section className="rounded-3xl border border-slate-700 bg-slate-950 p-6">
              <h2 className="text-2xl font-black text-white">
                Electronic Signature
              </h2>

              {alreadySigned ? (
                <div className="mt-5 rounded-2xl border border-emerald-500/40 bg-emerald-950/40 p-5 text-emerald-200">
                  This document has already been signed.
                </div>
              ) : (
                <>
                  <label className="mt-5 block">
                    <span className="font-bold text-slate-200">
                      Full legal name
                    </span>

                    <input
                      value={legalName}
                      onChange={(event) =>
                        setLegalName(event.target.value)
                      }
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
                        onChange={(event) =>
                          setTypedSignature(event.target.value)
                        }
                        className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-4 font-serif text-3xl italic text-white"
                        placeholder="Your signature"
                      />
                    </label>
                  ) : (
                    <div className="mt-5">
                      <SignaturePad
                        onChange={setDrawnSignature}
                      />
                    </div>
                  )}

                  <label className="mt-6 flex items-start gap-3 rounded-xl border border-slate-700 p-4 text-slate-200">
        