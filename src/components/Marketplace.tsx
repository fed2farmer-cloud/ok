export default function Marketplace() {
  const investments = [
    {
      title: "Texas Ranch Loan",
      location: "Texas, USA",
      amount: "$250,000",
      rate: "9% APR",
    },
    {
      title: "California Farm Loan",
      location: "California, USA",
      amount: "$500,000",
      rate: "8.5% APR",
    },
    {
      title: "Timberland Investment",
      location: "Oregon, USA",
      amount: "$175,000",
      rate: "10% APR",
    },
  ];

  return (
    <section id="invest" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-5xl font-bold text-center mb-4">
          Investment Opportunities
        </h2>

        <p className="text-center text-gray-600 mb-12">
          Invest in land-backed loans secured by recorded first-position liens.
        </p>

        <div className="grid md:grid-cols-3 gap-8">
          {investments.map((loan, index) => (
            <div
              key={index}
              className="bg-white rounded-xl shadow-lg p-8 border"
            >
              <h3 className="text-2xl font-bold mb-3">{loan.title}</h3>

              <p className="text-gray-600 mb-2">
                📍 {loan.location}
              </p>

              <p className="text-3xl font-bold text-green-700 mb-2">
                {loan.amount}
              </p>

              <p className="text-lg text-gray-700 mb-6">
                Expected Return: {loan.rate}
              </p>

              <button className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold">
                Invest Now
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}