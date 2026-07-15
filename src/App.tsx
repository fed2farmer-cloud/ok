import { Routes, Route, Navigate } from "react-router-dom";
import { ToastProvider } from "./context/ToastContext";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import InvestorDashboard from "./pages/InvestorDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import LoanApplication from "./pages/LoanApplication";
import InvestorMarketplace from "./pages/InvestorMarketplace";
import LordFarmsDeal from "./pages/LordFarmsDeal";
import Invest from "./pages/Invest";
import InvestmentDetails from "./pages/InvestmentDetails";
import Messages from "./pages/Messages";
import KYCPage from "./pages/KYCPage";
import LoanForms from "./pages/LoanForms";
import ClosingCenter from "./pages/ClosingCenter";
import FundingCampaign from "./pages/FundingCampaign";

import LoanDocuments from "./LoanDocuments";
import InvestorWallet from "./InvestorWallet";
import NMIPayment from "./NMIPayment";
import BitcoinPayment from "./BitcoinPayment";

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/borrower" element={<Dashboard />} />
        <Route path="/investor" element={<InvestorDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />

        <Route path="/loan-application" element={<LoanApplication />} />
        <Route path="/loan-documents" element={<LoanDocuments />} />
        <Route path="/loan-forms" element={<LoanForms />} />
        <Route path="/closing-center" element={<ClosingCenter />} />
        <Route path="/funding-campaign" element={<FundingCampaign />} />

        <Route path="/marketplace" element={<InvestorMarketplace />} />
        <Route path="/investor-wallet" element={<InvestorWallet />} />

        <Route path="/payment" element={<NMIPayment />} />
        <Route path="/bitcoin-payment" element={<BitcoinPayment />} />

        <Route path="/messages" element={<Messages />} />
        <Route path="/kyc" element={<KYCPage />} />

        {/* Showcase / marketing pages */}
        <Route path="/lords-farms" element={<LordFarmsDeal />} />
        <Route path="/invest" element={<Invest />} />
        <Route path="/investment-details" element={<InvestmentDetails />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
}
