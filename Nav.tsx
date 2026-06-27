export default function Nav() {
  return (
    <nav className="sticky top-0 z-50 bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <a href="/" className="flex items-center gap-2">
          <span className="text-3xl">🌎</span>
          <span className="text-2xl font-bold text-green-700">
            SecuredLanding
          </span>
        </a>

        <div className="flex flex-wrap gap-4 text-gray-700">
          <a href="#calculator" className="hover:text-green-600">Calculator</a>
          <a href="#invest" className="hover:text-green-600">Invest</a>
          <a href="#security" className="hover:text-green-600">Security</a>
          <a href="#contact" className="hover:text-green-600">Contact</a>
        </div>

        <a
          href="#calculator"
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg text-center"
        >
          Apply Now
        </a>
      </div>
    </nav>
  );
}