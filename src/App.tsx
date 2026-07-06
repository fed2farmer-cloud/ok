import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./Login";
import Signup from "./Signup";
import Dashboard from "./Dashboard";
import LoanApplication from "./LoanApplication";
import AdminDashboard from "./AdminDashboard";
import InvestorDashboard from "./InvestorDashboard";
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

        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />

        <Route path="/investor" element={<InvestorDashboard />} />
        <Route path="/investor-dashboard" element={<InvestorDashboard />} />
        <Route path="/investor-wallet" element={<InvestorWallet />} />

        <Route path="/nmi-payment" element={<NMIPayment />} />
        <Route path="/payment" element={<NMIPayment />} />
      </Routes>
    </BrowserRouter>
  );
}