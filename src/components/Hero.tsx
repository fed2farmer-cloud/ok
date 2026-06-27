export default function Hero() {
  return (
    <section className="bg-gradient-to-b from-green-50 to-white py-20">
      <div className="max-w-6xl mx-auto px-6 text-center">

        <span className="inline-block bg-green-100 text-green-700 px-4 py-2 rounded-full font-semibold mb-6">
          America's Land-Backed Lending Marketplace
        </span>

        <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 leading-tight">
          Unlock the Value of
          <span className="text-green-600"> Your Land</span>
        </h1>

        <p className="mt-8 text-xl text-gray-600 max-w-3xl mx-auto">
          Borrow against your land up to 50% Loan-to-Value or invest in
          land-backed loans secured by recorded first-position liens.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
          <button className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-xl font-semibold text-lg">
            Apply for a Loan
          </button>

          <button className="border-2 border-green-600 text-green-600 hover:bg-green-50 px-8 py-4 rounded-xl font-semibold text-lg">
            Invest Now
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h3 className="text-3xl font-bold text-green-600">50%</h3>
            <p className="text-gray-600 mt-2">Maximum Loan-to-Value</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-8">
            <h3 className="text-3xl font-bold text-green-600">$100</h3>
            <p className="text-gray-600 mt-2">Minimum Investment</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-8">
            <h3 className="text-3xl font-bold text-green-600">9%</h3>
            <p className="text-gray-600 mt-2">Target Annual Return</p>
          </div>
        </div>

      </div>
    </section>
  )
}