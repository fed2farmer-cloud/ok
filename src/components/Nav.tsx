export default function Nav() {
  return (
    <nav className="sticky top-0 z-50 bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">

        <a href="/" className="flex items-center gap-3">
          <img
            src="/Logo.png"
            alt="Secured Landing"
            className="h-12 w-12 rounded-full"
          />
          <div>
            <h1 className="text-2xl font-bold text-green-700">
              Lords Farms
            </h1>
            <p className="text-xs text-gray-500">
              SecuredLanding
            </p>
          </div>
        </a>

        <div className="flex gap-6 text-gray-700">
          <a href="#calculator">Calculator</a>
          <a href="#invest">Invest</a>
          <a href="#security">Security</a>
          <a href="#contact">Contact</a>
        </div>

        <a
          href="#calculator"
          className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700"
        >
          Apply Now
        </a>

      </div>
    </nav>
  );
}