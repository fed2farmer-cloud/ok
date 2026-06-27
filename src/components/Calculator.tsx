import { useState } from 'react'

export default function Calculator() {
  const [crops, setCrops] = useState('100')
  const [price, setPrice] = useState('50')
  const revenue = parseFloat(crops) * parseFloat(price) || 0

  return (
    <section id="calculator" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Revenue Calculator
          </h2>
          <p className="text-xl text-gray-600">
            Estimate your potential earnings
          </p>
        </div>
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Crop Yield (kg)
            </label>
            <input
              type="number"
              value={crops}
              onChange={(e) => setCrops(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent"
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Price per Unit (₹)
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent"
            />
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Estimated Revenue</p>
            <p className="text-3xl font-bold text-green-600">₹{revenue.toFixed(0)}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
