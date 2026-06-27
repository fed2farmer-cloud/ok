export default function Security() {
  const features = [
    {
      icon: '🔒',
      title: 'Secure Transactions',
      description: 'Bank-level encryption for all payments',
    },
    {
      icon: '✓',
      title: 'Verified Sellers',
      description: 'All sellers are verified and rated',
    },
    {
      icon: '📊',
      title: 'Transparent Pricing',
      description: 'No hidden charges or surprise fees',
    },
    {
      icon: '🛡️',
      title: 'Buyer Protection',
      description: 'Your purchase is protected',
    },
  ]

  return (
    <section id="security" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Security & Trust
          </h2>
          <p className="text-xl text-gray-600">
            Your safety and privacy are our priority
          </p>
        </div>
        <div className="grid md:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="text-center bg-white rounded-lg shadow-md p-6"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
