import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type LoanApplication = {
  Id?: number;
  id?: number;
  user_id?: string;
  created_at: string | null;
  business_name: string | null;
  full_name: string | null;
  state: string | null;
  land_type: string | null;
  acreage: number | null;
  land_value: number | null;
  loan_amount: number | null;
  status: string | null;
  repayment_term_months: number | null;
  interest_rate_percent: number | null;
};

type MarketplaceLoan = {
  id: number;
  loan_application_id: number | null;
  business_name?: string | null;
  funding_goal?: number | null;
  loan_amount?: number | null;
  amount_funded?: number | null;
  amount_remaining?: number | null;
  status?: string | null;
  created_at?: string | null;
};

type LoanDocument = {
  id: string;
  user_id?: string | null;
  loan_id?: number | null;
  loan_application_id?: number | null;
  document_type?: string | null;
  file_name?: string | null;
  file_url?: string | null;
  public_url?: string | null;
  storage_path?: string | null;
  created_at?: string | null;
};

export default function Dashboard() {
  const [email, setEmail] = useState("");
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [marketplaceLoans, setMarketplaceLoans] = useState<MarketplaceLoan[]>(
    []
  );
  const [documents, setDocuments] = useState<LoanDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  function applicationId(application: LoanApplication) {
    return Number(application.Id ?? application.id ?? 0);
  }

  const loadDashboard = useCallback(async (silent = false) => {
    if (!supabase) {
      setErrorMessage("Supabase is not configured.");
      setLoading(false);
      return;
    }

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        window.location.href = "/login";
        return;
      }

      setEmail(user.email || "");

      const { data: applicationData, error: applicationError } = await supabase
        .from("loan_applications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (applicationError) {
        throw applicationError;
      }

      const borrowerApplications =
        (applicationData as LoanApplication[] | null) || [];

      setApplications(borrowerApplications);

      const applicationIds = borrowerApplications
        .map(applicationId)
        .filter((id) => Number.isFinite(id) && id > 0);

      if (applicationIds.length === 0) {
        setMarketplaceLoans([]);
        setDocuments([]);
        setLastUpdated(new Date());
        return;
      }

      /*
       * Load marketplace records that belong to this borrower's applications.
       * The loan application table uses "Id" in your current database, while
       * marketplace_loans uses "loan_application_id".
       */
      const { data: marketplaceData, error: marketplaceError } = await supabase
        .from("marketplace_loans")
        .select("*")
        .in("loan_application_id", applicationIds)
        .order("created_at", { ascending: false });

      if (marketplaceError) {
        console.error("Marketplace loan error:", marketplaceError);
      }

      setMarketplaceLoans(
        (marketplaceData as MarketplaceLoan[] | null) || []
      );

      /*
       * Your uploaded-document screen currently saves the application number
       * as loan_id. Loading by user_id also keeps this compatible if the table
       * later adds loan_application_id.
       */
      const { data: documentData, error: documentError } = await supabase
        .from("loan_documents")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (documentError) {
        console.error("Loan document error:", documentError);
      }

      setDocuments((documentData as LoanDocument[] | null) || []);
      setLastUpdated(new Date());
    } catch (error: any) {
      console.error("Dashboard loading error:", error);
      setErrorMessage(error?.message || "Unable to load the dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();

    const refreshTimer = window.setInterval(() => {
      loadDashboard(true);
    }, 15000);

    return () => {
      window.clearInterval(refreshTimer);
    };
  }, [loadDashboard]);

  async function logout() {
    if (!supabase) return;

    await supabase.auth.signOut();
    window.location.href = "/";
  }

  function money(value: unknown) {
    return Number(value || 0).toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  function date(value?: string | null) {
    if (!value) return "Unknown";

    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Unknown";
    }

    return parsedDate.toLocaleDateString();
  }

  function getMarketplaceLoan(application: LoanApplication) {
    const appId = applicationId(application);

    return marketplaceLoans.find(
      (loan) => Number(loan.loan_application_id) === appId
    );
  }

  function getDocuments(application: LoanApplication) {
    const appId = applicationId(application);

    return documents.filter((document) => {
      const linkedLoanId = Number(
        document.loan_application_id ?? document.loan_id ?? 0
      );

      return linkedLoanId === appId;
    });
  }

  function fundingValues(
    application: LoanApplication,
    marketplaceLoan?: MarketplaceLoan
  ) {
    const goal = Number(
      marketplaceLoan?.funding_goal ??
        marketplaceLoan?.loan_amount ??
        application.loan_amount ??
        0
    );

    const funded = Number(marketplaceLoan?.amount_funded || 0);

    const calculatedRemaining = Math.max(goal - funded, 0);

    const remaining =
      marketplaceLoan?.amount_remaining === null ||
      marketplaceLoan?.amount_remaining === undefined
        ? calculatedRemaining
        : Math.max(Number(marketplaceLoan.amount_remaining), 0);

    const percentage =
      goal > 0 ? Math.min(Math.max((funded / goal) * 100, 0), 100) : 0;

    return {
      goal,
      funded,
      remaining,
      percentage,
    };
  }

  function statusClasses(status?: string | null) {
    const normalizedStatus = String(status || "Pending").toLowerCase();

    if (
      normalizedStatus === "funded" ||
      normalizedStatus === "approved" ||
      normalizedStatus === "active"
    ) {
      return "bg-green-100 text-green-800";
    }

    if (
      normalizedStatus === "denied" ||
      normalizedStatus === "rejected" ||
      normalizedStatus === "defaulted"
    ) {
      return "bg-red-100 text-red-800";
    }

    if (
      normalizedStatus === "open" ||
      normalizedStatus === "published" ||
      normalizedStatus === "funding"
    ) {
      return "bg-blue-100 text-blue-800";
    }

    return "bg-yellow-100 text-yellow-800";
  }

  const totalRequested = useMemo(
    () =>
      applications.reduce(
        (total, application) => total + Number(application.loan_amount || 0),
        0
      ),
    [applications]
  );

  const totalFunded = useMemo(
    () =>
      marketplaceLoans.reduce(
        (total, loan) => total + Number(loan.amount_funded || 0),
        0
      ),
    [marketplaceLoans]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <p className="text-xl">Loading borrower dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-green-700">
              Borrower Dashboard
            </h1>

            <p className="mt-2 text-gray-600">Welcome {email}</p>

            {lastUpdated && (
              <p className="mt-1 text-xs text-gray-500">
                Last updated: {lastUpdated.toLocaleTimeString()}
                {refreshing ? " · Refreshing..." : ""}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadDashboard()}
              disabled={refreshing}
              className="rounded-lg bg-gray-700 px-4 py-2 font-bold text-white disabled:opacity-50"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              type="button"
              onClick={logout}
              className="rounded-lg bg-red-600 px-4 py-2 font-bold text-white"
            >
              Logout
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">Applications</p>
            <p className="mt-1 text-2xl font-bold">{applications.length}</p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">Total Requested</p>
            <p className="mt-1 text-2xl font-bold">
              {money(totalRequested)}
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">Total Funded</p>
            <p className="mt-1 text-2xl font-bold text-green-700">
              {money(totalFunded)}
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-bold">Apply for a Land Loan</h2>

          <p className="mt-2 text-gray-600">
            Start a new application or upload documents for an existing loan.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                window.location.href = "/loan-application";
              }}
              className="rounded-lg bg-green-600 px-6 py-3 font-bold text-white"
            >
              New Application
            </button>

            <button
              type="button"
              onClick={() => {
                window.location.href = "/loan-documents";
              }}
              className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white"
            >
              Upload Loan Documents
            </button>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-2xl font-bold">My Applications</h2>

          {applications.length === 0 ? (
            <div className="mt-4 rounded-xl bg-white p-6 shadow">
              No applications yet.
            </div>
          ) : (
            <div className="mt-4 grid gap-6">
              {applications.map((application) => {
                const appId = applicationId(application);
                const marketplaceLoan = getMarketplaceLoan(application);
                const applicationDocuments = getDocuments(application);

                const { goal, funded, remaining, percentage } = fundingValues(
                  application,
                  marketplaceLoan
                );

                const displayedStatus =
                  marketplaceLoan?.status ||
                  application.status ||
                  "Pending";

                return (
                  <div
                    key={appId}
                    className="rounded-xl bg-white p-5 shadow sm:p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-bold">
                          {application.business_name ||
                            application.full_name ||
                            "Loan Application"}
                        </h3>

                        <p className="mt-1 text-sm text-gray-500">
                          Application ID: {appId}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-sm font-bold ${statusClasses(
                          displayedStatus
                        )}`}
                      >
                        {displayedStatus}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-4 text-gray-700 sm:grid-cols-2">
                      <div className="space-y-1">
                        <p>
                          <strong>Requested Loan:</strong>{" "}
                          {money(application.loan_amount)}
                        </p>

                        <p>
                          <strong>Repayment Term:</strong>{" "}
                          {application.repayment_term_months || 36} months
                        </p>

                        <p>
                          <strong>Interest Rate:</strong>{" "}
                          {application.interest_rate_percent || 9}%
                        </p>

                        <p>
                          <strong>Land Value:</strong>{" "}
                          {money(application.land_value)}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p>
                          <strong>Land Type:</strong>{" "}
                          {application.land_type || "Not provided"}
                        </p>

                        <p>
                          <strong>Acres:</strong>{" "}
                          {application.acreage ?? "Not provided"}
                        </p>

                        <p>
                          <strong>State:</strong>{" "}
                          {application.state || "Not provided"}
                        </p>

                        <p>
                          <strong>Submitted:</strong>{" "}
                          {date(application.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 rounded-lg border bg-gray-50 p-4">
                      <h4 className="text-lg font-bold text-green-700">
                        Loan Funding Progress
                      </h4>

                      {marketplaceLoan ? (
                        <>
                          <div className="mt-4 flex justify-between gap-4 text-sm">
                            <span>{money(funded)} funded</span>
                            <span className="font-bold">
                              {percentage.toFixed(2)}%
                            </span>
                          </div>

                          <div
                            className="mt-2 h-4 w-full overflow-hidden rounded-full bg-gray-200"
                            role="progressbar"
                            aria-valuenow={percentage}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          >
                            <div
                              className="h-4 rounded-full bg-green-600 transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-lg bg-white p-3">
                              <p className="text-sm text-gray-500">
                                Funding Goal
                              </p>
                              <p className="font-bold">{money(goal)}</p>
                            </div>

                            <div className="rounded-lg bg-white p-3">
                              <p className="text-sm text-gray-500">
                                Amount Funded
                              </p>
                              <p className="font-bold text-green-700">
                                {money(funded)}
                              </p>
                            </div>

                            <div className="rounded-lg bg-white p-3">
                              <p className="text-sm text-gray-500">
                                Amount Remaining
                              </p>
                              <p className="font-bold">{money(remaining)}</p>
                            </div>
                          </div>

                          {percentage >= 100 ||
                          String(marketplaceLoan.status).toLowerCase() ===
                            "funded" ? (
                            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 font-bold text-green-700">
                              Funding complete. Your loan is ready for the
                              disbursement-review stage.
                            </div>
                          ) : (
                            <p className="mt-4 text-sm text-gray-600">
                              Your funding information automatically refreshes
                              every 15 seconds.
                            </p>
                          )}
                        </>
                      ) : (
                        <div className="mt-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-yellow-800">
                          This application has not been linked to a marketplace
                          listing. The marketplace record must use loan
                          application ID <strong>{appId}</strong>.
                        </div>
                      )}
                    </div>

                    <div className="mt-6 rounded-lg border bg-gray-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h4 className="text-lg font-bold">
                          Submitted Documents
                        </h4>

                        <button
                          type="button"
                          onClick={() => {
                            window.location.href = `/loan-documents?loanId=${appId}`;
                          }}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white"
                        >
                          Upload Document
                        </button>
                      </div>

                      {applicationDocuments.length === 0 ? (
                        <p className="mt-3 text-gray-600">
                          No documents uploaded for this application yet.
                        </p>
                      ) : (
                        <div className="mt-3 grid gap-3">
                          {applicationDocuments.map((document) => {
                            const documentUrl =
                              document.file_url || document.public_url || "";

                            return (
                              <div
                                key={document.id}
                                className="rounded-lg border bg-white p-3"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <p className="font-bold capitalize">
                                      {document.document_type
                                        ?.replaceAll("_", " ")
                                        .replaceAll("-", " ") ||
                                        "Loan document"}
                                    </p>

                                    <p className="mt-1 break-all text-sm text-gray-600">
                                      {document.file_name ||
                                        document.storage_path ||
                                        "Uploaded file"}
                                    </p>

                                    <p className="mt-1 text-xs text-gray-500">
                                      Uploaded: {date(document.created_at)}
                                    </p>
                                  </div>

                                  {documentUrl && (
                                    <a
                                      href={documentUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-bold text-white"
                                    >
                                      View
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}