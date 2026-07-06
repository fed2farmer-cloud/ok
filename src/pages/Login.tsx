import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    if (!supabase) {
      setMessage("Supabase is not configured.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const user = data.user;

    if (!user) {
      setMessage("Login failed.");
      setLoading(false);
      return;
    }

    let { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      const fallbackRole = user.user_metadata?.role || "investor";

      const { error: insertError } = await supabase.from("profiles").insert({
        id: user.id,
        email: user.email,
        role: fallbackRole,
      });

      if (insertError) {
        setMessage("Unable to create user profile.");
        setLoading(false);
        return;
      }

      profile = { role: fallbackRole };
    }

    setLoading(false);
    setMessage("Login successful!");

    switch (profile.role) {
      case "admin":
        navigate("/admin");
        break;
      case "investor":
        navigate("/investor");
        break;
      default:
        navigate("/borrower-dashboard");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50 p-6">
      <form
        onSubmit={handleLogin}
        className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md"
      >
        <h1 className="text-3xl font-bold text-green-700 mb-6">Login</h1>

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
          className="w-full border rounded-lg p-3 mb-6"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <p className="mt-4 text-center text-sm">
          Don't have an account?{" "}
          <Link to="/signup" className="text-green-600 font-bold hover:underline">
            Create account
          </Link>
        </p>

        {message && <p className="mt-4 text-center text-sm">{message}</p>}
      </form>
    </div>
  );
}