import { Link } from "react-router-dom";

import Nav from "../components/Nav";
import Hero from "../components/Hero";
import Calculator from "../components/Calculator";
import Marketplace from "../components/Marketplace";
import Security from "../components/Security";
import Footer from "../components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <Hero />

      <section className="bg-gray-50 py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-green-700 text-center">
            Choose Your SecuredLanding Path
          </h2>

          <p className="text-gray-600 text-center mt-4 max-w-3xl mx-auto">
            Borrow against land, invest in land-backed loans, or manage the
            platform from the admin portal.
          </p>

          <div className="grid md:grid-cols-3 gap-8 mt-10">
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-2xl font-bold text-green-700">Borrowers</h3>
              <p className="mt-4 text-gray-600">
                Apply for financing using land as collateral, up to 50%
                loan-to-value.
              </p>
              <Link
                to="/loan-application"
                className="inline-block mt-6 bg-green-600 text-white px-6 py-3 rounded-lg font-bold"
              >
                Apply for a Loan
              </Link>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-2xl font-bold text-green-700">Investors</h3>
              <p className="mt-4 text-gray-600">
                Browse approved land-backed loans and invest with expected
                monthly returns.
              </p>
              <Link
                to="/marketplace"
                className="inline-block mt-6 bg-blue-600 text-white px-6 py-3 rounded-lg font-bold"
              >
                Browse Investments
              </Link>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-2xl font-bold text-green-700">Admin</h3>
              <p className="mt-4 text-gray-600">
                Review loan applications, publish loans, and manage underwriting.
              </p>
              <Link
                to="/admin"
                className="inline-block mt-6 bg-gray-800 text-white px-6 py-3 rounded-lg font-bold"
              >
                Admin Portal
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Calculator />
      <Marketplace />
      <Security />
      <Footer />
    </div>
  );
}