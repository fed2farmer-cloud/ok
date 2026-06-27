export default function Nav() {
  return (
    <nav className="w-full bg-white shadow-md z-50">
      <div className="px-3 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
          <h1 className="text-xl font-bold text-green-600">Fed2Farmer</h1>

          <div className="flex flex-wrap gap-3 text-sm">
            <a href="#features" className="text-gray-600 hover:text-green-600">Features</a>
            <a href="#calculator" className="text-gray-600 hover:text-green-600">Calculator</a>
            <a href="#marketplace" className="text-gray-600 hover:text-green-600">Marketplace</a>
            <a href="#security" className="text-gray-600 hover:text-green-600">Security</a>
          </div>

          <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm">
            Get Started
          </button>
        </div>
      </div>
    </nav>
  )
}