import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { supabase } from "../lib/supabase";

export default function PlaidConnectButton() {
  const [linkToken, setLinkToken] = useState<string | null>(null);

  useEffect(() => {
    createLinkToken();
  }, []);

  async function createLinkToken() {
    const response = await fetch("/api/create-link-token", {
      method: "POST",
    });

    const data = await response.json();

    if (!response.ok) {
      alert("Plaid link token error: " + JSON.stringify(data.error || data));
      return;
    }

    setLinkToken(data.link_token);
  }

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token) => {
      if (!supabase) return;

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        alert("Please log in before connecting a bank.");
        return;
      }

      const response = await fetch("/api/exchange-public-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          public_token,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert("Plaid exchange failed: " + (data.error || JSON.stringify(data)));
        return;
      }

      alert("Bank account connected successfully.");
      window.location.reload();
    },
  });

  return (
    <button
      onClick={() => open()}
      disabled={!ready}
      className="bg-green-600 text-white px-5 py-3 rounded-lg font-bold disabled:opacity-50"
    >
      Connect Bank Account
    </button>
  );
}