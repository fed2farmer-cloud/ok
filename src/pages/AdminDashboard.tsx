import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type LoanApplication = {
  id: number;
  user_id?: string | null;
  created_at?: string | null;
  business_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  apn?: string | null;
  property_address?: string | null;
  state?: string | null;
  acreage?: number | null;
  land_value?: number | null;
  loan_amount?: number | null;
  repayment_term_months?: number | null;
  status?: string | null;
  borrower_interest_rate?: number | null;
  investor_interest_rate?: number | null;
  company_spread_rate?: number | null;
  amount_funded?: number | null;
  amount_remaining?: number | null;
  risk_score?: string | null;
  underwriter_notes?: string | null;
  published_to_marketplace?: boolean | null;
};

type EditingValues = {
  borrower_interest_rate: number | string;
  investor_interest_rate: number | string;
  company_spread_rate: number;
  risk_score: string;
  underwriter_notes: string;
  published_to_marketplace: boolean;
};

export default function AdminDashboard() {
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [editing, setEditing] = useState<
    Record<number, EditingValues>
  >({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    if (!supabase) {
      setErrorMessage("Supabase is not configured.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "/login";
      return;
    }

    const { data: admin, error: adminError } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminError) {
      setErrorMessage(adminError.message);
      setLoading(false);
      return;
    }

    if (!admin) {
      alert("Access denied.");
      window.location.href = "/dashboard";
      return;
    }

    setAllowed(true);
    await loadApplications();
  }

  async function loadApplications() {
    if (!supabase) return;

    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("loan_applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const loans = (data as LoanApplication[] | null) || [];

    setApplications(loans);

    const formData: Record<number, EditingValues> = {};

    loans.forEach((loan) => {
      const borrowerRate = Number(
        loan.borrower_interest_rate ?? 10
      );
      const investorRate = Number(
        loan.investor_interest_rate ?? 9
      );

      formData[loan.id] = {
        borrower_interest_rate: borrowerRate,
        investor_interest_rate: investorRate,
        company_spread_rate: Number(
          loan.company_spread_rate ??
            borrowerRate - investorRate
        ),
        risk_score: loan.risk_score ?? "Pending",
        underwriter_notes: loan.underwriter_notes ?? "",
        published_to_marketplace:
          loan.published_to_marketplace ?? false,
      };
    });

    setEditing(formData);
    setLoading(false);
  }

  function money(value: unknown) {
    return Number(value || 0).toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  function monthlyPayment(
    amount: number,
    annualRate: number,
    months: number
  ) {
    if (!amount || !months) return 0;

    const monthlyRate = annualRate / 100 / 12;

    if (monthlyRate === 0) {
      return amount / months;
    }

    return (
      (amount * monthlyRate) /
      (1 - Math.pow(1 + monthlyRate, -months))
    );
  }

  function updateEdit(
    id: number,
    field: keyof EditingValues,
    value: string | number | boolean
  ) {
    setEditing((current) => ({
      ...current,
      [id]: {
        ...current[id],
        [field]: value,
      },
    }));
  }

  async function saveLoanTerms(id: number) {
    if (!supabase) return;

    setMessage("");
    setErrorMessage("");

    const loan = applications.find((item) => item.id === id);
    const values = editing[id];

    if (!loan || !values) {
      setErrorMessage("Loan data not found.");
      return;
    }

    const borrowerRate = Number(
      values.borrower_interest_rate || 0
    );
    const investorRate = Number(
      values.investor_interest_rate || 0
    );

    if (borrowerRate < 0 || investorRate < 0) {
      setErrorMessage("Interest rates cannot be negative.");
      return;
    }

    if (investorRate > borrowerRate) {
      setErrorMessage(
        "Investor rate cannot exceed the borrower rate."
      );
      return;
    }

    const spreadRate = Number(
      (borrowerRate - investorRate).toFixed(2)
    );

    const loanAmount = Number(loan.loan_amount || 0);
    const amountFunded = Number(loan.amount_funded || 0);
    const amountRemaining = Math.max(
      loanAmount - amountFunded,
      0
    );

    setSavingId(id);

    const { error: loanError } = await supabase
      .from("loan_applications")
      .update({
        borrower_interest_rate: borrowerRate,
        investor_interest_rate: investorRate,
        company_spread_rate: spreadRate,
        amount_funded: amountFunded,
        amount_remaining: amountRemaining,
        risk_score: values.risk_score,
        underwriter_notes: values.underwriter_notes,
        published_to_marketplace:
          values.published_to_marketplace,
      })
      .eq("id", id);

    if (loanError) {
      setErrorMessage(loanError.message);
      setSavingId(null);
      return;
    }

    if (values.published_to_marketplace) {
      const marketplacePayload = {
        loan_application_id: id,
        business_name:
          loan.business_name || "No Business Name",
        borrower_name: loan.full_name || "",
        apn: loan.apn || "",
        state: loan.state || "",
        acreage: Number(loan.acreage || 0),
        land_value: Number(loan.land_value || 0),
        loan_amount: loanAmount,
        borrower_interest_rate: borrowerRate,
        investor_interest_rate: investorRate,
        company_spread_rate: spreadRate,
        repayment_term_months: Number(
          loan.repayment_term_months || 36
        ),
        risk_score: values.risk_score,
        funding_goal: loanAmount,
        amount_funded: amountFunded,
        amount_remaining: amountRemaining,
        status:
          amountRemaining <= 0 ? "Funded" : "Open",
      };

      const { error: marketError } = await supabase
        .from("marketplace_loans")
        .upsert(marketplacePayload, {
          onConflict: "loan_application_id",
        });

      if (marketError) {
        setErrorMessage(
          `Marketplace publish failed: ${marketError.message}`
        );
        setSavingId(null);
        return;
      }
    } else {
      const { error: removeError } = await supabase
        .from("marketplace_loans")
        .delete()
        .eq("loan_application_id", id);

      if (removeError) {
        setErrorMessage(
          `Marketplace removal failed: ${removeError.message}`
        );
        setSavingId(null);
        return;
      }
    }

    setMessage(
      values.published_to_marketplace
        ? "Loan review saved and marketplace listing updated."
        : "Loan review saved and removed from the marketplace."
    );

    setSavingId(null);
    await loadApplications();
  }

  async function updateStatus(id: number, status: string) {
    if (!supabase) return;

    setMessage("");
    setErrorMessage("");
    setSavingId(id);

    const { error } = await supabase
      .from("loan_applications")
      .update({ status })
      .eq("id", id);

    if (error) {
      setErrorMessage(error.message);
      setSavingId(null);
      return;
    }

    const marketStatus =
      status === "Funded"
        ? "Funded"
        : status === "Denied"
          ? "Closed"
          : null;

    if (marketStatus) {
      await supabase
        .from("marketplace_loans")
        .update({ status: marketStatus })
        .eq("loan_application_id", id);
    }

    setMessage(`Loan status changed to ${status}.`);
    setSavingId(null);
    await loadApplications();
  }

  async function logout() {
    if (!supabase) return;

    await supabase.auth.signOut();
    window.location.href = "/";
  }

  function statusClasses(status?: string | null) {
    const normalized = String(
      status || "Pending"
    ).toLowerCase();

    if (
      normalized === "approved" ||
      normalized === "funded"
    ) {
      return "bg-green-100 text-green-800";
    }

    if (normalized === "denied") {
      return "bg-red-100 text-red-800";
    }

    return "bg-yellow-100 text-yellow-800";
  }

  if (loading || !allowed) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <p className="text-xl">Checking admin access...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-green-700">
              Admin Loan Review Center
            </h1>

            <p className="mt-2 text-gray-600">
              Review applications, set loan terms and publish
              approved loans.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                window.location.href = "/";
              }}
              className="rounded-lg bg-gray-700 px-5 py-3 font-bold text-white"
            >
              Home
            </button>

            <button
              type="button"
              onClick={logout}
              className="rounded-lg bg-red-600 px-5 py-3 font-bold text-white"
            >
              Logout
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {errorMessage}
          </div>
        )}

        {message && (
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 font-bold text-green-700">
            {message}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={loadApplications}
            className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white"
          >
            Refresh Applications
          </button>
        </div>

        {applications.length === 0 ? (
          <div className="mt-6 rounded-xl bg-white p-6 shadow">
            No loan applications found.
          </div>
        ) : (
          <div className="mt-6 grid gap-6">
            {applications.map((loan) => {
              const values = editing[loan.id];

              const loanAmount = Number(
                loan.loan_amount || 0
              );
              const landValue = Number(
                loan.land_value || 0
              );
              const term = Number(
                loan.repayment_term_months || 36
              );

              const borrowerRate = Number(
                values?.borrower_interest_rate ?? 10
              );
              const investorRate = Number(
                values?.investor_interest_rate ?? 9
              );

              const spread =
                borrowerRate - investorRate;

              const payment = monthlyPayment(
                loanAmount,
                borrowerRate,
                term
              );

              const totalRepayment = payment * term;
              const totalInterest =
                totalRepayment - loanAmount;

              const ltv =
                landValue > 0
                  ? (loanAmount / landValue) * 100
                  : 0;

              const isSaving = savingId === loan.id;

              return (
                <div
                  key={loan.id}
                  className="rounded-xl bg-white p-5 shadow sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-bold text-green-700">
                        {loan.business_name ||
                          "No Business Name"}
                      </h2>

                      <p className="mt-1 text-sm text-gray-500">
                        Application ID: {loan.id}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-sm font-bold ${statusClasses(
                        loan.status
                      )}`}
                    >
                      {loan.status || "Pending"}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-5 md:grid-cols-2">
                    <div>
                      <h3 className="text-lg font-bold">
                        Borrower
                      </h3>

                      <p>
                        <strong>Name:</strong>{" "}
                        {loan.full_name || "Not provided"}
                      </p>

                      <p>
                        <strong>Email:</strong>{" "}
                        {loan.email || "Not provided"}
                      </p>

                      <p>
                        <strong>Phone:</strong>{" "}
                        {loan.phone || "Not provided"}
                      </p>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold">
                        Property
                      </h3>

                      <p>
                        <strong>APN:</strong>{" "}
                        {loan.apn || "Not provided"}
                      </p>

                      <p>
                        <strong>Address:</strong>{" "}
                        {loan.property_address ||
                          "Not provided"}
                      </p>

                      <p>
                        <strong>State:</strong>{" "}
                        {loan.state || "Not provided"}
                      </p>

                      <p>
                        <strong>Acres:</strong>{" "}
                        {loan.acreage ?? "Not provided"}
                      </p>

                      <p>
                        <strong>Land Value:</strong>{" "}
                        {money(landValue)}
                      </p>

                      <p>
                        <strong>LTV:</strong>{" "}
                        {ltv.toFixed(2)}%
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-lg border bg-gray-50 p-4">
                    <h3 className="mb-2 text-lg font-bold">
                      Loan Terms
                    </h3>

                    <p>
                      <strong>Requested Loan:</strong>{" "}
                      {money(loanAmount)}
                    </p>

                    <p>
                      <strong>Term:</strong> {term} months
                    </p>

                    <p>
                      <strong>
                        Monthly Borrower Payment:
                      </strong>{" "}
                      {money(payment)}
                    </p>

                    <p>
                      <strong>Total Repayment:</strong>{" "}
                      {money(totalRepayment)}
                    </p>

                    <p>
                      <strong>Total Interest:</strong>{" "}
                      {money(totalInterest)}
                    </p>

                    <p>
                      <strong>Company Spread:</strong>{" "}
                      {spread.toFixed(2)}%
                    </p>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <label>
                      <span className="font-bold">
                        Borrower Rate %
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          values?.borrower_interest_rate ??
                          ""
                        }
                        onChange={(event) =>
                          updateEdit(
                            loan.id,
                            "borrower_interest_rate",
                            event.target.value
                          )
                        }
                        className="mt-1 w-full rounded border p-3"
                      />
                    </label>

                    <label>
                      <span className="font-bold">
                        Investor Rate %
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          values?.investor_interest_rate ??
                          ""
                        }
                        onChange={(event) =>
                          updateEdit(
                            loan.id,
                            "investor_interest_rate",
                            event.target.value
                          )
                        }
                        className="mt-1 w-full rounded border p-3"
                      />
                    </label>

                    <label>
                      <span className="font-bold">
                        Risk Score
                      </span>

                      <select
                        value={
                          values?.risk_score ?? "Pending"
                        }
                        onChange={(event) =>
                          updateEdit(
                            loan.id,
                            "risk_score",
                            event.target.value
                          )
                        }
                        className="mt-1 w-full rounded border p-3"
                      >
                        <option value="Pending">
                          Pending
                        </option>
                        <option value="Low">Low</option>
                        <option value="Medium">
                          Medium
                        </option>
                        <option value="High">High</option>
                      </select>
                    </label>
                  </div>

                  <label className="mt-4 block">
                    <span className="font-bold">
                      Underwriter Notes
                    </span>

                    <textarea
                      value={
                        values?.underwriter_notes ?? ""
                      }
                      onChange={(event) =>
                        updateEdit(
                          loan.id,
                          "underwriter_notes",
                          event.target.value
                        )
                      }
                      className="mt-1 w-full rounded border p-3"
                      rows={4}
                    />
                  </label>

                  <label className="mt-4 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={
                        !!values?.published_to_marketplace
                      }
                      onChange={(event) =>
                        updateEdit(
                          loan.id,
                          "published_to_marketplace",
                          event.target.checked
                        )
                      }
                      className="h-5 w-5 accent-green-600"
                    />

                    <span className="font-bold">
                      Publish to Marketplace
                    </span>
                  </label>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() =>
                        saveLoanTerms(loan.id)
                      }
                      className="rounded bg-purple-600 px-4 py-2 font-bold text-white disabled:bg-gray-400"
                    >
                      {isSaving
                        ? "Saving..."
                        : "Save Review"}
                    </button>

                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() =>
                        updateStatus(
                          loan.id,
                          "Pending"
                        )
                      }
                      className="rounded bg-yellow-500 px-4 py-2 font-bold text-white disabled:bg-gray-400"
                    >
                      Pending
                    </button>

                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() =>
                        updateStatus(
                          loan.id,
                          "Approved"
                        )
                      }
                      className="rounded bg-green-600 px-4 py-2 font-bold text-white disabled:bg-gray-400"
                    >
                      Approve
                    </button>

                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() =>
                        updateStatus(
                          loan.id,
                          "Denied"
                        )
                      }
                      className="rounded bg-red-600 px-4 py-2 font-bold text-white disabled:bg-gray-400"
                    >
                      Deny
                    </button>

                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() =>
                        updateStatus(
                          loan.id,
                          "Funded"
                        )
                      }
                      className="rounded bg-blue-600 px-4 py-2 font-bold text-white disabled:bg-gray-400"
                    >
                      Mark Funded
                    </button>
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