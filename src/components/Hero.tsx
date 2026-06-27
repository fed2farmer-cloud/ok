export default function Hero() {
  return (
    <section className="pt-32 pb-20 bg-gradient-to-b from-green-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Empowering Farmers with Technology
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Connect directly with buyers, track your yields, and grow your farm business with our digital marketplace.
          </p>
          <div className="flex justify-center gap-4">
            <button className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 font-semibold">
              Start Free Trial
            </button>
            <button className="border-2 border-green-600 text-green-600 px-8 py-3 rounded-lg hover:bg-green-50 font-semibold">
              Learn More
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
