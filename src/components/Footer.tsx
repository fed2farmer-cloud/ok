export default function Footer() {
  return (
    <footer id="contact" className="bg-slate-900 text-white py-16">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-green-400">
          SecuredLanding
        </h2>

        <p className="mt-3 text-gray-300 max-w-xl">
          America's land-backed lending marketplace. Borrow against your
          land or invest in secured real estate loans.
        </p>

        <div className="grid md:grid-cols-3 gap-10 mt-10">
          <div>
            <h3 className="font-bold mb-3">Borrowers</h3>
            <p>Apply for a Loan</p>
            <p>Loan Calculator</p>
            <p>Eligibility</p>
          </div>

          <div>
            <h3 className="font-bold mb-3">Investors</h3>
            <p>Investment Opportunities</p>
            <p>Returns</p>
            <p>Portfolio</p>
          </div>

          <div>
            <h3 className="font-bold mb-3">Company</h3>
            <p>About</p>
            <p>Contact</p>
            <p>Privacy Policy</p>
          </div>
        </div>

        <div className="border-t border-slate-700 mt-12 pt-6 text-center text-gray-400">
          © 2026 SecuredLanding. All rights reserved.
        </div>
      </div>
    </footer>
  );
}