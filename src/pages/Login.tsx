import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

type UserRole = "borrower" | "investor" | "admin";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkExistingSession();
  }, []);

  async function checkExistingSession() {
    if (!supabase) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      await routeUserByRole(session.user.id);
    }
  }

  async function getUserRole(userId: string): Promise<UserRole | null> {
    if (!supabase) return null;

    /*
     * First try the profiles table.
     * This assumes profiles.id matches auth.users.id.
     */
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (!profileError && profile?.role) {
      const profileRole = String(profile.role).toLowerCase();

      if (
        profileRole === "borrower" ||
        profileRole === "investor" ||
        profileRole === "admin"
      ) {
        return profileRole;
      }
    }

    /*
     * Fallback: read the role saved in Supabase auth metadata.
     */
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const metadataRole = String(
      user?.user_metadata?.role ||
        user?.app_metadata?.role ||
        ""
    ).toLowerCase();

    if (
      metadataRole === "borrower" ||
      metadataRole === "investor" ||
      metadataRole === "admin"
    ) {
      return metadataRole;
    }

    /*
     * Final admin fallback: check admin_users.
     */
    const { data: adminRecord } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (adminRecord) {
      return "admin";
    }

    return null;
  }

  async function routeUserByRole(userId: string) {
    const role = await getUserRole(userId);

    if (role === "borrower") {
      navigate("/dashboard", { replace: true });
      return;
    }

    if (role === "investor") {
      navigate("/investor-wallet", { replace: true });
      return;
    }

    if (role === "admin") {
      navigate("/admin-dashboard", { replace: true });
      return;
    }

    setMessage(
      "Your account does not have a borrower, investor, or admin role assigned."
    );
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setMessage("Supabase is not configured.");
      return;
    }

    const cleanedEmail = email.trim().toLowerCase();

    if (!cleanedEmail || !password) {
      setMessage("Enter your email address and password.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanedEmail,
        password,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      if (!data.user) {
        setMessage("Login succeeded, but no user account was returned.");
        return;
      }

      if (!rememberMe) {
        sessionStorage.setItem("securedlanding_session_only", "true");
      } else {
        sessionStorage.removeItem("securedlanding_session_only");
      }

      await routeUserByRole(data.user.id);
    } catch (error: any) {
      setMessage(error?.message || "Unable to log in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl font-serif font-bold text-white tracking-tight">Secured<span className="text-amber-400">Landing</span></span>
        </Link>
        <Link to="/signup" className="text-sm text-slate-400 hover:text-white transition">
          New account →
        </Link>
      </header>

      {/* Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-serif font-bold text-slate-900">Welcome back</h1>
              <p className="mt-1 text-sm text-slate-500">Sign in to your SecuredLanding account</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 placeholder-slate-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                    Password
                  </label>
                  <Link to="/forgot-password" className="text-xs text-amber-600 hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-20 text-slate-900 placeholder-slate-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 hover:text-slate-700"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-sm text-slate-600 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="h-4 w-4 accent-amber-500 rounded"
                />
                Keep me signed in on this device
              </label>

              {message && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-slate-900 hover:bg-amber-500 px-5 py-3 font-bold text-white transition disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>

              <p className="text-center text-sm text-slate-500">
                Don&apos;t have an account?{" "}
                <Link to="/signup" className="font-semibold text-amber-600 hover:underline">
                  Create account
                </Link>
              </p>
            </form>

            <div className="mt-8 border-t border-slate-100 pt-6 text-xs leading-5 text-slate-400">
              <p className="font-semibold text-slate-600 mb-2">Legal Disclosures</p>
              <p>
                SecuredLanding connects eligible borrowers with investors in land-backed
                lending. Investments are <strong>not FDIC insured</strong>, not bank deposits,
                not guaranteed, and may lose value. Projected returns are estimates only.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}