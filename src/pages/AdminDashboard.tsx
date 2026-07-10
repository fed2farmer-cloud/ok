import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [applications, setApplications] = useState<any[]>([]);
  const [editing, setEditing] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);

  useEffect(() => {
    checkAdmin();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  async function checkAdmin() {
    if (!supabase) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      navigate("/login");
      return;
    }

    const { data: admin } = await supabase
      .from("admin_users")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!admin) {
      alert("Access denied.");
      navigate("/dashboard");
      return;
    }

    setAllowed(true);
    loadApplications();
  }

  function money(value: number) {
    return "$" + Number(value || 0).toLocaleString(undefined, {
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

    const loans = data || [];

    setApplications(loans);

    const formData: Record<number, any> = {};

    loans.forEach((loan: any) => {
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

  async function saveLoanTerms(id: number) {
    if (!supabase) return;

    setMessage("");
    setErrorMessage("");

    const loan = applications.find(
      (application) => application.id === id
    );

    const values = editing[id];

    if (!loan || !values) {
      setErrorMessage("Loan application data was not found.");
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
        "Investor rate cannot be greater than the borrower rate."
      );
      return;
    }

    const companySpread = Number(
      (borrowerRate - investorRate).toFixed(2)
    );

    const loanAmount = Number(loan.loan_amount || 0);
    const amountFunded = Number(loan.amount_funded || 0);

    const amountRemaining = Math.max(
      loanAmount - amountFunded,
      0
    );

    setSavingId(id);

    try {
      const { error: loanError } = await supabase
        .from("loan_applications")
        .update({
          borrower_interest_rate: borrowerRate,
          investor_interest_rate: investorRate,
          company_spread_rate: companySpread,
          amount_funded: amountFunded,
          amount_remaining: amountRemaining,
          risk_score: values.risk_score,
          underwriter_notes: values.underwriter_notes,
          published_to_marketplace:
            values.published_to_marketplace,
        })
        .eq("id", id);

      if (loanError) {
        throw loanError;
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
          company_spread_rate: companySpread,
          repayment_term_months: Number(
            loan.repayment_term_months || 36
          ),
          risk_score: values.risk_score,
          funding_goal: loanAmount,
          amount_funded: amountFunded,
          amount_remaining: amountRemaining,
          status: amountRemaining <= 0 ? "Funded" : "Open",
        };

        const { error: marketplaceError } = await supabase
          .from("marketplace_loans")
          .upsert(marketplacePayload, {
            onConflict: "loan_application_id",
          });

        if (marketplaceError) {
          throw new Error(
            `Marketplace update failed: ${marketplaceError.message}`
          );
        }

        setMessage(
          `Application #${id} was saved and published to the marketplace.`
        );
      } else {
        const { error: removeError } = await supabase
          .from("marketplace_loans")
          .delete()
          .eq("loan_application_id", id);

        if (removeError) {
          throw new Error(
            `Marketplace removal failed: ${removeError.message}`
          );
        }

        setMessage(
          `Application #${id} was saved and removed from the marketplace.`
        );
      }

      await loadApplications();
    } catch (error: any) {
      setErrorMessage(
        error?.message || "Unable to save the loan review."
      );
    } finally {
      setSavingId(null);
    }
  }

  async function updateStatus(
    id: number,
    status: string
  ) {
    if (!supabase) return;

    setMessage("");
    setErrorMessage("");
    setSavingId(id);

    try {
      const loan = applications.find(
        (application) => application.id === id
      );

      if (!loan) {
        throw new Error("Loan application was not found.");
      }

      const loanAmount = Number(loan.loan_amount || 0);

      const updatePayload: Record<string, unknown> = {
        status,
      };

      if (status === "Funded") {
        updatePayload.amount_funded = loanAmount;
        updatePayload.amount_remaining = 0;
        updatePayload.published_to_marketplace = true;
      }

      const { error: applicationError } = await supabase
        .from("loan_applications")
        .update(updatePayload)
        .eq("id", id);

      if (applicationError) {
        throw applicationError;
      }

      if (status === "Funded") {
        const borrowerRate = Number(
          editing[id]?.borrower_interest_rate ??
            loan.borrower_interest_rate ??
            10
        );

        const investorRate = Number(
          editing[id]?.investor_interest_rate ??
            loan.investor_interest_rate ??
            9
        );

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
          funding_goal: loanAmount,
          amount_funded: loanAmount,
          amount_remaining: 0,
          borrower_interest_rate: borrowerRate,
          investor_interest_rate: investorRate,
          company_spread_rate: Number(
            (borrowerRate - investorRate).toFixed(2)
          ),
          repayment_term_months: Number(
            loan.repayment_term_months || 36
          ),
          risk_score:
            editing[id]?.risk_score ||
            loan.risk_score ||
            "Pending",
          status: "Funded",
        };

        const { error: marketplaceError } = await supabase
          .from("marketplace_loans")
          .upsert(marketplacePayload, {
            onConflict: "loan_application_id",
          });

        if (marketplaceError) {
          throw new Error(
            `Marketplace update failed: ${marketplaceError.message}`
          );
        }
      }

      if (status === "Approved") {
        const { error: marketplaceError } = await supabase
          .from("marketplace_loans")
          .update({ status: "Open" })
          .eq("loan_application_id", id);

        if (marketplaceError) {
          throw marketplaceError;
        }
      }

      if (status === "Denied") {
        const { error: marketplaceError } = await supabase
          .from("marketplace_loans")
          .update({ status: "Closed" })
          .eq("loan_application_id", id);

        if (marketplaceError) {
          throw marketplaceError;
        }
      }

      setMessage(
        status === "Funded"
          ? `Application #${id} is now fully funded.`
          : `Application #${id} status changed to ${status}.`
      );

      await loadApplications();
    } catch (error: any) {
      setErrorMessage(
        error?.message || "Unable to update loan status."
      );
    } finally {
      setSavingId(null);
    }
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
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-2xl font-bold text-green-700">
          Loading Admin Dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">

      <div className="flex flex-wrap justify-between items-center mb-8 gap-4">

        <div>
          <h1 className="text-4xl font-bold text-green-700">
            Admin Loan Review Center
          </h1>

          <p className="text-gray-600 mt-2">
            Review, approve, publish and manage every loan application.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">

          <button
            onClick={loadApplications}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg font-bold"
          >
            Refresh
          </button>

          <button
            onClick={() => navigate("/")}
            className="bg-gray-700 hover:bg-gray-800 text-white px-5 py-3 rounded-lg font-bold"
          >
            Home
          </button>

          <button
            onClick={logout}
            className="bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-lg font-bold"
          >
            Logout
          </button>

        </div>

      </div>

      {errorMessage && (
        <div className="mb-6 bg-red-100 border border-red-300 text-red-700 rounded-lg p-4">
          {errorMessage}
        </div>
      )}

      {message && (
        <div className="mb-6 bg-green-100 border border-green-300 text-green-700 rounded-lg p-4 font-bold">
          {message}
        </div>
      )}

      {applications.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8">
          No loan applications found.
        </div>
      ) : (

        applications.map((loan) => {

          const values = editing[loan.id];

          const loanAmount = Number(loan.loan_amount || 0);
          const landValue = Number(loan.land_value || 0);
          const term = Number(loan.repayment_term_months || 36);

          const borrowerRate = Number(
            values?.borrower_interest_rate ?? 10
          );

          const investorRate = Number(
            values?.investor_interest_rate ?? 9
          );

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

          const spread =
            borrowerRate - investorRate;

          const saving = savingId === loan.id;

          return (

            <div
              key={loan.id}
              className="bg-white rounded-xl shadow-lg p-6 mb-8"
            >

              <div className="flex justify-between items-start flex-wrap gap-3">

                <div>

                  <h2 className="text-2xl font-bold text-green-700">
                    {loan.business_name || "No Business Name"}
                  </h2>

                  <p className="text-gray-500 mt-1">
                    Application #{loan.id}
                  </p>

                </div>

                <span
                  className={`px-4 py-2 rounded-full font-bold ${statusClasses(
                    loan.status
                  )}`}
                >
                  {loan.status || "Pending"}
                </span>

              </div>

              <div className="grid md:grid-cols-2 gap-8 mt-6">

                <div>

                  <h3 className="text-xl font-bold mb-3">
                    Borrower Information
                  </h3>

                  <p><strong>Name:</strong> {loan.full_name}</p>

                  <p><strong>Email:</strong> {loan.email}</p>

                  <p><strong>Phone:</strong> {loan.phone}</p>

                  <p><strong>Status:</strong> {loan.status}</p>

                </div>

                <div>

                  <h3 className="text-xl font-bold mb-3">
                    Property Information
                  </h3>

                  <p><strong>APN:</strong> {loan.apn}</p>

                  <p><strong>Address:</strong> {loan.property_address}</p>

                  <p><strong>State:</strong> {loan.state}</p>

                  <p><strong>Acres:</strong> {loan.acreage}</p>

                  <p><strong>Land Value:</strong> {money(landValue)}</p>

                  <p><strong>LTV:</strong> {ltv.toFixed(2)}%</p>

                </div>

              </div>

              <div className="mt-8 bg-gray-50 border rounded-lg p-5">

                <h3 className="text-xl font-bold mb-4">
                  Loan Calculations
                </h3>

                <div className="grid md:grid-cols-3 gap-4">

                  <div>
                    <strong>Requested Loan</strong>
                    <div>{money(loanAmount)}</div>
                  </div>

                  <div>
                    <strong>Repayment Term</strong>
                    <div>{term} months</div>
                  </div>

                  <div>
                    <strong>Monthly Payment</strong>
                    <div>{money(payment)}</div>
                  </div>

                  <div>
                    <strong>Total Repayment</strong>
                    <div>{money(totalRepayment)}</div>
                  </div>

                  <div>
                    <strong>Total Interest</strong>
                    <div>{money(totalInterest)}</div>
                  </div>

                  <div>
                    <strong>Company Spread</strong>
                    <div>{spread.toFixed(2)}%</div>
                  </div>

                </div>

              </div>
              <div className="mt-8 grid md:grid-cols-3 gap-4">

                <label>
                  <span className="font-bold">
                    Borrower Interest Rate %
                  </span>

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={values?.borrower_interest_rate ?? ""}
                    onChange={(e) =>
                      updateEdit(
                        loan.id,
                        "borrower_interest_rate",
                        e.target.value
                      )
                    }
                    className="mt-2 w-full border rounded-lg p-3"
                  />
                </label>

                <label>
                  <span className="font-bold">
                    Investor Interest Rate %
                  </span>

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={values?.investor_interest_rate ?? ""}
                    onChange={(e) =>
                      updateEdit(
                        loan.id,
                        "investor_interest_rate",
                        e.target.value
                      )
                    }
                    className="mt-2 w-full border rounded-lg p-3"
                  />
                </label>

                <label>
                  <span className="font-bold">
                    Risk Score
                  </span>

                  <select
                    value={values?.risk_score ?? "Pending"}
                    onChange={(e) =>
                      updateEdit(
                        loan.id,
                        "risk_score",
                        e.target.value
                      )
                    }
                    className="mt-2 w-full border rounded-lg p-3"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </label>

              </div>

              <div className="mt-6">

                <label className="font-bold">
                  Underwriter Notes
                </label>

                <textarea
                  rows={5}
                  value={values?.underwriter_notes ?? ""}
                  onChange={(e) =>
                    updateEdit(
                      loan.id,
                      "underwriter_notes",
                      e.target.value
                    )
                  }
                  className="mt-2 w-full border rounded-lg p-3"
                />

              </div>

              <div className="mt-6 flex items-center gap-3">

                <input
                  type="checkbox"
                  checked={
                    values?.published_to_marketplace ?? false
                  }
                  onChange={(e) =>
                    updateEdit(
                      loan.id,
                      "published_to_marketplace",
                      e.target.checked
                    )
                  }
                />

                <span className="font-bold">
                  Publish to Marketplace
                </span>

              </div>

              <div className="mt-8 flex flex-wrap gap-3">

                <button
                  onClick={() => saveLoanTerms(loan.id)}
                  disabled={saving}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-3 rounded-lg font-bold disabled:bg-gray-400"
                >
                  {saving ? "Saving..." : "Save Review"}
                </button>

                <button
                  onClick={() =>
                    updateStatus(loan.id, "Pending")
                  }
                  disabled={saving}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white px-5 py-3 rounded-lg font-bold"
                >
                  Pending
                </button>

                <button
                  onClick={() =>
                    updateStatus(loan.id, "Approved")
                  }
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-lg font-bold"
                >
                  Approve
                </button>

                <button
                  onClick={() =>
                    updateStatus(loan.id, "Denied")
                  }
                  disabled={saving}
                  className="bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-lg font-bold"
                >
                  Deny
                </button>

                <button
                  onClick={() =>
                    updateStatus(loan.id, "Funded")
                  }
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg font-bold"
                >
                  Mark Funded
                </button>

              </div>

            </div>

          );
        })
      )}
    </div>
  );
}
    return (
      (amount * monthlyRate) /
      (1 - Math.pow(1 + monthlyRate, -months))
    );
  }

  function updateEdit(id: number, field: string, value: any) {
    setEditing((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  }
