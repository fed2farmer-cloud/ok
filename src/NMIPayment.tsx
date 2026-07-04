import PaymentForm from "../components/PaymentForm";

export default function NMIPayment() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-green-700 mb-2">
          Payment Processing
        </h1>
        <p className="text-gray-600 mb-8">
          Enter your payment details to fund this investment opportunity
        </p>
        
        <div className="bg-white rounded-lg shadow-lg p-8">
          <PaymentForm />
        </div>
      </div>
    </div>
  );
}
