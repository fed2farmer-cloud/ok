import { FormEvent, useEffect, useState } from "react";
import {
  getCurrentAuthContext,
  getSupabaseErrorMessage,
  supabase,
} from "./lib/supabase";
import AppLayout from "./components/AppLayout";

type LoanApplication = {
  id: string;
  business_name?: string | null;
  full_name?: string | null;
  loan_amount?: number | null;
};

type LoanDocument = {
  id: string;
  user_id: string;
  loan_id?: string | null;
  loan_application_id?: string | null;
  application_id?: string | null;
  document_type: string;
  file_name: string;
  storage_path?: string | null;
  file_url?: string | null;
  status?: string | null;
  created_at?: string | null;
  view_url?: string;
};

export default function LoanDocuments() {
  const [loanId, setLoanId] = useState("");
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [documentType, setDocumentType] = useState("deed");
  const [file, setFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<LoanDocument[]>([]);

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [apn, setApn] = useState("");
  const [county, setCounty] = useState("");
  const [state, setState] = useState("CA");
  const [landRecord, setLandRecord] = useState<any>(null);
  const [landLoading, setLandLoading] = useState(false);

  useEffect(() => {
    initializePage();
  }, []);

  function getApplicationId(application: LoanApplication) {
    return application.id;
  }

  function getDocumentLoanId(document: LoanDocument) {
    return document.loan_application_id ?? document.loan_id ?? document.application_id ?? "";
  }

  function formatMoney(value: unknown) {
    return Number(value || 0).toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
  }

  function formatDate(value?: string | null) {
    if (!value) return "Unknown";

    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime())
      ? "Unknown"
      : parsed.toLocaleDateString();
  }

  function formatDocumentType(value: string) {
    return value.replaceAll("_", " ").replaceAll("-", " ");
  }

  async function initializePage() {
    if (!supabase) {
      setErrorMessage("Supabase is not configured.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    let userId = "";

    try {
      const { user } = await getCurrentAuthContext();
      userId = user.id;
    } catch {
      window.location.href = "/login";
      return;
    }

    const queryParams = new URLSearchParams(window.location.search);
    const requestedLoanId = queryParams.get("loanId") || "";

    const { data: applicationData, error: applicationError } = await supabase
      .from("loan_applications")
      .select("id, business_name, full_name, loan_amount")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (applicationError) {
      console.error("Loan application load failed:", applicationError);
      setErrorMessage(
        getSupabaseErrorMessage(
          applicationError,
          "Unable to load your loan applications."
        )
      );
      setLoading(false);
      return;
    }

    const borrowerApplications =
      (applicationData as LoanApplication[] | null) || [];

    setApplications(borrowerApplications);

    if (
      requestedLoanId &&
      borrowerApplications.some(
        (application) => getApplicationId(application) === requestedLoanId
      )
    ) {
      setLoanId(requestedLoanId);
    } else if (borrowerApplications.length === 1) {
      setLoanId(String(getApplicationId(borrowerApplications[0])));
    } else if (requestedLoanId) {
      setErrorMessage(
        "The requested loan application was not found or does not belong to your account. Please choose a loan below."
      );
    }

    await loadDocuments(userId);
    setLoading(false);
  }

  async function getOwnedApplication(userId: string, applicationId: string) {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from("loan_applications")
      .select("id, business_name, full_name, loan_amount")
      .eq("id", applicationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data as LoanApplication | null) || null;
  }

  async function loadDocuments(userId?: string) {
    if (!supabase) return;

    let resolvedUserId = userId;

    if (!resolvedUserId) {
      try {
        const { user } = await getCurrentAuthContext();
        resolvedUserId = user.id;
      } catch {
        window.location.href = "/login";
        return;
      }
    }

    const { data, error } = await supabase
      .from("loan_documents")
      .select("*")
      .eq("user_id", resolvedUserId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Loan document load failed:", error);
      setErrorMessage(
        getSupabaseErrorMessage(error, "Unable to load your documents.")
      );
      return;
    }

    const documentRows = (data as LoanDocument[] | null) || [];

    const documentsWithLinks = await Promise.all(
      documentRows.map(async (document) => {
        let viewUrl = document.file_url || "";

        if (document.storage_path) {
          const { data: signedUrlData } = await supabase!.storage
            .from("loan-documents")
            .createSignedUrl(document.storage_path, 60 * 60);

          if (signedUrlData?.signedUrl) {
            viewUrl = signedUrlData.signedUrl;
          }
        }

        return {
          ...document,
          view_url: viewUrl,
        };
      })
    );

    setDocuments(documentsWithLinks);
  }

  async function lookupLandRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLandRecord(null);
    setErrorMessage("");
    setLandLoading(true);

    try {
      const response = await fetch("/api/land-record", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apn: apn.trim(),
          county: county.trim(),
          state: state.trim().toUpperCase(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(result.error || "Land record lookup failed.");
        return;
      }

      setLandRecord(result);
    } catch {
      setErrorMessage("Unable to reach the land record service.");
    } finally {
      setLandLoading(false);
    }
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) return;

    setMessage("");
    setErrorMessage("");

    const selectedLoanId = loanId.trim();

    if (!selectedLoanId) {
      setErrorMessage("Select a loan application.");
      return;
    }

    if (!file) {
      setErrorMessage("Choose a document to upload.");
      return;
    }

    const maximumFileSize = 15 * 1024 * 1024;

    if (file.size > maximumFileSize) {
      setErrorMessage("The maximum document size is 15 MB.");
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setErrorMessage("Upload a PDF, JPG, PNG, or WebP file.");
      return;
    }

    setUploading(true);

    try {
      const { user } = await getCurrentAuthContext();
      const localApplication = applications.find(
        (application) => getApplicationId(application) === selectedLoanId
      );

      const ownedApplication =
        localApplication ??
        (await getOwnedApplication(user.id, selectedLoanId));

      if (!ownedApplication) {
        setErrorMessage("This loan application does not belong to your account.");
        return;
      }

      if (!localApplication) {
        setApplications((current) => [ownedApplication, ...current]);
      }

      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

      const filePath = [
        user.id,
        selectedLoanId,
        `${Date.now()}-${safeFileName}`,
      ].join("/");

      const { error: uploadError } = await supabase.storage
        .from("loan-documents")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { error: insertError } = await supabase
        .from("loan_documents")
        .insert({
          user_id: user.id,
          loan_application_id: selectedLoanId,
          document_type: documentType,
          file_name: file.name,
          storage_path: filePath,
          status: "submitted",
        });

      if (insertError) {
        await supabase.storage
          .from("loan-documents")
          .remove([filePath]);

        throw insertError;
      }

      setMessage("Document uploaded successfully.");
      setFile(null);

      const fileInput = document.getElementById(
        "loan-document-file"
      ) as HTMLInputElement | null;

      if (fileInput) {
        fileInput.value = "";
      }

      await loadDocuments(user.id);
    } catch (error: any) {
      console.error("Loan document upload failed:", error);
      setErrorMessage(
        getSupabaseErrorMessage(error, "Document upload failed.")
      );
    } finally {
      setUploading(false);
    }
  }

  const visibleDocuments = loanId
    ? documents.filter(
        (document) => getDocumentLoanId(document) === loanId
      )
    : documents;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <p className="text-xl">Loading loan documents...</p>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl py-8 px-4">
        <div className="rounded-xl bg-white p-5 shadow sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-green-700">
              Loan Documents & Land Records
            </h1>

            <p className="mt-2 text-gray-600">
              Verify the property and upload supporting loan documents.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              window.location.href = "/dashboard";
            }}
            className="rounded-lg bg-gray-700 px-4 py-2 font-bold text-white"
          >
            Back to Dashboard
          </button>
        </div>

        {errorMessage && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
            {errorMessage}
          </div>
        )}

        {message && (
          <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-3 font-bold text-green-700">
            {message}
          </div>
        )}

        <div className="mt-8 rounded-xl border bg-green-50 p-5">
          <h2 className="text-2xl font-bold text-green-700">
            Land Record Lookup
          </h2>

          <form onSubmit={lookupLandRecord} className="mt-4 space-y-4">
            <input
              placeholder="APN / Parcel Number"
              value={apn}
              onChange={(event) => setApn(event.target.value)}
              className="w-full rounded border p-3"
              required
            />

            <input
              placeholder="County"
              value={county}
              onChange={(event) => setCounty(event.target.value)}
              className="w-full rounded border p-3"
              required
            />

            <input
              placeholder="State"
              value={state}
              onChange={(event) =>
                setState(event.target.value.toUpperCase())
              }
              maxLength={2}
              className="w-full rounded border p-3"
              required
            />

            <button
              type="submit"
              disabled={landLoading}
              className="w-full rounded-lg bg-blue-600 py-3 font-bold text-white disabled:bg-gray-400"
            >
              {landLoading ? "Searching..." : "Search Land Records"}
            </button>
          </form>

          {landRecord && (
            <div className="mt-5 rounded border bg-white p-4 text-sm">
              <h3 className="mb-3 text-lg font-bold">
                Land Record Result
              </h3>

              {landRecord.property ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <p>
                    <strong>APN:</strong>{" "}
                    {landRecord.property.apn || "Not available"}
                  </p>

                  <p>
                    <strong>Owner:</strong>{" "}
                    {landRecord.property.owner || "Not available"}
                  </p>

                  <p>
                    <strong>County:</strong>{" "}
                    {landRecord.property.county || "Not available"}
                  </p>

                  <p>
                    <strong>State:</strong>{" "}
                    {landRecord.property.state || "Not available"}
                  </p>

                  <p>
                    <strong>Acreage:</strong>{" "}
                    {landRecord.property.acreage ?? "Not available"}
                  </p>

                  <p>
                    <strong>Estimated value:</strong>{" "}
                    {formatMoney(
                      landRecord.property.estimatedMarketValue
                    )}
                  </p>

                  <p>
                    <strong>Lien status:</strong>{" "}
                    {landRecord.property.lienStatus || "Not available"}
                  </p>

                  <p>
                    <strong>Maximum loan:</strong>{" "}
                    {formatMoney(landRecord.property.maxLoanAmount)}
                  </p>
                </div>
              ) : (
                <pre className="overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(landRecord, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>

        <form onSubmit={uploadDocument} className="mt-8 space-y-4">
          <div>
            <label className="mb-2 block font-bold text-gray-700">
              Loan application
            </label>

            <select
              value={loanId}
              onChange={(event) => setLoanId(event.target.value)}
              className="w-full rounded border p-3"
              required
            >
              <option value="">Select loan application</option>

              {applications.map((application) => {
                const applicationId = getApplicationId(application);

                return (
                  <option
                    key={applicationId}
                    value={applicationId}
                  >
                    #{applicationId} —{" "}
                    {application.business_name ||
                      application.full_name ||
                      "Loan Application"}{" "}
                    ({formatMoney(application.loan_amount)})
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="mb-2 block font-bold text-gray-700">
              Document type
            </label>

            <select
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value)}
              className="w-full rounded border p-3"
            >
              <option value="government_id">Government ID</option>
              <option value="deed">Land Deed / Title</option>
              <option value="tax_bill">Property Tax Bill</option>
              <option value="survey">Property Survey</option>
              <option value="appraisal">Appraisal</option>
              <option value="bank_statement">Bank Statement</option>
              <option value="tax_return">Tax Return</option>
              <option value="proof_of_income">Proof of Income</option>
              <option value="llc_documents">LLC Documents</option>
              <option value="land_api_record">Land API Record</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block font-bold text-gray-700">
              Select document
            </label>

            <input
              id="loan-document-file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(event) =>
                setFile(event.target.files?.[0] || null)
              }
              className="w-full rounded border p-3"
              required
            />

            <p className="mt-2 text-xs text-gray-500">
              Accepted formats: PDF, JPG, PNG and WebP. Maximum size: 15 MB.
            </p>
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="w-full rounded-lg bg-green-600 py-3 font-bold text-white disabled:bg-gray-400"
          >
            {uploading ? "Uploading..." : "Upload Document"}
          </button>
        </form>

        <div className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">Uploaded Documents</h2>

            <button
              type="button"
              onClick={() => loadDocuments()}
              className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-bold text-white"
            >
              Refresh
            </button>
          </div>

          {visibleDocuments.length === 0 ? (
            <div className="mt-4 rounded-lg border bg-gray-50 p-4 text-gray-600">
              No documents uploaded for the selected loan.
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {visibleDocuments.map((document) => (
                <div
                  key={document.id}
                  className="rounded-lg border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p>
                        <strong>Loan application:</strong>{" "}
                        {getDocumentLoanId(document)}
                      </p>

                      <p className="capitalize">
                        <strong>Type:</strong>{" "}
                        {formatDocumentType(document.document_type)}
                      </p>

                      <p className="break-all">
                        <strong>File:</strong> {document.file_name}
                      </p>

                      <p>
                        <strong>Status:</strong>{" "}
                        <span className="capitalize">
                          {document.status || "submitted"}
                        </span>
                      </p>

                      <p>
                        <strong>Uploaded:</strong>{" "}
                        {formatDate(document.created_at)}
                      </p>
                    </div>

                    {document.view_url && (
                      <a
                        href={document.view_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white"
                      >
                        View Document
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    </AppLayout>
  );
}
