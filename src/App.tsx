import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import InvestorDashboard from "./pages/InvestorDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import LoanApplication from "./pages/LoanApplication";
import InvestorMarketplace from "./pages/InvestorMarketplace";

import LoanDocuments from "./LoanDocuments";
import InvestorWallet from "./InvestorWallet";
import NMIPayment from "./NMIPayment";
import BitcoinPayment from "./BitcoinPayment";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/marketplace" replace />} />

      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/borrower" element={<Dashboard />} />
      <Route path="/investor" element={<InvestorDashboard />} />
      <Route path="/admin" element={<AdminDashboard />} />

      <Route path="/loan-application" element={<LoanApplication />} />
      <Route path="/loan-documents" element={<LoanDocuments />} />

      <Route path="/marketplace" element={<InvestorMarketplace />} />
      <Route path="/investor-wallet" element={<InvestorWallet />} />

      <Route path="/payment" element={<NMIPayment />} />
      <Route path="/bitcoin-payment" element={<BitcoinPayment />} />

      <Route path="*" element={<Navigate to="/marketplace" replace />} />
    </Routes>
  );
}