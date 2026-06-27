export default function Security() {
  const features = [
    {
      icon: "🏛️",
      title: "Recorded Liens",
      description: "Loans are designed to be secured by recorded land liens.",
    },
    {
      icon: "🌎",
      title: "Land-Backed Collateral",
      description: "Borrowers use real land ownership as loan collateral.",
    },
    {
      icon: "📊",
      title: "Transparent Terms",
      description: "Clear loan-to-value, interest, and repayment structure.",
    },
    {
      icon: "🛡️",
      title: "Investor Protection",
      description: "Built around collateral, documentation, and verification.",
    },
  ];

  return (
    <section id="security" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-5xl font-bold text-center mb-4">
          Why SecuredLanding
        </h2>

        <p className="text-center text-gray-600 mb-12">
          A lending marketplace built around land ownership, collateral, and trust.
        </p>

        <div className="grid md:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="bg-white rounded-xl shadow-lg p-6 text-center">
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}