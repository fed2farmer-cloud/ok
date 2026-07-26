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
          <p className="text-sm font-bold