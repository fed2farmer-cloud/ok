export default function Hero() {
  return (
    <section className="bg-gradient-to-b from-green-50 to-white py-16">
      <div className="max-w-6xl mx-auto px-6 text-center">
        <p className="text-green-700 font-bold mb-4">
          America's Land-Backed Lending Marketplace
        </p>

        <h1 className="text-5xl font-extrabold text-gray-900 leading-tight">
          Unlock the Value of
          <span className="text-green-600"> Your Land</span>
        </h1>

        <p className="mt-6 text-xl text-gray-600 max-w-3xl mx-auto">
          Borrow against your land up to 50% Loan-to-Value or invest in
          land-backed loans secured by recorded first-position liens.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
          <a href="#calculator" className="bg-green-600 text-white px-8 py-4 rounded-xl font-bold">
            Apply for a Loan
          </a>

          <a href="#invest" className="border-2 border-green-600 text-green-600 px-8 py-4 rounded-xl font-bold">
            Invest Now
          </a>
        </div>
      </div>
    </section>
  )
}