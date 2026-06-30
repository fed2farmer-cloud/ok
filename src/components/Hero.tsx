export default function Hero() {
  return (
    <section className="bg-gradient-to-b from-green-50 to-white py-20">
      <div className="max-w-6xl mx-auto px-6 text-center">
        <p className="text-green-700 font-bold mb-4">
          America's Land-Backed Lending Marketplace
        </p>

        <h1 className="text-5xl font-extrabold text-gray-900">
          Unlock the Value of
          <span className="text-green-600"> Your Land</span>
        </h1>

        <p className="mt-6 text-xl text-gray-600">
          Borrow against your land up to 50% Loan-to-Value or invest in
          land-backed loans secured by recorded first-position liens.
        </p>

        <div className="mt-8 flex flex-col gap-4">
          <button className="bg-green-600 text-white px-8 py-4 rounded-xl font-bold">
            Apply for a Loan
          </button>

          <button className="border-2 border-green-600 text-green-600 px-8 py-4 rounded-xl font-bold">
            Invest Now
          </button>
        </div>

        <div className="grid gap-4 mt-10">
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-3xl font-bold text-green-600">50%</h3>
            <p>Maximum Loan-to-Value</p>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-3xl font-bold text-green-600">$100</h3>
            <p>Minimum Investment</p>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-3xl font-bold text-green-600">9%</h3>
            <p>Target Annual Return</p>
          </div>
        </div>
      </div>
    </section>
  )
}