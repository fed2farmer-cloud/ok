import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto flex justify-between items-center p-5">
          <h1 className="text-3xl font-bold text-green-700">
            SecuredLanding
          </h1>

          <div className="space-x-3">
            <Link
              to="/login"
              className="px-5 py-2 rounded-lg border border-green-600 text-green-700 font-semibold"
            >
              Login
            </Link>

            <Link
              to="/signup"
              className="px-5 py-2 rounded-lg bg-green-600 text-white font-semibold"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 py-20 text-center">

        <h1 className="text-5xl font-bold text-green-700">
          Land-Backed Peer-to-Peer Lending
        </h1>

        <p className="text-xl text-gray-600 mt-6 max-w-3xl mx-auto">
          Invest in real land-secured loans or obtain financing using your land
          as collateral. Secure. Transparent. Built for Farmers, Ranchers and
          Landowners.
        </p>

        <div className="mt-10 flex justify-center gap-4 flex-wrap">

          <Link
            to="/marketplace"
            className="bg-green-600 text-white px-8 py-4 rounded-xl text-lg font-bold"
          >
            Browse Investments
          </Link>

          <Link
            to="/loan-application"
            className="bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-bold"
          >
            Apply for a Loan
          </Link>

        </div>

      </section>

      {/* Features */}

      <section className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-8 pb-20">

        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-green-700">
            Investors
          </h2>

          <p className="mt-4 text-gray-600">
            Invest from as little as $100 and earn competitive returns backed by
            real estate collateral.
          </p>

          <Link
            to="/investor"
            className="inline-block mt-6 bg-green-600 text-white px-6 py-3 rounded-lg"
          >
            Investor Dashboard
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-green-700">
            Borrowers
          </h2>

          <p className="mt-4 text-gray-600">
            Receive funding up to 50% Loan-to-Value using your land as
            collateral.
          </p>

          <Link
            to="/loan-application"
            className="inline-block mt-6 bg-blue-600 text-white px-6 py-3 rounded-lg"
          >
            Apply Today
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-green-700">
            Admin
          </h2>

          <p className="mt-4 text-gray-600">
            Review applications, approve loans, manage investors and monitor
            repayments.
          </p>

          <Link
            to="/admin"
            className="inline-block mt-6 bg-gray-800 text-white px-6 py-3 rounded-lg"
          >
            Admin Portal
          </Link>
        </div>

      </section>

      {/* Footer */}

      <footer className="bg-green-700 text-white py-8 text-center">
        <h2 className="text-xl font-bold">SecuredLanding.com</h2>

        <p className="mt-2">
          Secure land-backed lending for borrowers and investors.
        </p>

        <p className="mt-4 text-green-100">
          © 2026 SecuredLanding. All Rights Reserved.
        </p>
      </footer>

    </div>
  );
}