import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    if (!email || !password || !confirmPassword) {
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

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
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
