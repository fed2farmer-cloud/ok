import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Dashboard() {
  const [email, setEmail] = useState("");

  useEffect(() => {
    async function loadUser() {
      if (!supabase) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setEmail(user.email || "");
      }
    }

    loadUser();
  }, []);

  async function logout() {
    if (!supabase) return;

    await supabase.auth.signOut();
    window.location.href = "/";
  }

  function newApplication() {
    window.location.href = "/loan-application";
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">

      <h1 className="text-3xl font-bold text-green-700">
        Borrower Dashboard
      </h1>

      <p className="mt-2 text-gray-600">
        Welcome {email}
      </p>

      <div className="grid gap-6 mt-8">

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-bold">
            Apply for a Land Loan
          </h2>

          <p className="mt-2 text-gray-600">
            Start a new land-backed loan application.
          </p>

          <button
            onClick={newApplication}
            className="mt-4 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg"
          >
            New Application
          </button>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-bold">
            My Applications
          </h2>

          <p className="mt-2 text-gray-600">
            No applications yet.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-bold">
            Account
          </h2>

          <p className="mt-2 text-gray-600">
            Signed in as <strong>{email}</strong>
          </p>

          <button
            onClick={logout}
            className="mt-4 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg"
          >
            Logout
          </button>
        </div>

      </div>
    </div>
  );
}