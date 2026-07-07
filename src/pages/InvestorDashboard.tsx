import { useNavigate } from "react-router-dom";

export default function InvestorDashboard() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-green-700 mb-2">
        Investor Dashboard
      </h1>

      <p className="text-gray-600 mb-6">
        Manage your investments and browse available land-backed loans.
      </p>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <button
          onClick={() => navigate("/marketplace")}
          className="bg-green-600 text-white p-5 rounded-xl font-bold shadow"
        >
          Browse Marketplace
        </button>

        <button
          onClick={() => navigate("/investor-wallet")}
          className="bg-blue-600 text-white p-5 rounded-xl font-bold shadow"
        >
          Investor Wallet
        </button>

        <button
          onClick={() => navigate("/loan-documents")}
          className="bg-gray-800 text-white p-5 rounded-xl font-bold shadow"
        >
          Loan Documents
        </button>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-2xl font-bold mb-3">Next Step</h2>
        <p>
          Use the marketplace to choose a loan, enter your investment amount,
          and fund it through the payment page.
        </p>
      </div>
    </div>
  );
}