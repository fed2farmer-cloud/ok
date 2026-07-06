import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";

const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const LoanApplication = lazy(() => import("./pages/LoanApplication"));
const InvestorDashboard = lazy(() => import("./pages/InvestorDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));

const InvestorWallet = lazy(() => import("./InvestorWallet"));
const LoanDocuments = lazy(() => import("./LoanDocuments"));
const NMIPayment = lazy(() => import("./NMIPayment"));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div style={{ padding: 30 }}>Loading...</div>}>
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
      </Suspense>
    </BrowserRouter>
  );
}