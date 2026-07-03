import { Routes, Route } from "react-router-dom";

import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Calculator from "./components/Calculator";
import Marketplace from "./components/Marketplace";
import Security from "./components/Security";
import Footer from "./components/Footer";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import InvestorDashboard from "./pages/InvestorDashboard";
import LoanApplication from "./pages/LoanApplication";
import Signup from "./pages/Signup";

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
    <Routes>
      <Route path="/" element={<Home />} />

      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Borrower */}
      <Route path="/borrower" element={<Dashboard />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/loan-application" element={<LoanApplication />} />

      {/* Investor */}
      <Route path="/investor" element={<InvestorDashboard />} />

      {/* Admin */}
      <Route path="/admin" element={<AdminDashboard />} />
    </Routes>
  );
}