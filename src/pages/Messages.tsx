import AppLayout from "../components/AppLayout";
import MessageCenter from "../components/MessageCenter";

export default function Messages() {
  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-950">Message Center</h1>
          <p className="mt-1 text-sm text-slate-500">
            Communicate securely with your loan counterparties.
          </p>
        </div>
        <MessageCenter />
      </div>
    </AppLayout>
  );
}
