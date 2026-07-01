import { Routes, Route } from "react-router-dom";

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

function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50 p-6">
      <div className="bg-white p-6 rounded-xl shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-green-700 mb-6">
          Login
        </h1>

        <input
          className="w-full border p-3 rounded mb-4"
          type="email"
          placeholder="Email"
        />

        <input
          className="w-full border p-3 rounded mb-4"
          type="password"
          placeholder="Password"
        />

        <button className="w-full bg-green-600 text-white p-3 rounded-lg font-bold">
          Login
        </button>
      </div>
    </div>
  );
}

function Signup() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50 p-6">
      <div className="bg-white p-6 rounded-xl shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-green-700 mb-6">
          Create Account
        </h1>

        <input
          className="w-full border p-3 rounded mb-4"
          type="email"
          placeholder="Email"
        />

        <input
          className="w-full border p-3 rounded mb-4"
          type="password"
          placeholder="Password"
        />

        <select className="w-full border p-3 rounded mb-4">
          <option>Borrower</option>
          <option>Investor</option>
        </select>

        <button className="w-full bg-green-600 text-white p-3 rounded-lg font-bold">
          Sign Up
        </button>
      </div>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
    </Routes>
  );
}

export default App;