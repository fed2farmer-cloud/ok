import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type LoanApplication = {
  Id: number;
  created_at: string;
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

export default function Dashboard() {
  const [email, setEmail] = useState("");
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [marketplaceLoans, setMarketplaceLoans] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);

  useEffect(() => {
    loadDashboard();

    const timer = setInterval(() => {
      loadDashboard();
    }, 15000);

    return () => clearInterval(timer);
  }, []);

  async function loadDashboard() {
    if (!supabase) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    setEmail(user.email || "");

    const { data: appData } = await supabase
      .from("loan_applications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setApplications(appData || []);

    const appIds = (appData || []).map((app: any) => app.Id);

    if (appIds.length > 0) {
      const { data: marketData } = await supabase
        .from("marketplace_loans")
        .select("*")
        .in("loan_application_id", appIds);

      setMarketplaceLoans(marketData || []);

      const { data: docData } = await supabase
        .from("loan_documents")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setDocuments(docData || []);
    }
  }

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  function money(value: any) {
    return "$" + Number(value || 0).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  }

  function getMarketplaceLoan(applicationId: number) {
    return marketplaceLoans.find(
      (loan) => Number(loan.loan_application_id) === Number(applicationId)
    );
  }

  function getDocuments(applicationId: number) {
    return documents.filter(
      (doc) => Number(doc.loan_application_id) === Number(applicationId)
    );
  }

  function progressPercent(loan: any, app: LoanApplication) {
    const goal = Number(loan?.funding_goal || app.loan_amount || 0);
    const funded = Number(loan?.amount_funded || 0);

    if (!goal) return 0;

    return Math.min((funded / goal) * 100, 100);
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-green-700">
            Borrower Dashboard
          </h1>
          <p className="mt-2 text-gray-600">Welcome {email}</p>
        </div>

        <button
          onClick={logout}
          className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold"
        >
          Logout
        </button>
      </div>

      <div className="mt-8 bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-bold">Apply for a Land Loan</h2>
        <p className="mt-2 text-gray-600">
          Start a new land-backed loan application.
        </p>

        <div className="flex flex-wrap gap-3 mt-4">
          <button
            onClick={() => (window.location.href = "/loan-application")}
            className="bg-green-600 text-white px-6 py-3 rounded-lg"
          >
            New Application
          </button>

          <button
            onClick={() => (window.location.href = "/loan-documents")}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg"
          >
            Upload Loan Documents
          </button>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-bold">My Applications</h2>

        {applications.length === 0 ? (
          <div className="mt-4 bg-white rounded-xl shadow p-6">
            No applications yet.
          </div>
        ) : (
          <div className="mt-4 grid gap-4">
            {applications.map((app) => {
              const marketLoan = getMarketplaceLoan(app.Id);
              const docs = getDocuments(app.Id);

              const goal = Number(
                marketLoan?.funding_goal || app.loan_amount || 0
              );
              const funded = Number(marketLoan?.amount_funded || 0);
              const remaining = Number(
                marketLoan?.amount_remaining || Math.max(goal - funded, 0)
              );
              const percent = progressPercent(marketLoan, app);

              return (
                <div key={app.Id} className="bg-white rounded-xl shadow p-6">
                  <div className="flex justify-between gap-4">
                    <h3 className="text-xl font-bold">
                      {app.business_name || app.full_name || "Loan Application"}
                    </h3>

                    <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-bold">
                      {marketLoan?.status || app.status || "Pending"}
                    </span>
                  </div>

                  <div className="mt-4 grid md:grid-cols-2 gap-4 text-gray-700">
                    <div>
                      <p><strong>Requested Loan:</strong> {money(app.loan_amount)}</p>
                      <p><strong>Repayment Term:</strong> {app.repayment_term_months || 36} months</p>
                      <p><strong>Interest Rate:</strong> {app.interest_rate_percent || 9}%</p>
                      <p><strong>Land Value:</strong> {money(app.land_value)}</p>
                    </div>

                    <div>
                      <p><strong>Land Type:</strong> {app.land_type || "Not provided"}</p>
                      <p><strong>Acres:</strong> {app.acreage || "Not provided"}</p>
                      <p><strong>State:</strong> {app.state || "Not provided"}</p>
                      <p>
                        <strong>Submitted:</strong>{" "}
                        {app.created_at
                          ? new Date(app.created_at).toLocaleDateString()
                          : "Unknown"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 bg-gray-50 border rounded-lg p-4">
                    <h4 className="text-lg font-bold text-green-700">
                      Loan Funding Progress
                    </h4>

                    {marketLoan ? (
                      <>
                        <div className="mt-3 flex justify-between text-sm">
                          <span>{money(funded)} funded</span>
                          <span>{percent.toFixed(2)}%</span>
                        </div>

                        <div className="w-full bg-gray-200 rounded-full h-4 mt-2">
                          <div
                            className="bg-green-600 h-4 rounded-full"
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        <div className="grid md:grid-cols-3 gap-3 mt-4">
                          <div>
                            <p className="text-gray-500">Funding Goal</p>
                            <p className="font-bold">{money(goal)}</p>
                          </div>

                          <div>
                            <p className="text-gray-500">Amount Funded</p>
                            <p className="font-bold">{money(funded)}</p>
                          </div>

                          <div>
                            <p className="text-gray-500">Remaining</p>
                            <p className="font-bold">{money(remaining)}</p>
                          </div>
                        </div>

                        {marketLoan.status === "Funded" && (
                          <p className="mt-4 text-green-700 font-bold">
                            Funding complete. Your loan is ready for the next
                            disbursement step.
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="mt-2 text-gray-600">
                        This loan has not been published to the investor
                        marketplace yet.
                      </p>
                    )}
                  </div>

                  <div className="mt-6 bg-gray-50 border rounded-lg p-4">
                    <h4 className="text-lg font-bold">Submitted Documents</h4>

                    {docs.length === 0 ? (
                      <p className="mt-2 text-gray-600">
                        No documents uploaded yet.
                      </p>
                    ) : (
                      <div className="mt-3 grid gap-2">
                        {docs.map((doc) => (
                          <div
                            key={doc.id}
                            className="border bg-white rounded p-3"
                          >
                            <p>
                              <strong>{doc.document_type}</strong>
                            </p>
                            <p className="text-sm text-gray-600">
                              {doc.file_name}
                            </p>
                          </div>
                        ))}
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
  );
}