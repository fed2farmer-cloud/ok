import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"borrower" | "investor" | "">("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    if (!email || !password || !confirmPassword || !role) {
      setMessage("Please fill in all fields.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      setLoading(false);
      return;
    }

    if (!supabase) {
      setMessage("Supabase is not configured.");
      setLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: role,
        },
      },
    });

    setLoading(false);

    if (authError) {
      setMessage(authError.message);
      return;
    }

    setSignupSuccess(true);
    setMessage("Signup successful! Please check your email for a confirmation link.");
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl font-serif font-bold text-white tracking-tight">Secured<span className="text-amber-400">Landing</span></span>
        </Link>
        <Link to="/login" className="text-sm text-slate-400 hover:text-white transition">
          Sign in →
        </Link>
      </header>

      {/* Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-serif font-bold text-slate-900">Create your account</h1>
              <p className="mt-1 text-sm text-slate-500">Join SecuredLanding — land-backed lending marketplace</p>
            </div>

            <form onSubmit={handleSignup} className="space-y-5">
              {!signupSuccess ? (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email address</label>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 placeholder-slate-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
                    <input
                      type="password"
                      placeholder="At least 8 characters"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 placeholder-slate-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm password</label>
                    <input
                      type="password"
                      placeholder="Re-enter your password"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 placeholder-slate-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <span className="block text-sm font-semibold text-slate-700 mb-2">Account type</span>
                    <div className="grid grid-cols-2 gap-3">
                      {(["borrower", "investor"] as const).map((r) => (
                        <label
                          key={r}
                          className={`flex items-center gap-3 cursor-pointer rounded-xl border-2 px-4 py-3 transition ${
                            role === r ? "border-amber-400 bg-amber-50" : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <input
                            type="radio"
                            name="role"
                            value={r}
                            checked={role === r}
                            onChange={(e) => setRole(e.target.value as "borrower")}
                            className="sr-only"
                            required
                          />
                          <span className="text-lg">{r === "borrower" ? "🏡" : "📈"}</span>
                          <span className="font-semibold text-slate-800 capitalize">{r}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-slate-900 hover:bg-amber-500 px-5 py-3 font-bold text-white transition disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {loading ? "Creating account…" : "Create Account"}
                  </button>

                  <p className="text-center text-sm text-slate-500">
                    Already have an account?{" "}
                    <Link to="/login" className="font-semibold text-amber-600 hover:underline">
                      Sign in
                    </Link>
                  </p>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">✓</span>
                  </div>
                  <p className="text-lg font-semibold text-slate-900 mb-2">Account created!</p>
                  <p className="text-sm text-slate-500 mb-6">
                    Check your email for a confirmation link to activate your account.
                  </p>
                  <Link
                    to="/login"
                    className="inline-block rounded-xl bg-slate-900 hover:bg-amber-500 px-6 py-2.5 font-bold text-white transition"
                  >
                    Back to Sign In
                  </Link>
                </div>
              )}

              {message && !signupSuccess && (
                <p className="text-center text-sm text-red-600">{message}</p>
              )}
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}