export default function Nav() {
  return (
    <nav className="fixed w-full bg-white shadow-md z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-green-600">Fed2Farmer</h1>
          </div>
          <div className="hidden md:flex space-x-8">
            <a href="#features" className="text-gray-600 hover:text-green-600">
              Features
            </a>
            <a href="#calculator" className="text-gray-600 hover:text-green-600">
              Calculator
            </a>
            <a href="#marketplace" className="text-gray-600 hover:text-green-600">
              Marketplace
            </a>
            <a href="#security" className="text-gray-600 hover:text-green-600">
              Security
            </a>
          </div>
          <button className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700">
            Get Started
          </button>
        </div>
      </div>
    </nav>
  )
}
