import PaymentForm from "./components/PaymentForm";
import AppLayout from "./components/AppLayout";

export default function NMIPayment() {
  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl py-8 px-4">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Payment Processing
        </h1>
        <p className="text-slate-500 mb-8">
          Enter your payment details to fund this investment opportunity
        </p>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <PaymentForm />
        </div>
      </div>
    </AppLayout>
  );
}
