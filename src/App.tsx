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
import BitcoinPayment from "./BitcoinPayment";
import InvestorMarketplace from "./pages/InvestorMarketplace";

import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Calculator from "./components/Calculator";
import Marketplace from "./components/Marketplace";
import Security from "./components/Security";
import Footer from "./components/Footer";

function Home() {
  return (
    <>
      <Nav />
      <Hero />
      <Calculator />
      <Marketplace />
      <Security />
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />

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
<Route
  path="/marketplace"
  element={<InvestorMarketplace />}
/>
        <Route path="/bitcoin-payment" element={<BitcoinPayment />} />
      </Routes>
    </BrowserRouter>
  );
}