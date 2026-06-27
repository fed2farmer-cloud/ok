export default function Marketplace() {
  const products = [
    {
      id: 1,
      name: 'Organic Rice',
      seller: 'Farm Connect',
      price: '₹45/kg',
      rating: 4.8,
      image: '🌾',
    },
    {
      id: 2,
      name: 'Fresh Vegetables',
      seller: 'Green Valley',
      price: '₹120/box',
      rating: 4.6,
      image: '🥕',
    },
    {
      id: 3,
      name: 'Dairy Products',
      seller: 'Milk Fresh',
      price: '₹50/liter',
      rating: 4.9,
      image: '🥛',
    },
  ]

  return (
    <section id="marketplace" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Digital Marketplace
          </h2>
          <p className="text-xl text-gray-600">
            Connect with buyers and expand your reach
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white border border-gray-200 rounded-lg shadow-md p-6 hover:shadow-lg transition"
            >
              <div className="text-5xl mb-4 text-center">{product.image}</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {product.name}
              </h3>
              <p className="text-gray-600 mb-4">{product.seller}</p>
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold text-green-600">
                  {product.price}
                </span>
                <span className="text-sm text-yellow-600">★ {product.rating}</span>
              </div>
              <button className="w-full mt-4 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 font-semibold">
                View Details
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
