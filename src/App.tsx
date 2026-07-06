import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import InvestorDashboard from "./pages/InvestorDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import LoanApplication from "./pages/LoanApplication";

import InvestorWallet from "./InvestorWallet";
import LoanDocuments from "./LoanDocuments";
import NMIPayment from "./NMIPayment";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/borrower-dashboard" element={<Dashboard />} />
        <Route path="/loan-application" element={<LoanApplication />} />

        <Route path="/loan-documents" element={<LoanDocuments />} />

        <Route path="/investor" element={<InvestorDashboard />} />
        <Route path="/investor-dashboard" element={<InvestorDashboard />} />
        <Route path="/investor-wallet" element={<InvestorWallet />} />

        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />

        <Route path="/payment" element={<NMIPayment />} />
        <Route path="/nmi-payment" element={<NMIPayment />} />
      </Routes>
    </BrowserRouter>
  );
}