export function Logo() {
  return (
    <a href="/" className="flex items-center gap-3">
      <img src="/Logo.png" alt="SecuredLanding" className="h-8 w-8 object-contain" />
      <span className="font-display text-lg font-semibold text-paper-50">SecuredLanding</span>
    </a>
  );
}

export default function Nav() {
  return (
    <nav className="sticky top-0 z-50 bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <a href="/" className="flex items-center gap-3">
          <img
            src="/Logo.png"
            alt="SecuredLanding"
            className="h-10 w-10 object-contain"
          />

          <div>
            <h1 className="text-2xl font-bold text-green-700">
              SecuredLanding
            </h1>
            <p className="text-xs text-gray-500">SecuredLanding</p>
          </div>
        </a>

        <div className="hidden sm:flex gap-6 text-gray-700">
          <a href="#calculator">Calculator</a>
          <a href="#invest">Invest</a>
          <a href="#security">Security</a>
          <a href="#contact">Contact</a>
          <a href="/login">Log In</a>
          <a href="/signup">Sign Up</a>
        </div>

        <div className="hidden sm:flex gap-3">
          <a
            href="/login"
            className="border border-green-600 text-green-600 px-4 py-2 rounded-lg hover:bg-green-50"
          >
            Log In
          </a>

          <a
            href="/signup"
            className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700"
          >
            Sign Up
          </a>
        </div>
      </div>
    </nav>
  );
}