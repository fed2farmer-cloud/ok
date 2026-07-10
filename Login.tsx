import { FormEvent, useState } from "react";
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
      navigate("/admin", { replace: true });
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
    <div className="min-h-screen bg-green-50 px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col justify-center">
        <div className="rounded-2xl bg-white p-6 shadow-xl sm:p-8">
          <div className="text-center">
            <Link
              to="/"
              className="text-3xl font-bold text-green-700"
            >
              SecuredLanding
            </Link>

            <p className="mt-2 text-gray-600">
              Sign in to manage your land-backed lending account.
            </p>
          </div>

          <form
            onSubmit={handleLogin}
            className="mx-auto mt-8 max-w-md space-y-5"
          >
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-bold text-gray-700"
              >
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
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label
                  htmlFor="password"
                  className="block text-sm font-bold text-gray-700"
                >
                  Password
                </label>

                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-green-700 hover:underline"
                >
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
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 pr-20 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-green-700"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="h-4 w-4 accent-green-600"
              />
              Keep me signed in on this device
            </label>

            {message && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-green-600 px-5 py-3 font-bold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {loading ? "Signing in..." : "Login"}
            </button>

            <p className="text-center text-sm text-gray-600">
              Don&apos;t have an account?{" "}
              <Link
                to="/signup"
                className="font-bold text-green-700 hover:underline"
              >
                Create account
              </Link>
            </p>
          </form>

          <div className="mt-10 border-t border-gray-200 pt-6 text-xs leading-6 text-gray-500">
            <h2 className="text-base font-bold text-gray-800">
              Legal Information and Disclosures
            </h2>

            <p className="mt-3">
              SecuredLanding is a technology platform intended to connect
              eligible borrowers with investors interested in land-backed
              lending opportunities. Loan applications are subject to
              underwriting, identity verification, property verification,
              documentation requirements, and applicable law.
            </p>

            <div className="mt-4 rounded-lg bg-gray-50 p-4">
              <p className="font-bold text-gray-700">
                Land-backed loan investments:
              </p>

              <ul className="mt-2 space-y-1">
                <li>• Are not FDIC insured.</li>
                <li>• Are not bank deposits.</li>
                <li>• Are not guaranteed by a bank or government agency.</li>
                <li>• May lose value, including possible loss of principal.</li>
                <li>• May be illiquid and subject to borrower default.</li>
              </ul>
            </div>

            <p className="mt-4">
              Targeted or projected returns are estimates and are not
              guaranteed. Past performance does not guarantee future results.
              Investors should evaluate each opportunity carefully and consult
              their own legal, tax, and financial advisers.
            </p>

            <p className="mt-4">
              Borrowers remain responsible for all obligations under their loan
              documents. Failure to make required payments may result in late
              fees, collection activity, foreclosure, or other remedies allowed
              under the applicable agreement and law.
            </p>

            <p className="mt-4">
              SecuredLanding does not provide individualized legal, tax,
              accounting, or investment advice. Availability of services may
              vary by jurisdiction and is subject to licensing and regulatory
              requirements.
            </p>

            <p className="mt-4">
              By logging in, you acknowledge the platform&apos;s Terms of
              Service, Privacy Policy, Electronic Communications Consent, and
              applicable risk and lending disclosures.
            </p>

            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 font-bold text-green-700">
              <Link to="/terms" className="hover:underline">
                Terms of Service
              </Link>

              <Link to="/privacy" className="hover:underline">
                Privacy Policy
              </Link>

              <Link to="/risk-disclosure" className="hover:underline">
                Risk Disclosure
              </Link>

              <Link to="/lending-disclosures" className="hover:underline">
                Lending Disclosures
              </Link>

              <Link to="/electronic-consent" className="hover:underline">
                Electronic Consent
              </Link>

              <Link to="/contact" className="hover:underline">
                Contact
              </Link>
            </div>

            <p className="mt-6 text-center text-gray-400">
              © {new Date().getFullYear()} SecuredLanding. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}