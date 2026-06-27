export default function Nav() {
  return (
    <nav className="sticky top-0 z-50 bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-green-700">
          SecuredLanding
        </h1>

        <div className="hidden md:flex gap-6 text-gray-700">
          <a href="#how">How It Works</a>
          <a href="#calculator">Loan Calculator</a>
          <a href="#invest">Invest</a>
          <a href="#contact">Contact</a>
        </div>

        <button className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg">
          Apply Now
        </button>
      </div>
    </nav>
  );
}