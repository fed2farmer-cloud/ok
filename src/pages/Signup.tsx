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

    // Sign up with Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (authError) {
      setMessage(authError.message);
      return;
    }

    if (!authData.user) {
      setMessage("Signup failed. Please try again.");
      return;
    }

    // Create user profile with selected role
    const { error: profileError } = await supabase
      .from("profiles")
      .insert([
        {
          id: authData.user.id,
          email: authData.user.email,
          role: role,
          created_at: new Date().toISOString(),
        },
      ]);

    if (profileError) {
      setMessage("Account created but profile setup failed. Please contact support.");
      console.error("Profile creation error:", profileError);
      return;
    }

    setSignupSuccess(true);
    setMessage("Signup successful! Please check your email for a confirmation link.");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50 p-6">
      <form
        onSubmit={handleSignup}
        className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md"
      >
        <h1 className="text-3xl font-bold text-green-700 mb-6">
          Create Account
        </h1>

        {!signupSuccess ? (
          <>
            <input
              type="email"
              placeholder="Email"
              className="w-full border rounded-lg p-3 mb-4"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <input
              type="password"
              placeholder="Password"
              className="w-full border rounded-lg p-3 mb-4"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <input
              type="password"
              placeholder="Confirm Password"
              className="w-full border rounded-lg p-3 mb-6"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />

            <label className="block mb-4">
              <span className="text-sm font-semibold text-gray-700 mb-2 block">
                Account Type *
              </span>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="role"
                    value="borrower"
                    checked={role === "borrower"}
                    onChange={(e) => setRole(e.target.value as "borrower")}
                    className="mr-3 w-4 h-4 text-green-600"
                    required
                  />
                  <span className="text-gray-700">Borrower</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="role"
                    value="investor"
                    checked={role === "investor"}
                    onChange={(e) => setRole(e.target.value as "investor")}
                    className="mr-3 w-4 h-4 text-green-600"
                    required
                  />
                  <span className="text-gray-700">Investor</span>
                </label>
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? "Creating Account..." : "Sign Up"}
            </button>

            <p className="mt-4 text-center text-sm">
              Already have an account?{" "}
              <Link to="/login" className="text-green-600 font-bold hover:underline">
                Login
              </Link>
            </p>
          </>
        ) : (
          <div className="text-center">
            <p className="text-green-600 font-semibold mb-4">
              ✓ Account created successfully!
            </p>
            <p className="text-sm text-gray-700 mb-6">
              Please check your email for a confirmation link to verify your account.
            </p>
            <Link
              to="/login"
              className="inline-block bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700"
            >
              Back to Login
            </Link>
          </div>
        )}

        {message && !signupSuccess && (
          <p className="mt-4 text-center text-sm text-red-600">
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
